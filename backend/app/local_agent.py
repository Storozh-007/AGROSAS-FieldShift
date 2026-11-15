"""Built-in farm assistant that works without any external AI.

Intent routing by keywords (uk / ru / en), then the same real tools the Claude agent uses
(fields, site passport, rotation model, zones, weather, places), and answers composed from
the returned numbers. Streams the same NDJSON events as the Claude agent.
"""
import asyncio, json, re
from typing import Any, AsyncIterator

CROP_UA = {'wheat': 'озима пшениця', 'spring_wheat': 'яра пшениця', 'barley': 'ячмінь', 'maize': 'кукурудза', 'sorghum': 'сорго', 'sunflower': 'соняшник', 'soybean': 'соя',
           'pea': 'горох', 'rapeseed': 'озимий ріпак', 'clover': 'конюшина', 'cotton': 'бавовник', 'almond': 'мигдаль'}
CROP_WORDS = {'пшениц': 'wheat', 'wheat': 'wheat', 'ячмін': 'barley', 'barley': 'barley', 'кукуруд': 'maize', 'corn': 'maize', 'maize': 'maize', 'сорго': 'sorghum', 'соняшник': 'sunflower',
              'sunflower': 'sunflower', 'соя': 'soybean', 'сої': 'soybean', 'сою': 'soybean', 'soy': 'soybean', 'горох': 'pea', 'ріпак': 'rapeseed', 'rapeseed': 'rapeseed', 'canola': 'rapeseed', 'конюшин': 'clover', 'clover': 'clover', 'pea': 'pea', 'sorghum': 'sorghum'}
KIND_UA = {'current': 'ваша поточна', 'balanced': 'найкращий баланс', 'soil': 'відновлення ґрунту', 'water': 'стійкість до посухи', 'income': 'максимум доходу'}
LEVEL_UA = {'high': 'висока', 'medium': 'помірна', 'low': 'низька'}
FACTOR_UA = {'erosion': 'ерозія на схилі', 'waterlogging': 'перезволоження в низині', 'frost_pocket': 'морозобійна низина', 'drought': 'посушлива ділянка', 'low_vigor': 'слабка вегетація', 'none': 'без суттєвих обмежень'}
MISSIONS = {
 'smap': ('SMAP', 'вимірює вологість верхніх 5 см ґрунту і кореневої зони кожні 2–3 дні (9–36 км). Для поля — сигнал посухи до того, як її видно на листі.'),
 'gpm': ('GPM / IMERG', 'рахує опади з космосу кожні 30 хвилин. Показує, скільки дощу реально впало на регіон поля.'),
 'landsat': ('Landsat 8/9', 'знімає поле з деталізацією 30 м раз на 8 днів (дві місії разом): NDVI і температура поверхні — найдовший архів з 1972 року.'),
 'terra': ('Terra / MODIS', 'щодня знімає всю Землю (250–1000 м): регіональна вегетація і тепловий стрес.'),
 'modis': ('Terra / MODIS', 'щодня знімає всю Землю (250–1000 м): регіональна вегетація і тепловий стрес.'),
 'ecostress': ('ECOSTRESS на МКС', 'міряє температуру поверхні й випаровування (70 м) — показує, де рослинам бракує води вдень.'),
 'gedi': ('GEDI на МКС', 'лазером вимірює висоту рослинності й біомасу — контекст лісосмуг і ландшафту довкола поля.'),
 'viirs': ('NOAA‑20 / VIIRS', 'щодня дає індекс вегетації та пожежі (375–750 м).'),
 'sentinel': ('Sentinel‑2', 'дає знімки 10 м кожні 5 днів — з них платформа рахує NDVI, воду в листі й хлорофіл по зонах поля.'),
 'srtm': ('SRTM', 'рельєф планети з шатла 2000 року (30 м): схили, стік води й ерозія на вашому полі.'),
}
MISSION_ID = {'smap': 'smap', 'gpm': 'gpm', 'landsat': 'landsat9', 'terra': 'terra', 'modis': 'terra', 'ecostress': 'ecostress', 'gedi': 'gedi', 'viirs': 'viirs', 'sentinel': 'sentinel2', 'srtm': 'srtm'}


def has(text, *words): return any(w in text for w in words)


