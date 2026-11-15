import json
from pathlib import Path
from datetime import datetime,timezone,timedelta
import asyncio,time
import httpx
NORAD=[40376,39574,39084,49260,25994,43013,40697,25544,37849,42063,39634,60989]
_cache={}
def tle_epoch(line):
    text=line[18:32];year=int(text[:2]);year+=2000 if year<57 else 1900
    return datetime(year,1,1,tzinfo=timezone.utc)+timedelta(days=float(text[2:])-1)

_DISK=Path(__file__).resolve().parents[1]/'data/fleet_tle_cache.json'
async def tle_lines(client,norad):
    """CelesTrak first; SatNOGS (Space-Track data) and the TLE API as fallbacks when CelesTrak rate-limits us."""
    try:
        r=await client.get('https://celestrak.org/NORAD/elements/gp.php',params={'CATNR':norad,'FORMAT':'TLE'})
        if r.status_code==200 and '1 ' in r.text:
            return [x.strip() for x in r.text.strip().splitlines() if x.strip()]
    except httpx.HTTPError:pass
    try:
        r=await client.get('https://db.satnogs.org/api/tle/',params={'norad_cat_id':norad,'format':'json'})
        if r.status_code==200 and r.json():
            t=r.json()[0];return [t['tle0'].removeprefix('0 ').strip(),t['tle1'].strip(),t['tle2'].strip()]
    except (httpx.HTTPError,ValueError,KeyError,IndexError):pass
    r=await client.get(f'https://tle.ivanstanojevic.me/api/tle/{norad}');r.raise_for_status();t=r.json()
    return [t['name'],t['line1'],t['line2']]

async def _fetch_catalog():
    semaphore=asyncio.Semaphore(3)
    async with httpx.AsyncClient(timeout=18,headers={'User-Agent':'AGROSAS-OS educational satellite viewer'}) as client:
        async def fetch(norad):
            async with semaphore:
                try:
                    lines=await tle_lines(client,norad)
                    line1=next(x for x in lines if x.startswith('1 '));line2=next(x for x in lines if x.startswith('2 '));epoch=tle_epoch(line1)
                    if int(line1[2:7])!=norad:raise ValueError('Unexpected catalog id')
                    return {'norad_id':norad,'name':lines[0] if not lines[0].startswith('1 ') else str(norad),'line1':line1,'line2':line2,'epoch':epoch.isoformat(),'age_hours':round((datetime.now(timezone.utc)-epoch).total_seconds()/3600,1),'source':'CelesTrak GP / SGP4','source_url':f'https://celestrak.org/NORAD/elements/gp.php?CATNR={norad}&FORMAT=TLE','fetched_at':datetime.now(timezone.utc).isoformat()}
                except Exception:return {'norad_id':norad,'unavailable':True,'source':'CelesTrak GP','note':'Орбітальні елементи недоступні; випадкова орбіта не підставляється.'}
        records=await asyncio.gather(*(fetch(n) for n in NORAD))
        previous={r['norad_id']:r for r in _cache.get('data',{}).get('records',[]) if not r.get('unavailable')}
        records=[previous.get(r['norad_id'],r) if r.get('unavailable') else r for r in records]
        data={'records':records,'time_basis':'UTC; propagated SGP4 position, not live video or confirmed overpass acquisition'}
    good={r['norad_id']:r for r in data['records'] if not r.get('unavailable')}
    try:disk={int(k):v for k,v in json.loads(_DISK.read_text()).items()} if _DISK.exists() else {}
    except (OSError,ValueError):disk={}
    data['records']=[disk.get(r['norad_id'],r) if r.get('unavailable') else r for r in data['records']]
    if good:
        try:disk.update(good);_DISK.write_text(json.dumps(disk))
        except OSError:pass  # read-only image: the bundled copy still serves as fallback
    _cache.update(time=time.monotonic(),data=data);return data


_starlink={}
_STARLINK_FILE='/tmp/agrosas-starlink.txt'
def _parse_tle(text):
    lines=[x.rstrip() for x in text.splitlines() if x.strip()];sats=[]
    for i in range(0,len(lines)-2,3):
        name,l1,l2=lines[i].strip(),lines[i+1],lines[i+2]
        if l1.startswith('1 ') and l2.startswith('2 '):sats.append({'name':name,'norad_id':int(l1[2:7]),'line1':l1,'line2':l2,'epoch':tle_epoch(l1).isoformat()})
    return sats
