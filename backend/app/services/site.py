"""Field site passport: soil, terrain and long-term climate from open sources.

Every value carries its source and native resolution. Nothing here is a field
measurement; the passport states what remote and survey data can and cannot say.
"""
import asyncio, io, math
from datetime import date, datetime, timezone
import httpx
import numpy as np
from PIL import Image
from shapely.geometry import shape, Point
from shapely.prepared import prep

UA = {'User-Agent': 'AGROSAS-OS field decision support'}
SDA_URL = 'https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest'
SOILGRIDS_URL = 'https://rest.isric.org/soilgrids/v2.0/properties/query'
TERRAIN_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
ERA5_URL = 'https://archive-api.open-meteo.com/v1/archive'
POWER_MONTHLY = 'https://power.larc.nasa.gov/api/temporal/monthly/point'
M_PER_DEG = 111_320.0


# ----------------------------------------------------------------- soil science
def texture_class(sand, clay):
    silt = 100 - sand - clay
    if clay >= 40: return 'clay'
    if clay >= 27 and sand <= 20: return 'silty clay loam'
    if clay >= 27: return 'clay loam'
    if sand >= 85: return 'sand'
    if sand >= 70: return 'loamy sand'
    if silt >= 50 and clay < 27: return 'silt loam'
    if sand >= 52: return 'sandy loam'
    return 'loam'

def soil_category(sand, clay):
    """Map to the app's coarse soil_type used by older screens."""
    if clay >= 35: return 'clay'
    if sand >= 65: return 'sand'
    return 'loam'

def saxton_rawls(sand, clay, om):
    """Saxton & Rawls (2006) pedotransfer: water content at -33 and -1500 kPa (m³/m³)."""
    S, C, OM = sand / 100, clay / 100, min(om, 8)
    t1500t = -0.024*S + 0.487*C + 0.006*OM + 0.005*S*OM - 0.013*C*OM + 0.068*S*C + 0.031
    t1500 = t1500t + (0.14*t1500t - 0.02)
    t33t = -0.251*S + 0.195*C + 0.011*OM + 0.006*S*OM - 0.027*C*OM + 0.452*S*C + 0.299
    t33 = t33t + (1.283*t33t**2 - 0.374*t33t - 0.015)
    return max(t33, 0.05), max(t1500, 0.01)

def williams_k(sand, clay, om):
    """EPIC/Williams (1995) soil erodibility, SI units t·ha·h/(ha·MJ·mm)."""
    silt = max(0.0, 100 - sand - clay); oc = om / 1.724; sn1 = 1 - sand / 100
    f_cs = 0.2 + 0.3*math.exp(-0.256*sand*(1 - silt/100))
    f_cl = (silt / max(clay + silt, 1e-6)) ** 0.3
    f_oc = 1 - 0.25*oc / (oc + math.exp(3.72 - 2.95*oc))
    f_hs = 1 - 0.7*sn1 / (sn1 + math.exp(-5.51 + 22.9*sn1))
    return round(f_cs*f_cl*f_oc*f_hs*0.1317, 4)

def hydro_group(sand, clay):
    if sand >= 70 and clay < 10: return 'A'
    if clay < 20: return 'B'
    if clay < 40: return 'C'
    return 'D'

def summarize_soil(sand, clay, om, ph, awc_mm_m, k, hsg, source, resolution, extra=None, confidence='medium'):
    return {'sand_pct': round(sand, 1), 'clay_pct': round(clay, 1), 'silt_pct': round(100 - sand - clay, 1), 'texture': texture_class(sand, clay),
            'category': soil_category(sand, clay), 'organic_matter_pct': round(om, 2), 'ph': round(ph, 1) if ph is not None else None,
            'awc_mm_per_m': round(awc_mm_m), 'k_factor_si': round(k, 4), 'hydrologic_group': hsg, 'source': source,
            'native_resolution': resolution, 'confidence': confidence, **(extra or {})}

