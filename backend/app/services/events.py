"""Official feed summaries and polygon-based NWS exposure. No invented field impact."""
import asyncio,html,re,time,xml.etree.ElementTree as ET
from datetime import datetime,timezone
import httpx
from shapely.geometry import shape
_cache={}
async def official_events(fields, countries=None):
    if _cache.get('time',0)+600>time.monotonic():raw=_cache['data']
    else:
        async with httpx.AsyncClient(timeout=25,headers={'User-Agent':'AGROSAS-OS research prototype; local farm event viewer','Accept':'application/geo+json, application/xml'}) as client:
            results=await asyncio.gather(client.get('https://api.weather.gov/alerts/active'),client.get('https://www.nasa.gov/feed/'),return_exceptions=True)
        alerts=[];news=[];errors=[]
        nws,rss=results
        if isinstance(nws,Exception) or nws.status_code!=200:errors.append('NWS alerts unavailable')
        else:alerts=nws.json().get('features',[])
        if isinstance(rss,Exception) or rss.status_code!=200:errors.append('NASA news feed unavailable')
        else:
            try:
                for item in ET.fromstring(rss.content).findall('.//item')[:12]:
                    description=html.unescape(re.sub('<[^>]+>',' ',item.findtext('description','')))
                    news.append({'id':item.findtext('guid') or item.findtext('link'),'title':item.findtext('title'),'url':item.findtext('link'),'published_at':item.findtext('pubDate'),'summary':description[:350],'source':'NASA News','kind':'news','impact':'Не оцінено: новина не містить перевіреної геометрії впливу на поле.'})
            except ET.ParseError:errors.append('NASA feed parse error')
        raw={'alerts':alerts,'news':news,'errors':errors,'fetched_at':datetime.now(timezone.utc).isoformat()};_cache.update(time=time.monotonic(),data=raw)
    exposures=[]
    for alert in raw['alerts']:
        geometry=alert.get('geometry');p=alert.get('properties',{});matched=[]
        if geometry:
            try:
                zone=shape(geometry)
                for field in fields:
                    if zone.intersects(field['geometry']):matched.append(field['id'])
            except Exception:continue
        if matched:exposures.append({'id':alert['id'],'title':p.get('headline') or p.get('event'),'event':p.get('event'),'severity':p.get('severity'),'certainty':p.get('certainty'),'effective':p.get('effective'),'expires':p.get('expires'),'description':p.get('description','')[:1000],'instruction':p.get('instruction'),'field_ids':matched,'url':p.get('web') or alert['id'],'source':'NOAA / National Weather Service','kind':'official_alert','match':'Перетин геометрії поля з полігоном попередження'})
    from app.services.news import fetch_news
    try: news = await fetch_news(countries or set())
    except Exception: news = raw['news']
    return {'news':news,'news_refreshed_at':datetime.now(timezone.utc).isoformat(),'alerts':exposures,'errors':raw['errors'],'fetched_at':raw['fetched_at'],'alerts_total':len(raw['alerts']),'alerts_without_geometry':sum(1 for a in raw['alerts'] if not a.get('geometry')),'coverage_note':'Попередження NWS стосуються США. Відсутність збігу не є гарантією безпеки: частина повідомлень не має полігона. Для Європи й України тут немає підключеного джерела оперативних попереджень.'}
