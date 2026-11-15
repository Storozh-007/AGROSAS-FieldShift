"""AGROSAS farm assistant: Claude with tools over the app's own API, streamed to the chat widget.

The agent reads real field data (fields, site passport, rotation model, zones, weather), can create
a field after the farmer confirms in chat, and can move the UI to the right page. Responses stream as
newline-delimited JSON events: text deltas, tool status, UI actions.
"""
import json, math, os
from typing import Any
import anthropic
import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field as PField
from app.config import settings

MODEL = os.environ.get('ASSISTANT_MODEL', 'claude-opus-5-5')
SELF = os.environ.get('API_SELF_URL', 'http://127.0.0.1:8000')
CROPS = ['wheat', 'spring_wheat', 'barley', 'maize', 'sorghum', 'sunflower', 'soybean', 'pea', 'rapeseed', 'clover', 'cotton', 'almond']

SYSTEM = """Ти — агроном-асистент платформи AGROSAS OS (NASA Space Apps, челендж «Field Shift»). Допомагаєш фермеру зрозуміти своє поле й обрати сівозміну, спираючись на реальні дані платформи. Відповідай мовою користувача (за замовчуванням українською), коротко і по суті: 2–6 речень або короткий список. Числа бери лише з інструментів — не вигадуй значень. Якщо даних немає, скажи це і запропонуй, як їх отримати.

Що є на платформі:
- /dashboard — глобус з полями, супутники на орбіті, шари NASA (вся Земля або тільки поле).
- /farm-lab?field=<id> — робота з полем. Вкладки: rotation (історія культур і модель сівозміни на 30 років клімату), zones (3D-зони поля, проби ґрунту, прибуток), plan (план дій на 72 години), simulation (цифрова ферма), evidence (знімки Sentinel‑2, NDVI).
- /missions?mission=<id> — супутники (smap, gpm, landsat8, landsat9, terra, viirs, iss, ecostress, gedi, srtm, sentinel2): як працюють і що дають фермеру.
- /network — господарства та події.

Як працюєш:
- Щоб відповісти про конкретне поле, спершу знайди його через list_fields, якщо не знаєш id. Контекст поточної сторінки приходить у повідомленні користувача.
- Модель сівозміни (plan_rotation) і паспорт поля можуть рахуватися до 30 секунд — попередь про це одним реченням.
- Пояснюй терміни простими словами (ET, NDVI, ерозія, P10), коли вони трапляються вперше.
- Нагадуй, що інструмент підтримує, а не замінює рішення фермера та агронома, коли даєш рекомендацію щодо сівозміни.
- Створювати поле (create_field) можна лише після того, як користувач явно підтвердив назву й розташування в чаті. Спершу опиши, що саме створиш, і запитай «Створити?». Лише після «так» виклич create_field з confirmed=true.
- Коли користувачеві корисно побачити сторінку — виклич navigate."""