async def ssurgo(client, lon, lat):
    q = f"""SELECT mu.muname, c.compname, c.comppct_r, c.hydgrp, c.drainagecl, h.hzdept_r, h.hzdepb_r, h.sandtotal_r, h.claytotal_r, h.om_r, h.awc_r, h.kwfact, h.ph1to1h2o_r
FROM mapunit mu INNER JOIN component c ON c.mukey=mu.mukey INNER JOIN chorizon h ON h.cokey=c.cokey
WHERE mu.mukey IN (SELECT * FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('point({lon:.6f} {lat:.6f})')) AND c.majcompflag='Yes'
ORDER BY c.comppct_r DESC, c.cokey, h.hzdept_r ASC"""
    r = await client.post(SDA_URL, json={'query': q, 'format': 'JSON+COLUMNNAME'}, timeout=40); r.raise_for_status()
    table = r.json().get('Table') or []
    if len(table) < 2: raise ValueError('SSURGO has no component here')
    head, rows = table[0], [dict(zip(table[0], x)) for x in table[1:]]
    comp = rows[0]['compname']; rows = [x for x in rows if x['compname'] == comp]
    num = lambda v, d=None: float(v) if v not in (None, '') else d
    top = next((x for x in rows if num(x['sandtotal_r']) is not None), rows[0])
    awc_mm = sum(num(x['awc_r'], 0) * max(0, min(num(x['hzdepb_r'], 0), 100) - min(num(x['hzdept_r'], 0), 100)) * 10 for x in rows)
    sand, clay, om = num(top['sandtotal_r'], 40), num(top['claytotal_r'], 20), num(top['om_r'], 2)
    k = num(top['kwfact']); k = k*0.1317 if k is not None else williams_k(sand, clay, om)
    hsg = (rows[0]['hydgrp'] or hydro_group(sand, clay))[0]
    return summarize_soil(sand, clay, om, num(top['ph1to1h2o_r']), awc_mm, k, hsg, 'USDA NRCS SSURGO (Soil Data Access)', 'Map unit polygons, 1:12 000–1:63 360',
                          {'map_unit': rows[0]['muname'], 'component': comp, 'component_pct': num(rows[0]['comppct_r']), 'drainage': rows[0]['drainagecl'], 'awc_method': 'Σ horizon AWC × thickness, 0–100 cm'}, 'high')

async def soilgrids(client, lon, lat):
    params = [('lon', round(lon, 5)), ('lat', round(lat, 5)), ('value', 'mean')] + [('property', p) for p in ['clay', 'sand', 'soc', 'phh2o', 'bdod']] + [('depth', d) for d in ['0-5cm', '5-15cm', '15-30cm', '30-60cm', '60-100cm']]
    r = await client.get(SOILGRIDS_URL, params=params, timeout=45); r.raise_for_status()
    layers = {l['name']: l for l in r.json()['properties']['layers']}
    weights = {'0-5cm': 5, '5-15cm': 10, '15-30cm': 15, '30-60cm': 30, '60-100cm': 40}
    def mean(name, depths):
        vals = [(d['values']['mean'] / layers[name]['unit_measure']['d_factor'], weights[d['label']]) for d in layers[name]['depths'] if d['label'] in depths and d['values']['mean'] is not None]
        if not vals: raise ValueError(f'SoilGrids gap: {name}')
        return sum(v*w for v, w in vals) / sum(w for _, w in vals)
    top = ['0-5cm', '5-15cm', '15-30cm']
    clay, sand = mean('clay', top), mean('sand', top)
    soc_g_kg = mean('soc', top); om = soc_g_kg * 1.724 / 10
    ph = mean('phh2o', top)
    awc_mm = 0.0
    for d, w in weights.items():
        c, s = mean('clay', [d]), mean('sand', [d]); o = mean('soc', [d]) * 1.724 / 10
        t33, t1500 = saxton_rawls(s, c, o); awc_mm += (t33 - t1500) * w * 10
    return summarize_soil(sand, clay, om, ph, awc_mm, williams_k(sand, clay, om), hydro_group(sand, clay), 'ISRIC SoilGrids 2.0', '250 m modelled grid',
                          {'soc_g_kg': round(soc_g_kg, 1), 'bulk_density': round(mean('bdod', top), 2), 'awc_method': 'Saxton & Rawls (2006) pedotransfer, 0–100 cm', 'k_method': 'Williams EPIC (1995)'}, 'medium')

