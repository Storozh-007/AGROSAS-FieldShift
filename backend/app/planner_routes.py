"""Site passport, rotation planner, management zones and farm benchmark endpoints."""
import asyncio
from concurrent.futures import ProcessPoolExecutor
from datetime import date, datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field as PField
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from geoalchemy2.shape import to_shape
from shapely.geometry import mapping
from app.db import get_db
from app.models import Field, FieldProfile, VegetationObservation
from app.services import rotation_engine as E
from app.services.site import build_site, climate_summary
from app.services.zones import build_zones
from app.services.field_evidence import scene_catalog, calculate_raster

_locks: dict[str, asyncio.Lock] = {}
_pool: ProcessPoolExecutor | None = None


async def in_process(fn, *args):
    """Run CPU-heavy model code in a worker process so the API stays responsive."""
    global _pool
    try:
        if _pool is None: _pool = ProcessPoolExecutor(max_workers=2)
        return await asyncio.get_running_loop().run_in_executor(_pool, fn, *args)
    except (OSError, RuntimeError):
        return await asyncio.to_thread(fn, *args)


class Weights(BaseModel):
    water: float = PField(30, ge=0, le=100)
    soil: float = PField(30, ge=0, le=100)
    resilience: float = PField(25, ge=0, le=100)
    economy: float = PField(15, ge=0, le=100)


GOALS = {'stable': {'resilience': 40, 'economy': 25, 'water': 20, 'soil': 15}, 'profit': {'economy': 55, 'resilience': 20, 'water': 10, 'soil': 15},
         'water': {'water': 50, 'resilience': 25, 'soil': 15, 'economy': 10}, 'soil': {'soil': 50, 'water': 20, 'resilience': 15, 'economy': 15}}
LEVEL = {'high': 3, 'medium': 2, 'low': 1}


def detect_threats(site, base, risks, irrigated):
    """Field threats from the data — the farmer confirms instead of guessing weights."""
    cl, soil, t = site['climate'], site['soil'], site['climate'].get('trend_per_decade', {})
    out = []
    def add(tid, level, title, evidence, source): out.append({'id': tid, 'level': level, 'title': title, 'evidence': evidence, 'source': source})
    bal, dry = cl.get('season_balance_mean_mm', 0), cl.get('dry_year_share', 0)
    lvl = 'high' if bal < -300 or (bal < -150 and t.get('season_balance_mm', 0) < -30) else 'medium' if bal < -150 else 'low'
    if irrigated and lvl == 'high': lvl = 'medium'
    add('drought', lvl, 'Посуха і нестача води', f"Баланс сезону {bal} мм (опади − ET0), тренд {t.get('season_balance_mm', 0):+} мм за 10 років; дефіцит поточних культур {round(base['deficit_mm'])} мм", 'ERA5 · 30 років + модель FAO‑56')
    heat = cl.get('heat_days_mean', 0); ht = t.get('heat_days_32', 0)
    add('heat', 'high' if heat >= 15 or (heat >= 8 and ht > 1.5) else 'medium' if heat >= 6 or ht > 1 else 'low', 'Спека в період цвітіння', f"{heat} днів ≥32 °C за сезон, {ht:+} днів за 10 років; температура {t.get('tmean_c', 0):+} °C за 10 років", 'ERA5 · 30 років')
    er = base['erosion_t']
    add('erosion', 'high' if er > 5 else 'medium' if er > 2.5 else 'low', 'Ерозія ґрунту', f"{er:.1f} т/га/рік при допустимих 5; схил {site.get('terrain', {}).get('slope_mean_pct', '—')}%, злив ≥25 мм: {cl.get('heavy_rain_days_mean')} на рік", 'SRTM + ґрунт + RUSLE')
    om = soil.get('organic_matter_pct', 3)
    add('soil_carbon', 'high' if om < 2 else 'medium' if om < 3.5 else 'low', 'Бідний на органіку ґрунт', f"Органіка {om}%, {soil.get('texture')}; поле голе {round(base['bare_days'])} днів між культурами", soil.get('source', 'ґрунт'))
    wk = [r for r in risks if r['type'] in ('winterkill', 'frost')]; share = max((r['years'] / max(r['of'], 1) for r in wk), default=0)
    add('frost', 'high' if share > .3 else 'medium' if share > .1 else 'low', 'Заморозки і вимерзання', f"У найгіршої культури — {round(share * 100)}% років; днів із заморозком {cl.get('frost_days_mean')}", 'ERA5 + модель')
    heavy = cl.get('heavy_rain_days_mean', 0)
    add('waterlogging', 'high' if heavy >= 10 or soil.get('hydrologic_group') == 'D' else 'medium' if heavy >= 5 else 'low', 'Зливи й перезволоження', f"{heavy} злив ≥25 мм на рік, гідрогрупа ґрунту {soil.get('hydrologic_group')}", 'ERA5 + ґрунт')
    lp = base['loss_prob']
    add('money', 'high' if lp > .2 else 'medium' if lp > .08 else 'low', 'Збиткові роки', f"Поточна сівозміна дає збиток у {round(lp * 100)}% років; P10 маржі ${round(base['gm_p10'])}/га", 'Модель на 30 сезонах')
    return sorted(out, key=lambda x: -LEVEL[x['level']])