TOOLS: list[dict[str, Any]] = [
    {'name': 'list_fields', 'description': 'Список полів користувача: id, назва, площа, країна, культури.', 'input_schema': {'type': 'object', 'properties': {}, 'additionalProperties': False}},
    {'name': 'find_place', 'description': 'Знайти населений пункт або місцевість за назвою (OpenStreetMap). Повертає координати й межі.', 'input_schema': {'type': 'object', 'properties': {'query': {'type': 'string', 'description': 'Назва місця, напр. «Полтава» або «Kozyntsi, Kyiv oblast»'}, 'settlement': {'type': 'boolean', 'description': 'шукати лише міста й села'}}, 'required': ['query'], 'additionalProperties': False}},
    {'name': 'create_field', 'description': 'Створити поле. Або polygon (≥3 точки [довгота, широта]), або центр + площа (квадрат). Лише після явного підтвердження користувача.', 'input_schema': {'type': 'object', 'properties': {
        'name': {'type': 'string'}, 'confirmed': {'type': 'boolean', 'description': 'true лише якщо користувач явно погодився в чаті'},
        'polygon': {'type': 'array', 'items': {'type': 'array', 'items': {'type': 'number'}}, 'description': '[[lon, lat], ...]'},
        'center_lat': {'type': 'number'}, 'center_lon': {'type': 'number'}, 'area_ha': {'type': 'number'},
        'crops': {'type': 'array', 'items': {'type': 'string', 'enum': CROPS}, 'description': 'Культури за роками від старшого до останнього'},
        'irrigation': {'type': 'boolean'}}, 'required': ['name', 'confirmed'], 'additionalProperties': False}},
    {'name': 'get_field_passport', 'description': 'Паспорт поля: ґрунт (SSURGO/SoilGrids), рельєф SRTM, 30 років клімату ERA5, вологість NASA POWER.', 'input_schema': {'type': 'object', 'properties': {'field_id': {'type': 'string'}}, 'required': ['field_id'], 'additionalProperties': False}},
    {'name': 'plan_rotation', 'description': 'Запустити модель сівозміни: загрози поля, поточна та запропоновані стратегії з маржею, водою, ерозією, вуглецем і ризиками.', 'input_schema': {'type': 'object', 'properties': {
        'field_id': {'type': 'string'}, 'goal': {'type': 'string', 'enum': ['stable', 'profit', 'water', 'soil']}, 'scenario': {'type': 'string', 'enum': ['now', 'trend2035', 'dry']}}, 'required': ['field_id'], 'additionalProperties': False}},
    {'name': 'get_zones', 'description': 'Зони поля: площа, відносний урожай, обмежувальний фактор, маржа, поправки норм висіву й азоту.', 'input_schema': {'type': 'object', 'properties': {'field_id': {'type': 'string'}}, 'required': ['field_id'], 'additionalProperties': False}},
    {'name': 'get_weather', 'description': 'Прогноз для поля: зараз, 3 дні, вікна для обприскування, ризики морозу/спеки/поривів, стан ґрунту.', 'input_schema': {'type': 'object', 'properties': {'field_id': {'type': 'string'}}, 'required': ['field_id'], 'additionalProperties': False}},
    {'name': 'navigate', 'description': 'Відкрити сторінку платформи для користувача.', 'input_schema': {'type': 'object', 'properties': {
        'page': {'type': 'string', 'enum': ['dashboard', 'farm-lab', 'missions', 'network']}, 'field_id': {'type': 'string'},
        'tab': {'type': 'string', 'enum': ['rotation', 'zones', 'plan', 'simulation', 'evidence']}, 'mission': {'type': 'string'}}, 'required': ['page'], 'additionalProperties': False}},
]
for t in TOOLS: t['eager_input_streaming'] = True
TOOL_LABEL = {'list_fields': 'Дивлюсь ваші поля', 'find_place': 'Шукаю місце на карті', 'create_field': 'Створюю поле', 'get_field_passport': 'Збираю паспорт поля', 'plan_rotation': 'Рахую сівозміну на 30 сезонах', 'get_zones': 'Будую зони поля', 'get_weather': 'Дивлюсь прогноз', 'navigate': 'Відкриваю сторінку'}


class ChatTurn(BaseModel):
    role: str = PField(pattern='^(user|assistant)$')
    content: str = PField(max_length=8000)


class ChatInput(BaseModel):
    messages: list[ChatTurn] = PField(min_length=1, max_length=40)
    page: str | None = PField(None, max_length=300)
    field_id: str | None = PField(None, max_length=64)


def validate(name, data):
    """Inputs stream eagerly, so check them before running anything."""
    schema = next(t['input_schema'] for t in TOOLS if t['name'] == name)
    if not isinstance(data, dict): raise ValueError('input must be an object')
    missing = [k for k in schema.get('required', []) if k not in data]
    if missing: raise ValueError(f'missing: {", ".join(missing)}')
    for k, v in data.items():
        spec = schema['properties'].get(k)
        if spec is None: raise ValueError(f'unknown field {k}')
        typ = spec['type']
        ok = {'string': isinstance(v, str), 'number': isinstance(v, (int, float)) and not isinstance(v, bool), 'boolean': isinstance(v, bool), 'array': isinstance(v, list), 'object': isinstance(v, dict)}[typ]
        if not ok: raise ValueError(f'{k} must be {typ}')
        if 'enum' in spec and v not in spec['enum']: raise ValueError(f'{k} must be one of {spec["enum"]}')
    return data