def in_conus(lon, lat): return -125 < lon < -66 and 24 < lat < 50


# --------------------------------------------------------------------- terrain
def lonlat_to_px(lon, lat, z):
    n = 256 * 2**z; s = math.sin(math.radians(lat))
    return (lon + 180) / 360 * n, (0.5 - math.log((1 + s) / (1 - s)) / (4*math.pi)) * n

async def terrain(client, geometry, cell_m=20.0, zoom=14):
    poly = shape(geometry); l, b, r, t = poly.bounds; lat0 = (b + t) / 2
    pad = 3 * cell_m / M_PER_DEG
    l, b, r, t = l - pad/math.cos(math.radians(lat0)), b - pad, r + pad/math.cos(math.radians(lat0)), t + pad
    x0, y0 = lonlat_to_px(l, t, zoom); x1, y1 = lonlat_to_px(r, b, zoom)
    tx = range(int(x0 // 256), int(x1 // 256) + 1); ty = range(int(y0 // 256), int(y1 // 256) + 1)
    if len(tx) * len(ty) > 16: raise ValueError('Field too large for terrain tiles')
    async def tile(x, y):
        q = await client.get(TERRAIN_URL.format(z=zoom, x=x, y=y), timeout=30); q.raise_for_status()
        a = np.asarray(Image.open(io.BytesIO(q.content)).convert('RGB'), dtype=np.float64)
        return x, y, a[:, :, 0]*256 + a[:, :, 1] + a[:, :, 2]/256 - 32768
    tiles = await asyncio.gather(*(tile(x, y) for x in tx for y in ty))
    mosaic = np.zeros((len(ty)*256, len(tx)*256))
    for x, y, a in tiles: mosaic[(y - ty[0])*256:(y - ty[0] + 1)*256, (x - tx[0])*256:(x - tx[0] + 1)*256] = a
    def sample(lon, lat):
        px, py = lonlat_to_px(lon, lat, zoom); px -= tx[0]*256 + .5; py -= ty[0]*256 + .5
        i, j = int(math.floor(py)), int(math.floor(px)); fy, fx = py - i, px - j
        i, j = min(max(i, 0), mosaic.shape[0]-2), min(max(j, 0), mosaic.shape[1]-2)
        return (mosaic[i, j]*(1-fx)*(1-fy) + mosaic[i, j+1]*fx*(1-fy) + mosaic[i+1, j]*(1-fx)*fy + mosaic[i+1, j+1]*fx*fy)
    dlat = cell_m / M_PER_DEG; dlon = cell_m / (M_PER_DEG*math.cos(math.radians(lat0)))
    rows, cols = max(3, int((t - b) / dlat)), max(3, int((r - l) / dlon))
    lats = t - (np.arange(rows) + .5)*dlat; lons = l + (np.arange(cols) + .5)*dlon
    elev = np.array([[sample(lo, la) for lo in lons] for la in lats])
    pp = prep(poly); inside = np.array([[pp.contains(Point(lo, la)) for lo in lons] for la in lats])
    if inside.sum() < 3: inside = np.array([[poly.buffer(cell_m/M_PER_DEG).contains(Point(lo, la)) for lo in lons] for la in lats])
    gy, gx = np.gradient(elev, cell_m)
    slope = np.sqrt(gx**2 + gy**2); slope_deg = np.degrees(np.arctan(slope))
    aspect = (np.degrees(np.arctan2(-gx, gy)) + 360) % 360
    acc = flow_accumulation(elev)
    beta = np.radians(np.maximum(slope_deg, 0.1))
    specific = acc * cell_m  # upslope contributing area per unit contour width (m)
    twi = np.log(specific / np.tan(beta))
    ls = np.power(np.minimum(specific, 300) / 22.13, 0.4) * np.power(np.sin(beta) / 0.0896, 1.3)
    m = inside
    summary = {'source': 'SRTM-based AWS Terrain Tiles (Mapzen terrarium)', 'native_resolution': 'SRTM 1″ (~30 m), NED 10 m in the USA; resampled to 20 m cells',
               'cell_m': cell_m, 'elevation_mean_m': round(float(elev[m].mean()), 1), 'relief_m': round(float(elev[m].max() - elev[m].min()), 1),
               'slope_mean_pct': round(float(slope[m].mean()*100), 2), 'slope_p90_pct': round(float(np.percentile(slope[m]*100, 90)), 2),
               'steep_share': round(float((slope[m] > .05).mean()), 3), 'ls_mean': round(float(ls[m].mean()), 3),
               'low_spot_share': round(float((twi[m] > np.percentile(twi[m], 90)).mean()), 3), 'aspect_mean_deg': round(float(circular_mean(aspect[m])), 0),
               'method': 'Slope: central differences; flow: D8 accumulation; LS: Moore & Burch (1986); TWI = ln(a / tan β)'}
    grid = {'rows': rows, 'cols': cols, 'bounds': [l, b, r, t], 'cell_m': cell_m,
            'inside': m.astype(int).tolist(), 'elevation': np.round(elev, 2).tolist(), 'slope_pct': np.round(slope*100, 2).tolist(),
            'twi': np.round(twi, 2).tolist(), 'ls': np.round(ls, 3).tolist(), 'flow': np.round(np.log1p(acc), 2).tolist()}
    return summary, grid

def circular_mean(deg):
    r = np.radians(deg); return (math.degrees(math.atan2(np.sin(r).mean(), np.cos(r).mean())) + 360) % 360

def flow_accumulation(elev):
    """D8 flow accumulation in cells (each cell contributes 1)."""
    rows, cols = elev.shape; acc = np.ones_like(elev); order = np.argsort(elev, axis=None)[::-1]
    nbrs = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
    for idx in order:
        i, j = divmod(int(idx), cols); best, target = 0.0, None
        for di, dj in nbrs:
            a, c = i + di, j + dj
            if 0 <= a < rows and 0 <= c < cols:
                drop = (elev[i, j] - elev[a, c]) / (1.4142 if di and dj else 1)
                if drop > best: best, target = drop, (a, c)
        if target: acc[target] += acc[i, j]
    return acc


# --------------------------------------------------------------------- climate
_ERA5_CACHE: dict = {}

async def era5_daily(client, lon, lat, start_year=1995):
    # ERA5 cells are ~25 km: fields within ~1 km share one series, so reuse it instead of re-querying (avoids 429 rate limits).
    end = date(date.today().year - 1, 12, 31); key = (round(lat, 2), round(lon, 2), start_year, end.year)
    if key in _ERA5_CACHE: return _ERA5_CACHE[key]
    params = {'latitude': round(lat, 4), 'longitude': round(lon, 4), 'start_date': f'{start_year}-01-01', 'end_date': end.isoformat(),
              'daily': 'temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration', 'timezone': 'UTC'}
    for attempt in range(4):
        r = await client.get(ERA5_URL, params=params, timeout=90)
        if r.status_code != 429 or attempt == 3: break
        await asyncio.sleep(float(r.headers.get('retry-after') or 0) or 3 * (attempt + 1))
    r.raise_for_status(); d = r.json()['daily']
    out = {'time': d['time'], 'tmax': d['temperature_2m_max'], 'tmin': d['temperature_2m_min'], 'precip': d['precipitation_sum'], 'et0': d['et0_fao_evapotranspiration'],
            'source': 'ECMWF ERA5 reanalysis via Open-Meteo archive', 'native_resolution': '0.25° (~25 km); ERA5-Land 0.1° where available', 'start': d['time'][0], 'end': d['time'][-1]}
    if len(_ERA5_CACHE) > 200: _ERA5_CACHE.clear()
    _ERA5_CACHE[key] = out; return out

async def power_wetness(client, lon, lat):
    y = date.today().year - 1
    r = await client.get(POWER_MONTHLY, params={'parameters': 'GWETROOT,GWETTOP,PRECTOTCORR', 'community': 'AG', 'longitude': round(lon, 4), 'latitude': round(lat, 4), 'start': 2001, 'end': y, 'format': 'JSON'}, timeout=60)
    r.raise_for_status(); p = r.json()['properties']['parameter']
    root = {k: v for k, v in p['GWETROOT'].items() if not k.endswith('13') and v is not None and v >= 0}
    by_month = {}
    for k, v in root.items(): by_month.setdefault(k[4:], []).append(v)
    clim = {m: sum(v)/len(v) for m, v in by_month.items()}
    series = [{'month': f'{k[:4]}-{k[4:]}', 'root_wetness': v, 'anomaly': round(v - clim[k[4:]], 3)} for k, v in sorted(root.items())]
    return {'source': 'NASA POWER (MERRA-2) GWETROOT root-zone soil wetness', 'native_resolution': '0.5° × 0.625°', 'series': series[-60:],
            'climatology': {m: round(v, 3) for m, v in sorted(clim.items())}, 'note': 'Wetness 0–1 (0 = dry, 1 = saturated). Anomaly = month minus its 2001–present mean.'}


def climate_summary(c, lat):
    """Long-term indicators farmers ask about: rainfall reliability, heat, frost, water deficit, trend."""
    years = {}
    for i, t in enumerate(c['time']):
        y = int(t[:4]); years.setdefault(y, []).append(i)
    south = lat < 0
    def season(i):
        m = int(c['time'][i][5:7]); return (m >= 10 or m <= 3) if south else 4 <= m <= 9
    rows = []
    for y, idx in sorted(years.items()):
        if len(idx) < 360: continue
        s = [i for i in idx if season(i)]
        p = sum(c['precip'][i] or 0 for i in idx); ps = sum(c['precip'][i] or 0 for i in s); e = sum(c['et0'][i] or 0 for i in s)
        last_spring_frost = max((int(c['time'][i][5:7])*100 + int(c['time'][i][8:10]) for i in idx if (c['tmin'][i] or 99) <= 0 and (int(c['time'][i][5:7]) <= 6 if not south else int(c['time'][i][5:7]) >= 7)), default=None)
        rows.append({'year': y, 'precip_mm': round(p), 'season_precip_mm': round(ps), 'season_et0_mm': round(e), 'season_balance_mm': round(ps - e),
                     'heat_days_32': sum(1 for i in s if (c['tmax'][i] or 0) >= 32), 'heat_days_35': sum(1 for i in s if (c['tmax'][i] or 0) >= 35),
                     'frost_days': sum(1 for i in idx if (c['tmin'][i] or 99) <= 0), 'heavy_rain_days': sum(1 for i in idx if (c['precip'][i] or 0) >= 25),
                     'max_daily_mm': round(max((c['precip'][i] or 0) for i in idx), 1), 'last_spring_frost': last_spring_frost,
                     'gdd10': round(sum(max(0, ((c['tmax'][i] or 0) + (c['tmin'][i] or 0))/2 - 10) for i in idx)),
                     'tmean': round(sum(((c['tmax'][i] or 0) + (c['tmin'][i] or 0))/2 for i in idx) / len(idx), 2)})
    if not rows: return {}
    arr = lambda k: np.array([r[k] for r in rows], dtype=float)
    yrs = arr('year'); bal = arr('season_balance_mm'); heat = arr('heat_days_32'); pr = arr('precip_mm')
    slope = lambda v: float(np.polyfit(yrs, v, 1)[0] * 10) if len(v) > 5 else 0.0
    dry_years = int((bal < np.percentile(bal, 20)).sum())
    return {'years': rows, 'n_years': len(rows), 'precip_mean_mm': round(float(pr.mean())), 'precip_cv': round(float(pr.std() / max(pr.mean(), 1)), 3),
            'season_balance_mean_mm': round(float(bal.mean())), 'season_balance_p10_mm': round(float(np.percentile(bal, 10))),
            'heat_days_mean': round(float(heat.mean()), 1), 'frost_days_mean': round(float(arr('frost_days').mean()), 1),
            'heavy_rain_days_mean': round(float(arr('heavy_rain_days').mean()), 1), 'gdd10_mean': round(float(arr('gdd10').mean())),
            'trend_per_decade': {'season_balance_mm': round(slope(bal), 1), 'heat_days_32': round(slope(heat), 2), 'precip_mm': round(slope(pr), 1), 'gdd10': round(slope(arr('gdd10')), 1), 'tmean_c': round(slope(arr('tmean')), 2)},
            'tmean_c': round(float(arr('tmean').mean()), 2), 'precip_p10_mm': round(float(np.percentile(pr, 10))),
            'dry_year_share': round(dry_years / len(rows), 2), 'erosivity_R': round(erosivity(float(pr.mean()))),
            'method': 'Season = Apr–Sep (Oct–Mar south of equator). Balance = precipitation − FAO-56 reference ET0. Trends = OLS slope × 10 years.'}

def erosivity(p_mm):
    """Rainfall erosivity R (MJ·mm·ha⁻¹·h⁻¹·yr⁻¹), Renard & Freimund (1994)."""
    return 0.0483 * p_mm**1.61 if p_mm <= 850 else 587.8 - 1.219*p_mm + 0.004105*p_mm**2


async def build_site(geometry):
    poly = shape(geometry); pt = poly.representative_point(); lon, lat = pt.x, pt.y
    out = {'built_at': datetime.now(timezone.utc).isoformat(), 'point': [round(lon, 5), round(lat, 5)], 'errors': {}}
    async with httpx.AsyncClient(headers=UA) as client:
        async def soil():
            if in_conus(lon, lat):
                try: return await ssurgo(client, lon, lat)
                except Exception as e: out['errors']['ssurgo'] = str(e)[:160]
            # SoilGrids masks urban and water pixels (250 m); try other points inside the field before giving up.
            ring = list(poly.exterior.coords)[:-1]; cx, cy = poly.centroid.x, poly.centroid.y
            candidates = [(lon, lat), (cx, cy)] + [(cx + (x - cx) * .6, cy + (y - cy) * .6) for x, y in ring[:6]]
            last = None
            for x, y in candidates:
                if not poly.buffer(1e-4).contains(Point(x, y)): continue
                try:
                    soil = await soilgrids(client, x, y)
                    if (x, y) != (lon, lat): soil['sampled_point'] = [round(x, 5), round(y, 5)]
                    return soil
                except ValueError as e: last = e
                except httpx.HTTPError as e: last = e; break  # service down: do not wait on every point
            out['errors']['soilgrids'] = f'{type(last).__name__}: {str(last)[:120]}' if last else 'no data'
            return summarize_soil(40, 22, 2.5, 6.8, 150, williams_k(40, 22, 2.5), 'B', 'Типові значення суглинку (SoilGrids недоступний)', '—', {'fallback': True}, 'low')
        tasks = {'soil': soil(), 'terrain': terrain(client, geometry), 'climate': era5_daily(client, lon, lat), 'soil_moisture': power_wetness(client, lon, lat)}
        results = await asyncio.gather(*tasks.values(), return_exceptions=True)
    for key, value in zip(tasks, results):
        if isinstance(value, Exception): out['errors'][key] = f'{type(value).__name__}: {str(value)[:160]}'; continue
        if key == 'terrain': out['terrain'], out['terrain_grid'] = value
        elif key == 'climate': out['climate_daily'] = value; out['climate'] = {**climate_summary(value, lat), 'source': value['source'], 'native_resolution': value['native_resolution']}
        else: out[key] = value
    return out
