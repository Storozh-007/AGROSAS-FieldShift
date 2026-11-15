"""NASA GIBS visualizations. They are browse imagery, not local numeric measurements."""
import base64,io,json,re,calendar,time
from pathlib import Path
from datetime import date,timedelta
import httpx
from PIL import Image,ImageDraw
from shapely.geometry import shape

LAYERS=json.loads((Path(__file__).resolve().parents[1]/'data/gibs_layers.json').read_text())

def available_date(layer,requested:date|None):
    if not layer['latest']:return None
    target=min(requested or date.fromisoformat(layer['latest'][:10]),date.fromisoformat(layer['latest'][:10]));candidates=[]
    for value in layer['periods']:
        parts=value.split('/');start=date.fromisoformat(parts[0][:10])
        if start>target:continue
        if len(parts)<3:candidates.append(start);continue
        end=min(target,date.fromisoformat(parts[1][:10]));step=parts[2]
        if step.endswith('D'):
            days=max(1,int(re.search(r'P(\d+)D',step)[1]));candidates.append(start+timedelta(days=((end-start).days//days)*days))
        elif step.endswith('M') or step.endswith('Y'):
            months=int(re.search(r'P(\d+)',step)[1])*(12 if step.endswith('Y') else 1);diff=(end.year-start.year)*12+end.month-start.month;count=max(0,diff//months);idx=start.year*12+start.month-1+count*months;candidate=date(idx//12,idx%12+1,min(start.day,calendar.monthrange(idx//12,idx%12+1)[1]));
            if candidate>end:
                idx-=months;candidate=date(idx//12,idx%12+1,min(start.day,calendar.monthrange(idx//12,idx%12+1)[1]))
            if candidate>=start:candidates.append(candidate)
        else:candidates.append(start)
    if not candidates:raise ValueError('No advertised acquisition before the selected date')
    return max(candidates).isoformat()

def layer_catalog():return {'layers':LAYERS,'provider':'NASA EOSDIS GIBS','metadata_checked_at':'2026-11-13','note':'Дати беруться з опублікованих інтервалів GIBS. Порожні ділянки означають відсутність даних; колір не є локальним числовим вимірюванням.'}

_cache={}
async def field_overlay(geometry,layer_id,requested=None):
    layer=next((l for l in LAYERS if l['id']==layer_id),None)
    if not layer:raise ValueError('Unknown layer')
    selected=available_date(layer,requested);bounds=shape(geometry).bounds;key=(layer_id,selected,shape(geometry).wkb_hex)
    if key in _cache and time.monotonic()-_cache[key][0]<1800:return _cache[key][1]
    params={'SERVICE':'WMS','VERSION':'1.1.1','REQUEST':'GetMap','LAYERS':layer['product'],'STYLES':'','FORMAT':'image/png','SRS':'EPSG:4326','WIDTH':256,'HEIGHT':256,'BBOX':','.join(map(str,bounds)),'TRANSPARENT':'TRUE'}
    if selected:params['TIME']=selected
    async with httpx.AsyncClient(timeout=40) as client:
        response=await client.get('https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi',params=params);response.raise_for_status()
    image=Image.open(io.BytesIO(response.content)).convert('RGBA');left,bottom,right,top=bounds
    mask=Image.new('L',image.size,0);draw=ImageDraw.Draw(mask);points=[((x-left)/(right-left)*image.width,(top-y)/(top-bottom)*image.height) for x,y in geometry['coordinates'][0]];draw.polygon(points,fill=255)
    for ring in geometry['coordinates'][1:]:draw.polygon([((x-left)/(right-left)*image.width,(top-y)/(top-bottom)*image.height) for x,y in ring],fill=0)
    import numpy as np
    array=np.array(image);alpha=np.array(mask);array[:,:,3]=np.minimum(array[:,:,3],alpha);valid=int((array[:,:,3]>0).sum());inside=max(1,int((alpha>0).sum()));buffer=io.BytesIO();Image.fromarray(array).save(buffer,format='PNG')
    result={**layer,'date':selected,'requested_date':requested.isoformat() if requested else None,'coordinates':[[left,top],[right,top],[right,bottom],[left,bottom]],'image':'data:image/png;base64,'+base64.b64encode(buffer.getvalue()).decode(),'valid_fraction':round(valid/inside,3),'no_data':valid==0,'method':'NASA GIBS WMS visualization clipped to user boundary; native resolution retained in metadata','is_demo':False}
    if len(_cache)>50:_cache.clear()
    _cache[key]=(time.monotonic(),result);return result

_metadata_time=0
async def refresh_catalog():
    global _metadata_time
    if time.monotonic()-_metadata_time<21600:return layer_catalog()
    import xml.etree.ElementTree as ET
    ns={'w':'http://www.opengis.net/wmts/1.0','o':'http://www.opengis.net/ows/1.1'}
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            response=await client.get('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml');response.raise_for_status()
        tree=ET.fromstring(response.content);items={l.findtext('o:Identifier',namespaces=ns):l for l in tree.findall('.//w:Layer',ns)}
        for layer in LAYERS:
            item=items.get(layer['product'])
            if item is None:continue
            dimension=item.find('w:Dimension',ns)
            if dimension is not None:
                layer['latest']=dimension.findtext('w:Default',namespaces=ns);layer['periods']=[v.text for v in dimension.findall('w:Value',ns)]
            layer['metadata_checked_at']=date.today().isoformat()
        _metadata_time=time.monotonic()
        result=layer_catalog();result['catalog_source']='live_gibs_capabilities';return result
    except Exception:
        result=layer_catalog();result['catalog_source']='bundled_snapshot';result['note']+=' Метадані зі збереженого знімка; онлайн-оновлення недоступне.';return result