async def _fetch_starlink(limit=160):
    """Real Starlink elements: CelesTrak GP group, then CelesTrak supplemental (SpaceX ephemerides), then the last good copy on disk.
    CelesTrak answers 403 when the group has not changed since our last download (it updates every 2 h) — the disk copy covers that."""
    import os
    text,source=None,None
    skip_live=_starlink.get('failed',0)+1800>time.monotonic()  # CelesTrak blocked recently: answer from the saved copy at once
    async with httpx.AsyncClient(timeout=12,headers={'User-Agent':'AGROSAS-OS educational satellite viewer'}) as client:
        for url,params,name in [('https://celestrak.org/NORAD/elements/gp.php',{'GROUP':'starlink','FORMAT':'TLE'},'CelesTrak GP group=starlink'),
                                ('https://celestrak.org/NORAD/elements/supplemental/sup-gp.php',{'FILE':'starlink','FORMAT':'tle'},'CelesTrak supplemental (SpaceX ephemerides)'),
                                ('https://celestrak.org/NORAD/elements/gp.php',{'NAME':'STARLINK-3','FORMAT':'TLE'},'CelesTrak GP name=STARLINK-3*')]:
            if skip_live:break
            try:
                r=await client.get(url,params=params)
                if r.status_code==200 and r.text.count('\n')>100:text,source=r.text,name;break
                if r.status_code==403:break  # rate-limited: other CelesTrak URLs will refuse too
            except httpx.HTTPError:continue
    if not text:_starlink['failed']=time.monotonic()
    if text:
        try:open(_STARLINK_FILE,'w').write(text)
        except OSError:pass
    elif os.path.exists(_STARLINK_FILE):text,source=open(_STARLINK_FILE).read(),'CelesTrak (cached copy)'
    else:
        from pathlib import Path
        snap=Path(__file__).resolve().parents[1]/'data/starlink_snapshot.tle'
        if snap.exists():text,source=snap.read_text(),'CelesTrak GP snapshot 2026-11-14 (SGP4 drift grows with age)'
    if not text:raise RuntimeError('Starlink elements unavailable')
    sats=_parse_tle(text);step=max(1,len(sats)//limit)
    # The bundled/cached copy may be a thinned sample; report the size of the last full live catalog instead of the sample size.
    meta_file=Path(__file__).resolve().parents[1]/'data/starlink_catalog_meta.json'
    live=source.startswith('CelesTrak GP group') or source.startswith('CelesTrak supplemental') or source.startswith('CelesTrak GP name')
    try:meta=json.loads(meta_file.read_text())
    except (OSError,ValueError):meta={'total':7565,'as_of':'2026-11-14'}
    if live and len(sats)>1000:
        meta={'total':len(sats),'as_of':datetime.now(timezone.utc).date().isoformat()}
        try:meta_file.write_text(json.dumps(meta))
        except OSError:pass
    total,as_of=(len(sats),None) if live and len(sats)>1000 else (meta['total'],meta['as_of'])
    data={'total':total,'total_as_of':as_of,'tracked':len(sats[::step][:limit]),'records':sats[::step][:limit],'source':source,'fetched_at':datetime.now(timezone.utc).isoformat()}
    _starlink.update(time=time.monotonic(),data=data);return data


_tasks:dict={}
def _refresh(name,coro_fn):
    t=_tasks.get(name)
    if t is None or t.done():_tasks[name]=asyncio.create_task(coro_fn())

async def orbit_catalog():
    """Stale-while-revalidate: answer instantly from memory or the saved copy, refresh from the network in the background."""
    if 'data' in _cache and _cache['time']+3600>time.monotonic():return _cache['data']
    if 'data' in _cache:_refresh('fleet',_fetch_catalog);return _cache['data']
    try:disk={int(k):v for k,v in json.loads(_DISK.read_text()).items()} if _DISK.exists() else {}
    except (OSError,ValueError):disk={}
    if len(disk)>=len(NORAD)//2:
        recs=[disk.get(n,{'norad_id':n,'unavailable':True,'source':'CelesTrak GP','note':'Орбітальні елементи недоступні; випадкова орбіта не підставляється.'}) for n in NORAD]
        _cache.update(time=time.monotonic()-3600,data={'records':recs,'time_basis':'UTC; propagated SGP4 position, not live video or confirmed overpass acquisition'})
        _refresh('fleet',_fetch_catalog);return _cache['data']
    return await _fetch_catalog()

async def starlink_sample(limit=160):
    if 'data' in _starlink and _starlink['time']+2*3600>time.monotonic():return _starlink['data']
    if 'data' in _starlink:_refresh('starlink',_fetch_starlink);return _starlink['data']
    _starlink['failed']=time.monotonic()  # first answer from the saved copy immediately
    data=await _fetch_starlink(limit);_starlink.pop('failed',None);_starlink['time']=time.monotonic()-2*3600
    _refresh('starlink',_fetch_starlink);return data