def threat_weights(threats):
    L = {t['id']: LEVEL[t['level']] for t in threats}
    w = {'water': L['drought'] + .5 * L['heat'], 'soil': L['erosion'] + L['soil_carbon'] + .5 * L['waterlogging'], 'resilience': L['money'] + L['frost'] + .5 * L['heat'], 'economy': 2.5}
    total = sum(w.values()); return {k: v / total * 100 for k, v in w.items()}


class PlanInput(BaseModel):
    weights: Weights | None = None
    goal: str = PField('stable', pattern='^(stable|profit|water|soil)$')
    scenario: str = PField('now', pattern='^(now|trend2035|dry|wet|hot|drought_heat|warm2050|custom)$')
    temperature_delta: float = PField(0, ge=-2, le=5)
    precipitation_delta: float = PField(0, ge=-50, le=30)
    prices: dict[str, float] = {}
    excluded: list[str] = []
    irrigated: bool | None = None
    max_irrigation_mm: float | None = PField(None, ge=0, le=1500)
    allow_cover: bool = True
    current: list[str] | None = PField(None, max_length=8)


def site_public(site):
    out = {k: v for k, v in site.items() if k != 'climate_daily'}
    if site.get('climate_daily') and site.get('climate'):
        out['climate'] = {**climate_summary(site['climate_daily'], site['point'][1]), 'source': site['climate']['source'], 'native_resolution': site['climate']['native_resolution']}
    return out


def mean_temp(site):
    c = site['climate_daily']; vals = [((a or 0) + (b or 0)) / 2 for a, b in zip(c['tmax'], c['tmin'])]
    return sum(vals) / max(len(vals), 1)


def engine_site(site, field: Field, body: PlanInput | None = None):
    soil, ter, cl = site['soil'], site.get('terrain', {}), site['climate']
    irrigated = field.irrigation if body is None or body.irrigated is None else body.irrigated
    return E.Site(lat=site['point'][1], awc_mm_m=soil['awc_mm_per_m'], ph=field.soil_ph if field.soil_ph is not None else soil.get('ph'), om_pct=soil['organic_matter_pct'],
                  k_factor=soil['k_factor_si'], hsg=soil['hydrologic_group'], ls=ter.get('ls_mean', .3), erosivity=cl['erosivity_R'], t_mean=mean_temp(site),
                  irrigated=bool(irrigated), max_irrigation_mm=body.max_irrigation_mm if body else None)


def current_rotation(profile: FieldProfile | None, field: Field, override=None):
    if override: return [c for c in override if c in E.CROPS]
    payload = profile.payload if profile else {}
    seasons = (payload.get('agronomy') or {}).get('seasons') or []
    if not seasons:
        from app.agronomy_routes import regional_scenario
        seasons = (regional_scenario(payload) or {}).get('seasons') or []
    if not seasons and (payload.get('cdl_history') or {}).get('seasons'):
        seasons = [s for s in payload['cdl_history']['seasons'] if s.get('crop')]
    crops = [s['crop'] for s in sorted(seasons, key=lambda s: s['year']) if s.get('crop') in E.CROPS]
    return crops or [c for c in field.crop_history if c in E.CROPS]


