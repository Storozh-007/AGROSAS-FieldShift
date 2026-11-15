from datetime import datetime, timezone
import httpx

_cache={}

async def fetch_forecast(latitude, longitude):
    key=(round(latitude,5),round(longitude,5));cached=_cache.get(key)
    if cached and (datetime.now(timezone.utc)-datetime.fromisoformat(cached['fetched_at'])).total_seconds()<900:return cached
    # Separate future numerical weather prediction from NASA POWER historical data.
    async with httpx.AsyncClient(timeout=25) as client:
        response = await client.get('https://api.open-meteo.com/v1/forecast', params={
            'latitude':latitude,'longitude':longitude,'models':'ecmwf_ifs025','timezone':'UTC','forecast_days':4,
            'hourly':'temperature_2m,precipitation,shortwave_radiation,et0_fao_evapotranspiration,wind_speed_10m'})
        response.raise_for_status()
    raw=response.json(); h=raw['hourly'];now=datetime.now(timezone.utc);hours=[]
    for i,t in enumerate(h['time']):
        if datetime.fromisoformat(t).replace(tzinfo=timezone.utc)<now.replace(minute=0,second=0,microsecond=0): continue
        values={k:h[k][i] for k in ['temperature_2m','precipitation','shortwave_radiation','et0_fao_evapotranspiration']}
        if any(v is None for v in values.values()): raise ValueError('Forecast has missing hourly variables')
        hours.append({'time':t+'Z',**values,'wind_speed_10m':h.get('wind_speed_10m',[0]*len(h['time']))[i] or 0})
    if len(hours)<72: raise ValueError('Incomplete 72-hour forecast')
    result={'source':'ECMWF IFS 0.25° / Open-Meteo','kind':'forecast','fetched_at':now.isoformat(),'model':'ecmwf_ifs025','license':'CC BY 4.0','attribution_url':'https://open-meteo.com/en/docs/ecmwf-api','grid_latitude':raw['latitude'],'grid_longitude':raw['longitude'],'hours':hours[:72]}

    if len(_cache)>100:_cache.clear()
    _cache[key]=result
    return result

async def fetch_weather14(latitude,longitude):
    key=('weather14',round(latitude,5),round(longitude,5));cached=_cache.get(key)
    if cached and (datetime.now(timezone.utc)-datetime.fromisoformat(cached['fetched_at'])).total_seconds()<3600:return cached
    async with httpx.AsyncClient(timeout=30) as client:
        response=await client.get('https://api.open-meteo.com/v1/forecast',params={'latitude':latitude,'longitude':longitude,'models':'ecmwf_ifs025','timezone':'UTC','forecast_days':14,'daily':'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,et0_fao_evapotranspiration'})
        response.raise_for_status()
    raw=response.json();d=raw['daily'];days=[]
    for i,time in enumerate(d['time']):
        values={k:d[k][i] for k in d if k!='time'};valid=all(v is not None for v in values.values());days.append({'date':time,**values,'available':valid,'risks':(['frost'] if valid and values['temperature_2m_min']<=0 else [])+(['heat'] if valid and values['temperature_2m_max']>=32 else [])+(['wind'] if valid and values['wind_speed_10m_max']>=36 else [])})
    result={'days':days,'source':'ECMWF IFS 0.25° / Open-Meteo','kind':'forecast','fetched_at':datetime.now(timezone.utc).isoformat(),'attribution_url':'https://open-meteo.com/en/docs/ecmwf-api','grid_latitude':raw['latitude'],'grid_longitude':raw['longitude'],'note':'UTC. Регіональний прогноз, не вимірювання в зоні поля. Пороги: мороз ≤0°C, спека ≥32°C, вітер ≥36 км/год; це сигнали для перевірки, не діагноз хвороб. Невизначеність зростає з горизонтом.'}
    if len(_cache)>100:_cache.clear()
    _cache[key]=result;return result


async def fetch_weather_detail(latitude, longitude):
    """72 h hourly + 14 day outlook for field operations, plus links to real cloud imagery (NASA GIBS true colour)."""
    from datetime import timedelta
    key = ('detail', round(latitude, 4), round(longitude, 4)); cached = _cache.get(key)
    if cached and (datetime.now(timezone.utc) - datetime.fromisoformat(cached['fetched_at'])).total_seconds() < 1800: return cached
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get('https://api.open-meteo.com/v1/forecast', params={'latitude': latitude, 'longitude': longitude, 'timezone': 'auto', 'forecast_days': 14,
            'hourly': 'temperature_2m,relative_humidity_2m,precipitation,precipitation_probability,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,soil_temperature_6cm,soil_moisture_3_to_9cm,et0_fao_evapotranspiration',
            'daily': 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,sunshine_duration,et0_fao_evapotranspiration'})
        r.raise_for_status()
    raw = r.json(); h = raw['hourly']; d = raw['daily']
    now_local = (datetime.now(timezone.utc) + timedelta(seconds=raw.get('utc_offset_seconds', 0))).strftime('%Y-%m-%dT%H:00')
    start = next((i for i, t in enumerate(h['time']) if t >= now_local), 0)
    hours = [{k: h[k][i] for k in h} for i in range(start, min(start + 72, len(h['time'])))]
    days = []
    for i, t in enumerate(d['time']):
        v = {k: d[k][i] for k in d}
        ok = all(x is not None for x in v.values())
        spray = ok and v['wind_speed_10m_max'] < 15 and (v['precipitation_sum'] or 0) < 1
        days.append({**v, 'date': t, 'spray_window': spray, 'frost': ok and v['temperature_2m_min'] <= 0, 'heat': ok and v['temperature_2m_max'] >= 32, 'storm': ok and (v['wind_gusts_10m_max'] or 0) >= 50})
    today = datetime.now(timezone.utc).date(); span_lat, span_lon = 1.2, 1.8
    bbox = [round(latitude - span_lat, 3), round(longitude - span_lon, 3), round(latitude + span_lat, 3), round(longitude + span_lon, 3)]
    def wms(layer, day): return ('https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&FORMAT=image/jpeg&CRS=EPSG:4326'
                                 f'&LAYERS={layer}&STYLES=&WIDTH=720&HEIGHT=480&BBOX={",".join(map(str, bbox))}&TIME={day}')
    frames = [{'date': (today - timedelta(days=k)).isoformat(), 'terra': wms('MODIS_Terra_CorrectedReflectance_TrueColor', (today - timedelta(days=k)).isoformat()),
               'viirs': wms('VIIRS_NOAA20_CorrectedReflectance_TrueColor', (today - timedelta(days=k)).isoformat())} for k in range(5, 0, -1)]
    result = {'timezone': raw.get('timezone'), 'utc_offset_seconds': raw.get('utc_offset_seconds', 0), 'hours': hours, 'days': days, 'cloud_frames': frames, 'bbox': bbox, 'field': [longitude, latitude],
              'source': 'Open-Meteo (ECMWF / DWD ICON / GFS best match)', 'imagery': 'NASA GIBS · MODIS Terra / VIIRS NOAA-20 true colour', 'fetched_at': datetime.now(timezone.utc).isoformat()}
    _cache[key] = result; return result