def detect(text: str) -> str:
    t = text.lower()
    if has(t, 'створ', 'додай поле', 'додати поле', 'нове поле', 'new field', 'create', 'add a field', 'зареєстр', 'намалю', 'draw'): return 'create'
    if has(t, 'погод', 'обприск', 'дощ', 'мороз', 'вітер', 'прогноз', 'weather', 'spray', 'хмар', 'rain', 'wind', 'frost', 'forecast', 'cloud'): return 'weather'
    if has(t, 'загроз', 'загрож', 'ризик', 'threat', 'risk', 'danger', 'небезпек', 'проблем', 'вразлив'): return 'threats'
    if has(t, 'сівозмін', 'rotation', 'що сіяти', 'що посіяти', 'what to sow', 'what to plant', 'яку культуру', 'which crop', 'стратегі', 'strategy'): return 'rotation'
    if has(t, 'зон', 'проб', 'рельєф', 'схил', 'ndvi', 'zone', 'slope', 'terrain', 'sampl'): return 'zones'
    if has(t, 'ґрунт', 'грунт', 'soil', 'паспорт', 'passport', 'клімат', 'climate', 'органік', 'organic'): return 'passport'
    if any(k in t for k in MISSIONS) or has(t, 'супутник', 'satellite', 'nasa'): return 'mission'
    if has(t, 'мої поля', 'список пол', 'скільки пол', 'my fields', 'усі поля', 'list fields', 'how many fields'): return 'fields'
    if has(t, 'покаж', 'відкри', 'перейд', 'show', 'open', 'глобус', 'globe', 'космос', 'сонячн', 'solar'): return 'navigate'
    if has(t, 'привіт', 'hello', 'hi', 'що вмієш', 'what can you', 'допомож', 'help'): return 'help'
    return 'unknown'


def place_from(text):
    m = re.search(r'(?:біля|поблизу|коло|near|в|у|під)\s+([A-ZА-ЯІЇЄҐ][\w’\'\-]+(?:[\s\-][A-ZА-ЯІЇЄҐ][\w’\'\-]+)*)', text)
    return m.group(1) if m else None


def area_from(text):
    m = re.search(r'(\d+(?:[.,]\d+)?)\s*(?:га|ha|гектар)', text.lower())
    return float(m.group(1).replace(',', '.')) if m else None


def crops_from(text):
    t = text.lower(); out = []
    for k, v in CROP_WORDS.items():
        i = t.find(k)
        if i >= 0: out.append((i, v))
    return [v for _, v in sorted(out)]