def evidence(site):
    soil, ter, cl, sm = site.get('soil', {}), site.get('terrain', {}), site.get('climate', {}), site.get('soil_moisture', {})
    items = []
    if soil: items.append({'layer': 'soil', 'source': soil['source'], 'resolution': soil['native_resolution'], 'confidence': soil['confidence']})
    if ter: items.append({'layer': 'terrain', 'source': ter['source'], 'resolution': ter['native_resolution'], 'confidence': 'medium'})
    if cl: items.append({'layer': 'climate', 'source': f"{cl['source']} · {cl.get('n_years')} років", 'resolution': cl['native_resolution'], 'confidence': 'medium'})
    if sm: items.append({'layer': 'soil_moisture', 'source': sm['source'], 'resolution': sm['native_resolution'], 'confidence': 'low'})
    return items


def gaps(site, field: Field, body: PlanInput):
    out = []
    if site.get('soil', {}).get('fallback'): out.append('soil_fallback')
    elif site.get('soil', {}).get('confidence') != 'high': out.append('soil_modelled')
    if not body.prices: out.append('prices_default')
    out += ['yield_potential_generic', 'snow_cover_not_modelled', 'pests_regional']
    if site.get('errors'): out.append('partial_sources')
    return out


async def ensure_site(db: Session, field: Field, rebuild=False):
    lock = _locks.setdefault(field.id, asyncio.Lock())
    async with lock:
        profile = db.get(FieldProfile, field.id)
        if profile and profile.payload.get('site') and not rebuild:
            site = profile.payload['site']
            stale_fallback = site.get('soil', {}).get('fallback') and (datetime.now(timezone.utc) - datetime.fromisoformat(site.get('built_at', '2000-01-01T00:00:00+00:00'))).total_seconds() > 1800
            if site.get('soil') and site.get('climate_daily') and not stale_fallback: return profile, site
        # Terrain flow routing and climate summaries are CPU-bound: keep them off the API event loop.
        site = await asyncio.to_thread(asyncio.run, build_site(mapping(to_shape(field.boundary))))
        if not site.get('soil') or not site.get('climate_daily'):
            raise HTTPException(503, 'Не вдалося отримати ґрунт або клімат для поля. Повторіть пізніше. ' + '; '.join(f'{k}: {v}' for k, v in site.get('errors', {}).items()))
        if not profile: profile = FieldProfile(field_id=field.id, payload={}); db.add(profile)
        profile.payload = {**profile.payload, 'site': site}; flag_modified(profile, 'payload')
        if field.soil_type == 'unknown': field.soil_type = site['soil']['category']
        if field.soil_ph is None and site['soil'].get('ph') is not None: field.soil_ph = round(site['soil']['ph'], 1)
        db.commit(); db.refresh(profile)
        return profile, site


async def peak_ndvi(db: Session, field: Field, site):
    record = db.scalars(select(VegetationObservation).where(VegetationObservation.field_id == field.id, VegetationObservation.is_demo == False)
                        .order_by(VegetationObservation.ndvi_mean.desc()).limit(10)).all()
    usable = [r for r in record if r.payload.get('grid')]
    if usable: return usable[0].payload
    south = site['point'][1] < 0; y = date.today().year - (0 if date.today().month > 8 else 1)
    start, end = (date(y, 12, 1), date(y + 1, 2, 28)) if south else (date(y, 6, 1), date(y, 8, 31))
    if end > date.today(): return None
    geometry = mapping(to_shape(field.boundary))
    try:
        items = sorted(await scene_catalog(geometry, start, end), key=lambda i: i['properties'].get('eo:cloud_cover', 100))[:3]
        for item in items:
            try: result = await asyncio.to_thread(calculate_raster, item, geometry)
            except Exception: continue
            if result.get('valid_fraction', 0) > .7:
                db.add(VegetationObservation(field_id=field.id, scene_date=result['date'][:10], satellite='Sentinel-2', product=item['id'], ndvi_mean=result['ndvi_mean'],
                                             ndvi_min=result['ndvi_min'], ndvi_max=result['ndvi_max'], cloud_cover_pct=result['cloud_pct'] or 0, is_demo=False, payload=result)); db.commit()
                return result
    except Exception:
        return None
    return None


