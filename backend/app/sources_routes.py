"""Live health of every external data source the product depends on."""
import asyncio, time
from datetime import date, timedelta
import httpx
from fastapi import APIRouter, Depends

_cache: dict = {}
d = (date.today() - timedelta(days=3)).isoformat()
SOURCES = [
 {'id': 'power', 'group': 'Клімат', 'name': 'NASA POWER', 'agency': 'NASA LaRC', 'what': 'Сонячна радіація, температура, опади, вологість кореневої зони (GWETROOT)', 'used_in': ['Паспорт поля', 'Цифрова ферма', 'Вологість ґрунту'], 'resolution': '0.5° × 0.625°', 'cadence': 'щодня, затримка ~2 доби',
  'url': 'https://power.larc.nasa.gov/', 'probe': 'https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M&community=AG&longitude=34&latitude=49&start=20250101&end=20250102&format=JSON'},
 {'id': 'gibs', 'group': 'Супутники NASA', 'name': 'NASA GIBS (MODIS, VIIRS, SMAP, GPM IMERG, HLS)', 'agency': 'NASA EOSDIS', 'what': 'Шари на глобусі, знімки хмар над полем, NDVI регіону', 'used_in': ['Глобус', 'Погода', 'Шари поля'], 'resolution': '250 м – 10 км', 'cadence': 'щодня / 8 діб',
  'url': 'https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api', 'probe': f'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/{d}/GoogleMapsCompatible_Level9/2/1/1.jpg'},
 {'id': 'stac', 'group': 'Супутники NASA', 'name': 'Sentinel‑2 L2A (Earth Search STAC)', 'agency': 'ESA Copernicus / AWS', 'what': 'NDVI та 9 інших індексів 10 м по пікселях поля, зони', 'used_in': ['Спостереження', 'Зони поля'], 'resolution': '10–20 м', 'cadence': 'кожні 5 діб',
  'url': 'https://earth-search.aws.element84.com/v1', 'probe': 'https://earth-search.aws.element84.com/v1/collections/sentinel-2-l2a'},
 {'id': 'celestrak', 'group': 'Супутники NASA', 'name': 'CelesTrak GP (TLE)', 'agency': 'CelesTrak / US Space Force', 'what': 'Орбітальні елементи для SGP4: де зараз Terra, Landsat, SMAP, МКС, Starlink', 'used_in': ['Глобус', 'Місії', 'Проліт над полем'], 'resolution': '—', 'cadence': 'кілька разів на добу',
  'url': 'https://celestrak.org/', 'probe': 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE'},
 {'id': 'svs', 'group': 'Супутники NASA', 'name': 'NASA Scientific Visualization Studio', 'agency': 'NASA GSFC', 'what': 'Офіційні відео місій', 'used_in': ['Місії'], 'resolution': '—', 'cadence': '—', 'url': 'https://svs.gsfc.nasa.gov/', 'probe': 'https://svs.gsfc.nasa.gov/api/14858'},
 {'id': 'era5', 'group': 'Клімат', 'name': 'ECMWF ERA5 (Open‑Meteo archive)', 'agency': 'Copernicus C3S', 'what': '30 років добового клімату: модель сівозміни, машина часу, загрози', 'used_in': ['Сівозміна', 'Машина часу', 'Загрози'], 'resolution': '0.25° (ERA5‑Land 0.1°)', 'cadence': 'щодня, затримка ~5 діб',
  'url': 'https://open-meteo.com/en/docs/historical-weather-api', 'probe': 'https://archive-api.open-meteo.com/v1/archive?latitude=49&longitude=34&start_date=2025-01-01&end_date=2025-01-02&daily=temperature_2m_max'},
 {'id': 'forecast', 'group': 'Клімат', 'name': 'Прогноз ECMWF / ICON / GFS (Open‑Meteo)', 'agency': 'ECMWF, DWD, NOAA', 'what': '72 години і 14 днів, вікна для обприскування', 'used_in': ['Погода', 'План дій'], 'resolution': '2–25 км', 'cadence': 'щогодини',
  'url': 'https://open-meteo.com/', 'probe': 'https://api.open-meteo.com/v1/forecast?latitude=49&longitude=34&hourly=temperature_2m&forecast_days=1'},
 {'id': 'soilgrids', 'group': 'Ґрунт і рельєф', 'name': 'ISRIC SoilGrids 2.0', 'agency': 'ISRIC', 'what': 'Текстура, органіка, pH, щільність — для всього світу', 'used_in': ['Паспорт поля', 'Ерозія', 'Водний баланс'], 'resolution': '250 м', 'cadence': 'статичний',
  'url': 'https://soilgrids.org/', 'probe': 'https://rest.isric.org/soilgrids/v2.0/properties/layers'},
 {'id': 'sda', 'group': 'Ґрунт і рельєф', 'name': 'USDA NRCS SSURGO (Soil Data Access)', 'agency': 'USDA', 'what': 'Офіційні ґрунтові карти США: AWC, K‑фактор, гідрогрупа', 'used_in': ['Паспорт поля (США)'], 'resolution': '1:12 000 – 1:63 360', 'cadence': 'щороку',
  'url': 'https://sdmdataaccess.sc.egov.usda.gov/', 'probe': 'https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest', 'post': {'query': 'SELECT TOP 1 areasymbol FROM legend', 'format': 'JSON'}},
 {'id': 'terrain', 'group': 'Ґрунт і рельєф', 'name': 'SRTM / NED (AWS Terrain Tiles)', 'agency': 'NASA / USGS', 'what': 'Висоти, схили, стік води, фактор LS для ерозії, 3D‑рельєф', 'used_in': ['Зони поля', 'Ерозія'], 'resolution': '30 м (США 10 м)', 'cadence': 'статичний',
  'url': 'https://registry.opendata.aws/terrain-tiles/', 'probe': 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/2/1/1.png'},
 {'id': 'cdl', 'group': 'Сільське господарство', 'name': 'USDA Cropland Data Layer', 'agency': 'USDA NASS', 'what': 'Що росло на полі в США 5 років поспіль', 'used_in': ['Історія культур'], 'resolution': '30 м (з 2024 — 10 м)', 'cadence': 'щороку',
  'url': 'https://nassgeodata.gmu.edu/CropScape/', 'probe': 'https://nassgeodata.gmu.edu/axis2/services/CDLService/GetCDLValue?year=2024&x=-140000&y=2000000'},
 {'id': 'ftw', 'group': 'Сільське господарство', 'name': 'Fields of The World', 'agency': 'Taylor Geospatial / Source Cooperative', 'what': 'Межі 12 прикладних полів (модель на Sentinel‑2)', 'used_in': ['Приклади полів'], 'resolution': '10 м', 'cadence': '2025', 'url': 'https://source.coop/ftw/global-data', 'probe': None},
]


def router_for(authorize):
    r = APIRouter(prefix='/api')

    @r.get('/sources/status')
    async def status(org: str = Depends(authorize)):
        if _cache.get('t', 0) + 300 > time.monotonic(): return _cache['data']
        async with httpx.AsyncClient(timeout=12, headers={'User-Agent': 'AGROSAS-OS source health check'}, follow_redirects=True) as client:
            async def probe(s):
                if s['id'] == 'celestrak':
                    from app.services.orbits import orbit_catalog
                    t0 = time.perf_counter()
                    try:
                        recs = (await orbit_catalog())['records']; fresh = [x for x in recs if not x.get('unavailable')]
                        age = min((x['age_hours'] for x in fresh), default=None)
                        return {**s, 'status': 'ok' if fresh else 'down', 'latency_ms': round((time.perf_counter() - t0) * 1000), 'detail': f"{len(fresh)}/{len(recs)} супутників, найсвіжіші TLE {age} год" if fresh else 'TLE недоступні'}
                    except Exception as exc:
                        return {**s, 'status': 'down', 'error': type(exc).__name__, 'latency_ms': None}
                if not s.get('probe'): return {**s, 'status': 'static', 'latency_ms': None}
                t0 = time.perf_counter()
                try:
                    resp = await (client.post(s['probe'], json=s['post']) if s.get('post') else client.get(s['probe']))
                    ok = resp.status_code < 400 or (s['id'] == 'celestrak' and resp.status_code == 403)
                    return {**s, 'status': 'ok' if ok else 'degraded', 'http': resp.status_code, 'latency_ms': round((time.perf_counter() - t0) * 1000)}
                except httpx.HTTPError as exc:
                    return {**s, 'status': 'down', 'error': type(exc).__name__, 'latency_ms': None}
            results = await asyncio.gather(*(probe(s) for s in SOURCES))
        data = {'sources': [{k: v for k, v in x.items() if k not in ('probe', 'post')} for x in results], 'checked_at': time.time()}
        _cache.update(t=time.monotonic(), data=data); return data
    return r
