"""NASA news feed for farmers: topic, relevance to fields and a concrete farm angle for every item."""
import asyncio, html, re, time, xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import httpx

FEEDS = [('https://earthobservatory.nasa.gov/feeds/image-of-the-day.rss', 'NASA Earth Observatory'), ('https://www.nasa.gov/feed/', 'NASA News')]
CONTENT = '{http://purl.org/rss/1.0/modules/content/}encoded'
# topic: (keywords, relevance 0..3, label, farm angle, link to the app)
TOPICS = {
 'drought': (['drought', 'dry', 'aridity', 'water scarcity', 'heatwave', 'heat wave', 'evapotranspiration', 'soil moisture', 'reservoir'], 3, 'Посуха і вода',
             'Нестача води — головна загроза врожаю. Порівняйте з водним балансом вашого поля та трендом посухи за 30 років.', ('/climate', 'Клімат поля')),
 'agriculture': (['crop', 'farm', 'agricultur', 'harvest', 'wheat', 'corn', 'maize', 'soybean', 'rice', 'irrigat', 'food security', 'cropland', 'grain'], 3, 'Сільське господарство',
                 'Прямо про врожай і поля — ті самі супутникові дані, що й у вашій моделі сівозміни.', ('/analysis', 'Модель сівозміни')),
 'flood': (['flood', 'storm', 'hurricane', 'typhoon', 'cyclone', 'heavy rain', 'rainfall', 'precipitation', 'monsoon', 'snow'], 2, 'Опади, зливи, повені',
           'Зливи змивають ґрунт і заливають низини. Перевірте зони перезволоження та ерозії на своєму полі.', ('/farm-lab#zones', 'Зони поля')),
 'fire': (['fire', 'wildfire', 'smoke', 'burn'], 2, 'Пожежі й дим', 'Дим знижує сонячну радіацію, а пожежі — загроза стерні. Подивіться шар NBR у спостереженнях поля.', ('/farm-lab#evidence', 'Знімки поля')),
 'climate': (['climate', 'temperature', 'warming', 'heat', 'el niño', 'el nino', 'la niña', 'sea surface temperature', 'ozone', 'aerosol'], 2, 'Клімат і температура',
             'Зміна клімату зсуває строки сівби й підвищує ризик спеки в цвітіння. Перевірте тренд свого поля.', ('/climate', 'Машина часу клімату')),
 'land': (['soil', 'land cover', 'erosion', 'dust', 'sediment', 'land use', 'desert'], 2, 'Ґрунт і ландшафт', 'Ґрунт і ерозія визначають, яку сівозміну витримає поле.', ('/farm-lab#zones', 'Ерозія на полі')),
 'vegetation': (['vegetation', 'forest', 'mangrove', 'green', 'bloom', 'ndvi', 'plant', 'tree', 'peat'], 1, 'Рослинність',
                'Той самий принцип, що й NDVI вашого поля: супутник бачить біомасу з космосу.', ('/farm-lab#evidence', 'NDVI поля')),
 'water': (['river', 'lake', 'water', 'glacier', 'ice', 'aquifer', 'groundwater', 'grace'], 1, 'Вода на планеті', 'Запаси прісної води визначають, чи буде вода для поливу через роки.', ('/climate', 'Водний баланс')),
 'weather': (['cloud', 'fog', 'weather', 'aurora', 'wind'], 1, 'Погода й атмосфера', 'Хмари й туман впливають на роботи в полі та якість супутникових знімків.', ('/farm-lab#weather', 'Погода поля')),
}
SATS = {'landsat 8': 'landsat8', 'landsat 9': 'landsat9', 'landsat': 'landsat9', 'terra': 'terra', 'modis': 'terra', 'smap': 'smap', 'gpm': 'gpm', 'imerg': 'gpm', 'ecostress': 'ecostress',
        'gedi': 'gedi', 'viirs': 'viirs', 'noaa-20': 'viirs', 'noaa-21': 'viirs', 'suomi': 'viirs', 'sentinel': 'sentinel2', 'iss': 'iss', 'space station': 'iss'}
REGIONS = {'USA': ['united states', 'midwest', 'iowa', 'nebraska', 'kansas', 'illinois', 'minnesota', 'texas', 'california', 'dakota', 'great plains', 'mississippi', 'colorado', 'new mexico', 'arizona'],
           'UA': ['ukraine', 'black sea', 'dnipro', 'eastern europe'], 'FR': ['france', 'europe'], 'DE': ['germany', 'europe']}
SPACE = ['galaxy', 'nebula', 'star', 'moon', 'mars', 'jupiter', 'asteroid', 'comet', 'artemis', 'astronaut', 'telescope', 'hubble', 'webb', 'roman', 'exoplanet', 'apod', 'solar', 'sun', 'saturn', 'venus', 'black hole', 'launch', 'rocket']
_cache: dict = {}