def router_for(authorize, get_field, audit):
    r = APIRouter(prefix='/api')

    @r.get('/fields/{field_id}/site')
    def get_site(field_id: str, db: Session = Depends(get_db), org: str = Depends(authorize)):
        get_field(db, field_id, org); p = db.get(FieldProfile, field_id); site = (p.payload if p else {}).get('site')
        return {'built': bool(site), **(site_public(site) if site else {})}

    @r.post('/fields/{field_id}/site')
    async def post_site(field_id: str, rebuild: bool = False, db: Session = Depends(get_db), org: str = Depends(authorize)):
        field = get_field(db, field_id, org); _, site = await ensure_site(db, field, rebuild); audit(db, 'site.build', field_id, org); db.commit()
        return {'built': True, **site_public(site)}

    @r.post('/fields/{field_id}/rotation-plan')
    async def plan(field_id: str, body: PlanInput, db: Session = Depends(get_db), org: str = Depends(authorize)):
        field = get_field(db, field_id, org)
        bad = [c for c in body.excluded + list(body.prices) if c not in E.CROPS]
        if bad: raise HTTPException(422, f'Невідомі культури: {", ".join(bad)}')
        profile, site = await ensure_site(db, field)
        site = {**site, 'climate': {**climate_summary(site['climate_daily'], site['point'][1]), 'source': site['climate']['source'], 'native_resolution': site['climate']['native_resolution']}}
        current = current_rotation(profile, field, body.current)
        es = engine_site(site, field, body)
        cl = site['climate']; dT, dP = body.temperature_delta, body.precipitation_delta
        if body.scenario == 'trend2035':
            yrs = 2035 - int(cl['years'][-1]['year']); dT = round(max(0.0, cl['trend_per_decade']['tmean_c'] * yrs / 10), 2); dP = round(max(-40.0, min(20.0, cl['trend_per_decade']['precip_mm'] * yrs / 10 / max(cl['precip_mean_mm'], 1) * 100)), 1)
        elif body.scenario == 'dry':
            dT, dP = 0.5, round(max(-40.0, min(-10.0, (cl['precip_p10_mm'] / max(cl['precip_mean_mm'], 1) - 1) * 100)), 1)
        elif body.scenario == 'now':
            dT, dP = 0.0, 0.0
        elif body.scenario == 'wet':
            dT, dP = -0.3, 25.0
        elif body.scenario == 'hot':
            dT, dP = 2.0, -10.0
        elif body.scenario == 'drought_heat':
            dT, dP = 1.5, round(max(-40.0, min(-15.0, (cl['precip_p10_mm'] / max(cl['precip_mean_mm'], 1) - 1) * 100 - 5)), 1)
        elif body.scenario == 'warm2050':
            dT, dP = 2.5, -8.0
        # First pass with the goal preset gives the current-rotation baseline and its risks; threats then set the weights.
        goal_w = GOALS[body.goal]
        probe = await in_process(E.run, es, site['climate_daily'], current, goal_w, body.prices, set(body.excluded), dT, dP, body.allow_cover, 1)
        threats = detect_threats(site, probe['strategies'][0]['metrics'], probe['strategies'][0]['risks'], es.irrigated)
        tw = threat_weights(threats)
        weights = body.weights.model_dump() if body.weights else {k: round(.5 * goal_w[k] + .5 * tw[k], 1) for k in goal_w}
        result = await in_process(E.run, es, site['climate_daily'], current, weights, body.prices, set(body.excluded), dT, dP, body.allow_cover)
        base = result['strategies'][0]['metrics']; best = next(s for s in result['strategies'] if s['id'] == result['recommended'])
        if not dT and not dP:
            profile.payload = {**profile.payload, 'plan_summary': {'computed_at': datetime.now(timezone.utc).isoformat(), 'current': current, 'gm_current': round(base['gm_mean']),
                                                                   'gm_best': round(best['metrics']['gm_mean']), 'best_crops': best['crops'], 'best_cover': best['cover_crop'],
                                                                   'erosion_current': round(base['erosion_t'], 2), 'deficit_current': round(base['deficit_mm']),
                                                                   'base': {'c_factor': base['c_factor'], 'gm_mean': base['gm_mean'], 'revenue_mean': base['revenue_mean']}}}
            flag_modified(profile, 'payload'); db.commit()
        return {**result, 'current': current, 'threats': threats, 'goal': body.goal, 'weights_source': 'manual' if body.weights else 'goal+threats', 'weights_pct': weights, 'threat_weights': tw, 'goal_weights': goal_w,
                'scenario_name': body.scenario, 'scenario': {'temperature_delta': dT, 'precipitation_delta': dP}, 'site': {'soil': site['soil'], 'terrain': site.get('terrain'), 'climate': {k: v for k, v in site['climate'].items() if k != 'years'},
                'climate_years': site['climate'].get('years'), 'soil_moisture': site.get('soil_moisture')},
                'evidence': evidence(site), 'gaps': gaps(site, field, body), 'irrigated': es.irrigated,
                'assumptions': {'n_price_usd_kg': E.N_PRICE, 'irrigation_usd_mm': E.IRRIGATION_COST, 'cover_crop_usd_ha': E.COVER_COST, 'tolerable_soil_loss_t': E.T_SOIL_LOSS,
                                'crops': {k: {'price': body.prices.get(k, v['price']), 'cost': v['cost'], 'ymax': v['ymax'], 'name': v['name']} for k, v in E.CROPS.items()}}}

    @r.get('/fields/{field_id}/zones')
    async def zones(field_id: str, k: int = 4, db: Session = Depends(get_db), org: str = Depends(authorize)):
        field = get_field(db, field_id, org); profile, site = await ensure_site(db, field)
        if not site.get('terrain_grid'): raise HTTPException(503, 'Рельєф для поля недоступний')
        base = (profile.payload.get('plan_summary') or {}).get('base')
        if not base:
            es = engine_site(site, field); clim = site['climate_daily']; index = {t: i for i, t in enumerate(clim['time'])}
            years = list(range(int(clim['time'][0][:4]) + 1, int(clim['time'][-1][:4]) + 1)); cur = current_rotation(profile, field)
            sims = {c: E.simulate_crop(c, clim, index, es, years)[0] for c in set(cur)}
            m = E.evaluate_rotation(cur, sims, es, years, {}) or {}
            base = {'c_factor': m.get('c_factor', .35), 'gm_mean': m.get('gm_mean'), 'revenue_mean': m.get('revenue_mean')}
        raster = await peak_ndvi(db, field, site)
        result = await asyncio.to_thread(build_zones, site['terrain_grid'], site['soil'], site['climate'], base, raster, max(2, min(k, 6)))
        return {**result, 'field': {'id': field.id, 'name': field.name, 'area_ha': round(field.area_ha, 2)}}

    @r.get('/farm/benchmark')
    def benchmark(db: Session = Depends(get_db), org: str = Depends(authorize)):
        rows = []
        for f in db.scalars(select(Field).where(Field.organization_id == org)).all():
            p = db.get(FieldProfile, f.id); s = (p.payload if p else {}).get('plan_summary')
            rows.append({'id': f.id, 'name': f.name, 'area_ha': round(f.area_ha, 2), 'country': (p.payload if p else {}).get('country'), 'computed': bool(s),
                         **({k: s[k] for k in ['gm_current', 'gm_best', 'best_crops', 'best_cover', 'erosion_current', 'deficit_current', 'current', 'computed_at']} if s else {})})
        rows.sort(key=lambda x: (not x['computed'], -(x.get('gm_current') or 0)))
        return {'fields': rows, 'note': 'Модельна маржа на гектар за 30 кліматичних років, ціни за замовчуванням. Не бухгалтерський облік.'}

    return r