async def run(messages: list[dict[str, Any]], page: str | None, field_id: str | None, tool) -> AsyncIterator[dict]:
    """tool(name, args, actions) -> data; yields event dicts."""
    text = messages[-1]['content'].split('\n', 1)[-1] if messages[-1]['content'].startswith('[Контекст') else messages[-1]['content']
    intent = detect(text)

    async def say(s):
        for chunk in re.findall(r'\S+\s*|\n', s):
            yield {'type': 'text', 'delta': chunk}; await asyncio.sleep(.012)

    async def call(name, args, label):
        yield {'type': 'tool', 'name': name, 'label': label, 'status': 'start'}
        actions: list = []
        try:
            data = await tool(name, args, actions)
            yield {'type': 'tool', 'name': name, 'label': label, 'status': 'done'}
            for a in actions: yield {'type': 'action', **a}
            yield {'type': '_data', 'data': data}
        except Exception as exc:
            yield {'type': 'tool', 'name': name, 'label': label, 'status': 'error', 'error': str(exc)[:200]}
            yield {'type': '_data', 'data': None, 'error': str(exc)}

    async def collect(gen, sink):
        async for ev in gen:
            if ev['type'] == '_data': sink.update(ev)
            else: yield ev

    fields: list = []
    async def resolve_field(sink):
        nonlocal fields
        res: dict = {}
        async for ev in collect(call('list_fields', {}, 'Дивлюсь ваші поля'), res): yield ev
        fields = res.get('data') or []
        t = text.lower()
        named = next((f for f in fields if f['name'].lower().split(' ·')[0] in t), None)
        sink['field'] = named or next((f for f in fields if f['id'] == field_id), None) or (fields[0] if fields else None)

    if intent == 'help' or intent == 'unknown':
        async for e in say(('Привіт! ' if intent == 'help' else 'Я не зовсім зрозумів запит, але ось що можу просто зараз:\n') +
                           'Я агроном‑асистент AGROSAS і працюю з реальними даними ваших полів:\n'
                           '- **загрози поля** — посуха, спека, ерозія з 30 років клімату ERA5\n'
                           '- **сівозміна** — яку культуру сіяти, з маржею і ризиками\n'
                           '- **погода** — коли можна обприскувати\n'
                           '- **зони поля** — де поле слабше і куди ставити датчики\n'
                           '- **нове поле** — намалюйте його на карті прямо тут\n'): yield e
        yield {'type': 'suggestions', 'items': ['Що загрожує моєму полю?', 'Яку сівозміну обрати?', 'Коли обприскувати?', 'Створи нове поле']}; return

    if intent == 'create':
        place = place_from(text); area = area_from(text); crops = crops_from(text)
        center = None; label = None
        if place:
            res: dict = {}
            async for ev in collect(call('find_place', {'query': place, 'settlement': True}, f'Шукаю «{place}» на карті'), res): yield ev
            if res.get('data'): center = [res['data'][0]['lon'], res['data'][0]['lat']]; label = res['data'][0]['name'].split(',')[0]
        name = f"Поле біля {place}" if center else 'Нове поле'
        async for e in say((f'Знайшов **{label}**. ' if label else '') + 'Відкриваю карту зі супутниковим знімком прямо тут. '
                           'Клацайте по кутах поля — площа порахується сама. Потім натисніть **Створити**, і я одразу зберу паспорт поля.' +
                           (f' Площу {area:g} га вже позначив квадратом — підправте вершини.' if area and center else '')): yield e
        yield {'type': 'action', 'kind': 'field_draw', 'center': center, 'area_ha': area if center else None, 'name': name, 'crops': crops}
        return

    if intent == 'fields':
        sink: dict = {}
        async for ev in resolve_field(sink): yield ev
        if not fields:
            async for e in say('У вас ще немає полів. Створимо перше?'): yield e
            yield {'type': 'suggestions', 'items': ['Створи нове поле']}; return
        lines = '\n'.join(f"- **{f['name']}** — {f['area_ha']} га, {', '.join(CROP_UA.get(c, c) for c in (f.get('crops') or [])[-3:]) or 'культури не вказані'}" for f in fields[:12])
        async for e in say(f'У вас {len(fields)} полів, разом {sum(f["area_ha"] for f in fields):.0f} га:\n{lines}'): yield e
        yield {'type': 'suggestions', 'items': [f'Загрози поля {fields[0]["name"].split(" ·")[0]}', 'Створи нове поле']}; return

    if intent == 'mission':
        t = text.lower(); key = next((k for k in MISSIONS if k in t), None)
        if key:
            name, desc = MISSIONS[key]
            async for e in say(f'**{name}** {desc}\nВідкриваю сторінку місії з 3D‑моделлю, орбітою в реальному часі та відео NASA.'): yield e
            yield {'type': 'action', 'kind': 'navigate', 'href': f'/missions?mission={MISSION_ID[key]}'}
        else:
            async for e in say('Платформа використовує 10 супутників у реальному часі: **Terra, Landsat 8/9, SMAP, GPM, МКС (ECOSTRESS, GEDI), NOAA‑20, Suomi NPP, Sentinel‑2B/2C**. '
                               'На глобусі наведіть на будь-який — побачите висоту, швидкість і що він дає полю. Про який розповісти?'): yield e
            yield {'type': 'suggestions', 'items': ['Як SMAP допомагає фермеру?', 'Що дає Sentinel‑2?', 'Покажи Landsat']}
        return

    if intent == 'navigate':
        t = text.lower(); sink: dict = {}
        async for ev in resolve_field(sink): yield ev
        f = sink.get('field'); fid = f['id'] if f else None
        target = ('/dashboard', 'глобус з полями й супутниками') if has(t, 'глобус', 'globe', 'космос', 'сонячн', 'solar', 'карт', 'map') else \
                 (f'/farm-lab?field={fid}#zones', 'зони поля в 3D') if has(t, 'зон') else (f'/farm-lab?field={fid}#evidence', 'знімки Sentinel‑2') if has(t, 'знім', 'снимк', 'фото', 'ndvi') else \
                 ('/climate', 'кліматичну машину часу') if has(t, 'клімат', 'climate') else ('/missions', 'супутники NASA') if has(t, 'супутн', 'спутн', 'місі', 'мисси') else \
                 (f'/farm-lab?field={fid}#simulation', 'цифрову ферму') if has(t, 'ферм') else (f'/farm-lab?field={fid}', 'робоче місце поля')
        yield {'type': 'action', 'kind': 'navigate', 'href': target[0]}
        async for e in say(f'Відкриваю {target[1]}' + (f' для поля **{f["name"]}**.' if f and 'field' in target[0] else '.')): yield e; return

    # Field-specific intents
    sink: dict = {}
    async for ev in resolve_field(sink): yield ev
    f = sink.get('field')
    if not f:
        async for e in say('Спочатку потрібне поле. Намалюйте його на карті — це хвилина.'): yield e
        yield {'type': 'action', 'kind': 'field_draw', 'center': None, 'name': 'Нове поле', 'crops': []}; return
    fid, fname = f['id'], f['name']

    if intent in ('threats', 'rotation'):
        async for e in say(f'Аналізую поле **{fname}**: 30 років клімату ERA5, ґрунт, рельєф SRTM і тисячі варіантів сівозміни. Це до 30 секунд…\n\n'): yield e
        res: dict = {}
        goal = 'water' if has(text.lower(), 'посух', 'вод', 'drought', 'water') else 'soil' if has(text.lower(), 'ґрунт', 'грунт', 'soil') else 'profit' if has(text.lower(), 'прибут', 'дохід', 'гроші', 'profit', 'income', 'money') else 'stable'
        async for ev in collect(call('plan_rotation', {'field_id': fid, 'goal': goal}, 'Рахую сівозміну на 30 сезонах'), res): yield ev
        p = res.get('data')
        if not p:
            async for e in say(f'Не вдалося порахувати модель: {res.get("error", "дані недоступні")}. Спробуйте ще раз за хвилину.'): yield e; return
        if intent == 'threats':
            top = [t for t in p['threats'] if t['level'] != 'low'] or p['threats'][:2]
            body = '\n'.join(f"- **{t['title']}** ({LEVEL_UA[t['level']]}): {t['evidence']}" for t in top)
            m = p['vulnerable_months_deficit_mm']; months = ['січні', 'лютому', 'березні', 'квітні', 'травні', 'червні', 'липні', 'серпні', 'вересні', 'жовтні', 'листопаді', 'грудні']; peak = max(range(12), key=lambda i: m[i])
            async for e in say(f'Головні загрози для **{fname}**:\n{body}\n\nПоточні культури найбільше страждають від нестачі води в **{months[peak]}** (~{m[peak]:.0f} мм дефіциту).'): yield e
            yield {'type': 'suggestions', 'items': ['Яку сівозміну обрати?', 'Покажи зони поля', 'Коли обприскувати?']}
        else:
            s = {x['id']: x for x in p['strategies']}; cur = p['strategies'][0]; best = s[p['recommended']]
            name = lambda x: ' → '.join(CROP_UA.get(c, c) for c in x['crops']) + (' + покривна' if x['cover_crop'] else '')
            diff = best['margin_usd_ha'] - cur['margin_usd_ha']
            why = [f"маржа {best['margin_usd_ha']:+} $/га на рік ({diff:+} проти поточної)".replace('+-', '−'), f"водний дефіцит {cur['water_deficit_mm']} → {best['water_deficit_mm']} мм",
                   f"ерозія {cur['erosion_t_ha']} → {best['erosion_t_ha']} т/га", f"краща за поточну у {best['beats_current_years_pct']}% років" if best.get('beats_current_years_pct') is not None else '']
            alts = '\n'.join(f"- {KIND_UA.get(x['kind'], x['kind'])}: {name(x)} — ${x['margin_usd_ha']}/га, дефіцит {x['water_deficit_mm']} мм" for x in p['strategies'][1:] if x['id'] != best['id'])
            risks = [r for r in best.get('risks', []) if r.get('years')][:2]
            rtxt = '; '.join(f"{CROP_UA.get(r['crop'], r['crop'])}: {'спека' if r['type']=='heat' else 'посуха' if r['type']=='drought' else 'вимерзання' if r['type']=='winterkill' else 'заморозки' if r['type']=='frost' else 'брак тепла'} у {r['years']} з {r['of']} років" for r in risks)
            async for e in say(f"Зараз на полі: **{name(cur)}** — ${cur['margin_usd_ha']}/га.\n\nРекомендую: **{name(best)}**\n" + '\n'.join(f'- {w}' for w in why if w) +
                               (f'\n\nНа що зважити: {rtxt}.' if rtxt else '') + f'\n\nІнші варіанти:\n{alts}\n\nЦе модель на {p["years"][0]}–{p["years"][1]}; остаточне рішення — за вами й агрономом.'): yield e
            yield {'type': 'action', 'kind': 'navigate', 'href': f'/farm-lab?field={fid}#rotation'}
            yield {'type': 'suggestions', 'items': ['Що загрожує полю?', 'А якщо буде посуха?', 'Покажи зони поля']}
        return

    if intent == 'weather':
        res: dict = {}
        async for ev in collect(call('get_weather', {'field_id': fid}, 'Дивлюсь прогноз і знімки хмар'), res): yield ev
        w = res.get('data')
        if not w:
            async for e in say('Прогноз зараз недоступний, спробуйте пізніше.'): yield e; return
        n = w['now']; days = w['days']; spray = w['spray_hours_next_72h']
        win = f"найближче вікно — **{spray[0].replace('T', ' ')}**" + (f" (ще {len(spray)-1} придатних годин у 72 год)" if len(spray) > 1 else '') if spray else 'у найближчі 72 години вікна немає — вітер або дощ'
        risk = [f"мороз {d['date'][5:]} ({d['temperature_2m_min']:.0f}°)" for d in days if d['frost']] + [f"пориви {d['wind_gusts_10m_max']:.0f} км/год {d['date'][5:]}" for d in days if d['storm']]
        soil = n.get('soil_moisture_3_to_9cm'); st = n.get('soil_temperature_6cm')
        async for e in say(f"Над **{fname}** зараз {n['temperature_2m']:.0f}°, вітер {n['wind_speed_10m']:.0f} км/год, хмарність {n['cloud_cover']}%.\n"
                           f"- Обприскування: {win}\n- Ґрунт: {st:.1f}° на 6 см, волога {round((soil or 0)*100)}%"
                           + (' — можна сіяти ранні ярі' if st and 6 <= st < 10 else ' — тепло для пізніх ярих' if st and st >= 10 else ' — холодно для сівби') +
                           (f"\n- Увага: {', '.join(risk[:3])}" if risk else '\n- Небезпечних явищ у 4 дні не видно') +
                           f"\n\nДні: " + ', '.join(f"{d['date'][5:]} {d['temperature_2m_min']:.0f}…{d['temperature_2m_max']:.0f}° {d['precipitation_sum']:.0f} мм" for d in days)): yield e
        yield {'type': 'action', 'kind': 'navigate', 'href': f'/farm-lab?field={fid}#weather'}
        yield {'type': 'suggestions', 'items': ['Що загрожує полю?', 'Покажи знімки поля']}; return

    if intent == 'zones':
        res: dict = {}
        async for ev in collect(call('get_zones', {'field_id': fid}, 'Будую зони поля з рельєфу й NDVI'), res): yield ev
        z = res.get('data')
        if not z:
            async for e in say(f'Зони зараз не порахувались: {res.get("error", "")}'): yield e; return
        lines = '\n'.join(f"- Зона {q['zone']}: {q['area_ha']} га, урожай {round(q['relative_yield']*100)}%, {FACTOR_UA.get(q['limiting_factor'], q['limiting_factor'])}" + (f", ${q['gm_per_ha']}/га" if q.get('gm_per_ha') is not None else '') for q in z['zones'])
        weak = min(z['zones'], key=lambda q: q['relative_yield'])
        async for e in say(f"**{fname}** ділиться на {len(z['zones'])} зони{' (рельєф SRTM + NDVI Sentinel‑2)' if z['has_ndvi'] else ' (рельєф SRTM)'}:\n{lines}\n\n"
                           f"Найслабша — зона {weak['zone']}: {FACTOR_UA.get(weak['limiting_factor'])}. План відбору ґрунту: {z['samples']} проб, маршрут {z['route_m']/1000:.1f} км. Відкриваю 3D‑карту."): yield e
        yield {'type': 'action', 'kind': 'navigate', 'href': f'/farm-lab?field={fid}#zones'}
        yield {'type': 'suggestions', 'items': ['Яку сівозміну обрати?', 'Коли обприскувати?']}; return

    if intent == 'passport':
        res: dict = {}
        async for ev in collect(call('get_field_passport', {'field_id': fid}, 'Збираю паспорт поля'), res): yield ev
        s = res.get('data')
        if not s:
            async for e in say(f'Паспорт не зібрався: {res.get("error", "")}'): yield e; return
        so, te, cl = s['soil'], s['terrain'], s['climate']; tr = cl.get('trend_per_decade') or {}
        async for e in say(f"Паспорт **{fname}**:\n- Ґрунт: {so['texture']}, органіка {so['organic_matter_pct']}%, pH {so['ph']}, доступна волога {so['awc_mm_per_m']} мм/м ({so['source']})\n"
                           f"- Рельєф: схил {te['slope_mean_pct']}%, перепад {te['relief_m']} м\n- Клімат {cl['n_years']} років: {cl['precip_mean_mm']} мм/рік, баланс сезону {cl['season_balance_mean_mm']} мм "
                           f"({tr.get('season_balance_mm', 0):+} за 10 р.), спекотних днів {cl['heat_days_mean']}"): yield e
        yield {'type': 'suggestions', 'items': ['Що загрожує полю?', 'Яку сівозміну обрати?']}; return