CAT_TOPIC = {'drought': 'drought', 'heat': 'climate', 'agriculture': 'agriculture', 'crops': 'agriculture', 'floods': 'flood', 'severe storms': 'flood', 'snow': 'flood', 'fires': 'fire', 'land cover': 'land',
             'dust and haze': 'land', 'vegetation': 'vegetation', 'surface water': 'water', 'water': 'water', 'clouds': 'weather', 'atmosphere': 'weather', 'temperature extremes': 'climate'}


def words(text, kws):
    return sum(len(re.findall(r'(?<![\w])' + re.escape(k), text)) for k in kws)


def classify(title, summary, cats):
    t = f'{title} {summary}'.lower(); cl = [c.lower() for c in cats]
    score = {key: words(t, kw) * (2 if words(title.lower(), kw) else 1) for key, (kw, *_r) in TOPICS.items()}
    for c in cl:
        if c in CAT_TOPIC: score[CAT_TOPIC[c]] = score.get(CAT_TOPIC[c], 0) + 3
    best = max(score, key=lambda k: (score[k], TOPICS[k][1]))
    space = words(t, SPACE) * 2 + (2 if not any(c in CAT_TOPIC or 'earth' in c for c in cl) else 0)
    if score[best] == 0 or space > score[best] * 2: return None, 0
    return best, TOPICS[best][1]


async def fetch_news(field_countries: set[str], limit=24):
    if 'data' in _cache and _cache['t'] + 900 > time.monotonic(): items = _cache['data']
    else:
        items = []
        async with httpx.AsyncClient(timeout=20, follow_redirects=True, headers={'User-Agent': 'AGROSAS-OS news reader'}) as client:
            res = await asyncio.gather(*(client.get(u) for u, _ in FEEDS), return_exceptions=True)
        for (url, source), r in zip(FEEDS, res):
            if isinstance(r, Exception) or r.status_code != 200: continue
            text = re.sub(r'"xmlns:', '" xmlns:', r.text)  # NASA feed ships attributes without a separating space
            try: root = ET.fromstring(text.encode())
            except ET.ParseError: continue
            for it in root.findall('.//item'):
                desc = html.unescape(re.sub('<[^>]+>', ' ', it.findtext('description', ''))).strip()
                enc = it.find(CONTENT); body = enc.text if enc is not None and enc.text else ''
                img = re.search(r'<img[^>]+src="([^"]+)"', body); cats = [c.text or '' for c in it.findall('category')]
                try: published = parsedate_to_datetime(it.findtext('pubDate')).astimezone(timezone.utc).isoformat()
                except Exception: published = None
                items.append({'id': it.findtext('guid') or it.findtext('link'), 'title': html.unescape(it.findtext('title') or ''), 'url': it.findtext('link'), 'published_at': published,
                              'summary': re.sub(r'\s+', ' ', desc)[:320], 'image': html.unescape(img.group(1)) if img else None, 'source': source, 'categories': cats, 'text': (desc + ' ' + re.sub('<[^>]+>', ' ', body))[:4000]})
        seen = set(); items = [x for x in items if not (x['title'].lower() in seen or seen.add(x['title'].lower()))]
        _cache.update(t=time.monotonic(), data=items)
    out = []
    for x in items:
        topic, rel = classify(x['title'], x['summary'], x['categories']); low = f"{x['title']} {x['summary']}".lower()
        regions = [c for c in field_countries if words(low, REGIONS.get(c, []))]
        sats = sorted({v for k, v in SATS.items() if words(low, [k]) or any(k in c.lower() for c in x['categories'])})
        if regions and rel: rel = min(3, rel + 1)
        meta = TOPICS.get(topic)
        out.append({k: v for k, v in x.items() if k != 'text'} | {'topic': topic, 'topic_label': meta[2] if meta else 'Космос і наука', 'relevance': rel,
                   'relevance_label': ['Космос і наука', 'Корисний контекст', 'Корисно фермеру', 'Пряма користь фермеру'][rel],
                   'farm_angle': meta[3] if meta else 'Не про поле напряму — але це ті самі агентства й ракети, що виводять супутники для вашої ферми.',
                   'action': {'href': meta[4][0], 'label': meta[4][1]} if meta else {'href': '/missions', 'label': 'Супутники NASA'},
                   'regions': regions, 'satellites': sats})
    out.sort(key=lambda x: (-x['relevance'], x['published_at'] or ''), reverse=False)
    out.sort(key=lambda x: (x['relevance'] > 0, x['relevance'] >= 2, x['published_at'] or ''), reverse=True)
    return out[:limit]