async def api(client: httpx.AsyncClient, method, path, **kw):
    r = await client.request(method, f'{SELF}/api{path}', headers={'Authorization': f'Bearer {settings.app_token}'}, timeout=180, **kw)
    if r.status_code >= 400:
        try: detail = r.json().get('detail')
        except Exception: detail = r.text[:200]
        raise RuntimeError(f'{r.status_code}: {detail}')
    return r.json() if r.content else None


def square(lat, lon, area_ha):
    side = math.sqrt(area_ha * 1e4) / 2; dlat = side / 111320; dlon = side / (111320 * math.cos(math.radians(lat)))
    return [[lon - dlon, lat - dlat], [lon + dlon, lat - dlat], [lon + dlon, lat + dlat], [lon - dlon, lat + dlat], [lon - dlon, lat - dlat]]


async def run_tool(client, name, a, actions):
    if name == 'list_fields':
        fields = await api(client, 'GET', '/fields')
        return [{'id': f['id'], 'name': f['name'], 'area_ha': round(f['area_ha'], 1), 'country': f.get('country'), 'crops': f.get('crop_history'), 'irrigation': f.get('irrigation')} for f in fields]
    if name == 'find_place':
        r = await client.get('https://nominatim.openstreetmap.org/search', params={'q': a['query'], 'format': 'json', 'limit': 5, 'accept-language': 'uk,en', **({'featuretype': 'settlement'} if a.get('settlement') else {})}, headers={'User-Agent': 'AGROSAS-OS farm assistant'}, timeout=20)
        r.raise_for_status()
        return [{'name': p['display_name'], 'lat': float(p['lat']), 'lon': float(p['lon']), 'type': p.get('type')} for p in r.json()]
    if name == 'create_field':
        if not a.get('confirmed'): return {'error': 'Спершу отримайте явне підтвердження користувача в чаті, потім викличте з confirmed=true.'}
        ring = a.get('polygon')
        if ring:
            if len(ring) < 3 or any(len(p) != 2 for p in ring): raise ValueError('polygon needs ≥3 [lon, lat] points')
            if ring[0] != ring[-1]: ring = ring + [ring[0]]
        elif all(k in a for k in ('center_lat', 'center_lon', 'area_ha')):
            if not 0.1 <= a['area_ha'] <= 5000: raise ValueError('area_ha must be 0.1–5000')
            ring = square(a['center_lat'], a['center_lon'], a['area_ha'])
        else: raise ValueError('give polygon or center_lat + center_lon + area_ha')
        crops = [c for c in a.get('crops') or [] if c in CROPS] or ['wheat']
        f = await api(client, 'POST', '/fields', json={'name': a['name'][:100], 'geometry': {'type': 'Polygon', 'coordinates': [ring]}, 'crop_history': crops, 'soil_type': 'unknown', 'soil_ph': None, 'irrigation': bool(a.get('irrigation')), 'priorities': {'water': 30, 'soil': 30, 'resilience': 25, 'economy': 15}})
        actions.append({'kind': 'navigate', 'href': f"/farm-lab?field={f['id']}", 'refresh': ['fields']})
        return {'created': True, 'id': f['id'], 'name': f['name'], 'area_ha': round(f['area_ha'], 1), 'open': f"/farm-lab?field={f['id']}"}
    if name == 'get_field_passport':
        s = await api(client, 'POST', f"/fields/{a['field_id']}/site")
        c = s.get('climate', {})
        return {'soil': {k: s['soil'].get(k) for k in ['texture', 'organic_matter_pct', 'ph', 'awc_mm_per_m', 'hydrologic_group', 'source', 'confidence']},
                'terrain': {k: s.get('terrain', {}).get(k) for k in ['slope_mean_pct', 'relief_m', 'steep_share', 'elevation_mean_m']},
                'climate': {k: c.get(k) for k in ['n_years', 'precip_mean_mm', 'season_balance_mean_mm', 'heat_days_mean', 'frost_days_mean', 'heavy_rain_days_mean', 'trend_per_decade', 'dry_year_share']},
                'soil_moisture_recent': (s.get('soil_moisture') or {}).get('series', [])[-6:]}
    if name == 'plan_rotation':
        p = await api(client, 'POST', f"/fields/{a['field_id']}/rotation-plan", json={'goal': a.get('goal', 'stable'), 'scenario': a.get('scenario', 'now')})
        strat = [{'id': s['id'], 'kind': s['kind'], 'crops': s['crops'], 'cover_crop': s['cover_crop'], 'score': round(s['score']), 'margin_usd_ha': round(s['metrics']['gm_mean']),
                  'margin_p10': round(s['metrics']['gm_p10']), 'loss_years_pct': round(s['metrics']['loss_prob'] * 100), 'water_deficit_mm': round(s['metrics']['deficit_mm']),
                  'erosion_t_ha': round(s['metrics']['erosion_t'], 1), 'soil_carbon_vs_current': round(s['metrics']['soc_change_t'], 2), 'n_fertiliser_kg': round(s['metrics']['n_fert_kg']),
                  'beats_current_years_pct': None if s['win_rate_vs_current'] is None else round(s['win_rate_vs_current'] * 100), 'risks': s['risks'][:5], 'benefits': s['benefits']} for s in p['strategies']]
        actions.append({'kind': 'refresh', 'keys': ['benchmark']})
        return {'current_rotation': p['current'], 'recommended': p['recommended'], 'threats': [{k: t[k] for k in ('title', 'level', 'evidence')} for t in p['threats']],
                'weights_pct': p['weights_pct'], 'scenario': p['scenario'], 'years': p['years'], 'strategies': strat, 'vulnerable_months_deficit_mm': p['vulnerable_months'], 'data_gaps': p['gaps']}
    if name == 'get_zones':
        z = await api(client, 'GET', f"/fields/{a['field_id']}/zones")
        return {'has_ndvi': z['has_ndvi'], 'ndvi_scene': z['ndvi_scene'], 'samples': len(z['samples']['points']), 'route_m': z['samples']['route_m'],
                'zones': [{k: q[k] for k in ['zone', 'area_ha', 'relative_yield', 'slope_pct', 'erosion_t', 'ndvi', 'limiting_factor', 'gm_per_ha', 'seed_rate_pct', 'n_rate_pct']} for q in z['zones']]}
    if name == 'get_weather':
        w = await api(client, 'GET', f"/fields/{a['field_id']}/weather-detail")
        h = w['hours']; now = h[0]
        spray = [x['time'] for x in h if x['wind_speed_10m'] < 15 and x['precipitation'] < .1 and (x['precipitation_probability'] or 0) < 30 and 5 < x['temperature_2m'] < 25]
        return {'timezone': w['timezone'], 'now': {k: now[k] for k in ['temperature_2m', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m', 'cloud_cover', 'soil_temperature_6cm', 'soil_moisture_3_to_9cm']},
                'days': [{k: d[k] for k in ['date', 'temperature_2m_min', 'temperature_2m_max', 'precipitation_sum', 'precipitation_probability_max', 'wind_speed_10m_max', 'wind_gusts_10m_max', 'frost', 'heat', 'storm', 'spray_window']} for d in w['days'][:4]],
                'spray_hours_next_72h': spray[:24]}
    if name == 'navigate':
        page = a['page']; href = '/' + page
        if page == 'farm-lab' and a.get('field_id'): href += f"?field={a['field_id']}"
        if page == 'missions' and a.get('mission'): href += f"?mission={a['mission']}"
        if page == 'farm-lab' and a.get('tab'): href += f"#{a['tab']}"
        actions.append({'kind': 'navigate', 'href': href}); return {'opened': href}
    raise ValueError(f'unknown tool {name}')


def router_for(authorize):
    r = APIRouter(prefix='/api')

    @r.get('/assistant/status')
    def status(org: str = Depends(authorize)):
        claude = bool(os.environ.get('ANTHROPIC_API_KEY') or os.environ.get('ANTHROPIC_AUTH_TOKEN'))
        return {'ready': True, 'mode': 'claude' if claude else 'local', 'model': MODEL if claude else 'AGROSAS local agent'}

    @r.post('/assistant/chat')
    async def chat(body: ChatInput, org: str = Depends(authorize)):
        context = f"[Контекст: сторінка {body.page or 'невідома'}{f', відкрите поле {body.field_id}' if body.field_id else ''}]\n"
        messages: list[dict[str, Any]] = [{'role': t.role, 'content': t.content} for t in body.messages]
        if messages[-1]['role'] != 'user': raise HTTPException(422, 'Last message must be from the user')
        messages[-1] = {'role': 'user', 'content': context + messages[-1]['content']}

        async def local_events():
            from app.local_agent import run as local_run
            async with httpx.AsyncClient() as http:
                async def tool(name, args, actions): return await run_tool(http, name, validate(name, args), actions)
                try:
                    async for ev in local_run(messages, body.page, body.field_id, tool): yield json.dumps(ev, ensure_ascii=False) + '\n'
                except Exception as exc:
                    yield json.dumps({'type': 'error', 'message': f'Помилка асистента: {exc}'[:300]}, ensure_ascii=False) + '\n'
            yield json.dumps({'type': 'done'}) + '\n'

        if not (os.environ.get('ANTHROPIC_API_KEY') or os.environ.get('ANTHROPIC_AUTH_TOKEN')):
            return StreamingResponse(local_events(), media_type='application/x-ndjson', headers={'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no'})

        async def events():
            def emit(obj): return json.dumps(obj, ensure_ascii=False) + '\n'
            client = anthropic.AsyncAnthropic()
            async with httpx.AsyncClient() as http:
                try:
                    for _ in range(8):
                        async with client.beta.messages.stream(model=MODEL, max_tokens=16000, system=SYSTEM, tools=TOOLS, messages=messages,
                                                               output_config={'effort': 'medium'}, cache_control={'type': 'ephemeral'},
                                                               betas=['server-side-fallback-2026-07-01'], fallbacks='default') as stream:
                            async for event in stream:
                                if event.type == 'text': yield emit({'type': 'text', 'delta': event.text})
                            final = await stream.get_final_message()
                        if final.stop_reason == 'refusal':
                            yield emit({'type': 'text', 'delta': '\n\nНа це запитання я не можу відповісти.'}); break
                        tool_uses = [b for b in final.content if b.type == 'tool_use']
                        if final.stop_reason == 'max_tokens' and tool_uses:
                            yield emit({'type': 'text', 'delta': '\n\n(Відповідь обірвалася — спробуйте коротше запитання.)'}); break
                        if final.stop_reason == 'pause_turn':
                            messages.append({'role': 'assistant', 'content': final.content}); continue
                        if not tool_uses: break
                        messages.append({'role': 'assistant', 'content': final.content})
                        results = []
                        for block in tool_uses:
                            yield emit({'type': 'tool', 'name': block.name, 'label': TOOL_LABEL.get(block.name, block.name), 'status': 'start'})
                            actions: list[dict] = []
                            try:
                                data = await run_tool(http, block.name, validate(block.name, block.input), actions)
                                results.append({'type': 'tool_result', 'tool_use_id': block.id, 'content': json.dumps(data, ensure_ascii=False, default=str)[:30000]})
                                yield emit({'type': 'tool', 'name': block.name, 'label': TOOL_LABEL.get(block.name, block.name), 'status': 'done'})
                                for act in actions: yield emit({'type': 'action', **act})
                            except Exception as exc:
                                results.append({'type': 'tool_result', 'tool_use_id': block.id, 'content': f'Помилка: {exc}', 'is_error': True})
                                yield emit({'type': 'tool', 'name': block.name, 'label': TOOL_LABEL.get(block.name, block.name), 'status': 'error', 'error': str(exc)[:200]})
                        messages.append({'role': 'user', 'content': results})
                except anthropic.AuthenticationError:
                    yield emit({'type': 'error', 'message': 'Ключ Claude API недійсний. Перевірте ANTHROPIC_API_KEY.'})
                except anthropic.RateLimitError:
                    yield emit({'type': 'error', 'message': 'Забагато запитів до асистента — спробуйте за хвилину.'})
                except anthropic.APIStatusError as exc:
                    yield emit({'type': 'error', 'message': f'Claude API: {exc.status_code}'})
                except anthropic.APIConnectionError:
                    yield emit({'type': 'error', 'message': 'Немає зʼєднання з Claude API.'})
            yield emit({'type': 'done'})

        return StreamingResponse(events(), media_type='application/x-ndjson', headers={'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no'})

    return r
