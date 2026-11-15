"""Public Sentinel-2 L2A COGs; actual per-pixel reflectance and SCL quality masking."""
import base64
import io
import math
from urllib.parse import urlparse
import httpx
import numpy as np
from shapely.geometry import shape

STAC='https://earth-search.aws.element84.com/v1/search'
async def scene_catalog(geometry,start,end):
    async with httpx.AsyncClient(timeout=30) as client:
        r=await client.post(STAC,json={'collections':['sentinel-2-l2a'],'intersects':geometry,'datetime':f'{start}T00:00:00Z/{end}T23:59:59Z','limit':80,'sortby':[{'field':'properties.datetime','direction':'desc'}],'query':{'eo:cloud_cover':{'lt':60}}})
        r.raise_for_status()
    return r.json().get('features',[])

def catalog_summary(item):
    return {'id':item['id'],'date':item['properties']['datetime'],'cloud_pct':item['properties'].get('eo:cloud_cover'),'source':'Copernicus Sentinel-2 L2A / Earth Search','resolution_m':10,'url':next((x['href'] for x in item.get('links',[]) if x['rel']=='self'),None)}

def calculate_raster(item,geometry,index='NDVI'):
    import rasterio
    from rasterio.vrt import WarpedVRT
    from rasterio.transform import from_bounds
    from rasterio.features import geometry_mask
    from rasterio.enums import Resampling
    from PIL import Image
    bounds=shape(geometry).bounds;left,bottom,right,top=bounds
    metres_x=(right-left)*111320*math.cos((bottom+top)/2*math.pi/180);metres_y=(top-bottom)*111320
    width=max(2,min(512,math.ceil(metres_x/10)));height=max(2,min(512,math.ceil(metres_y/10)));transform=from_bounds(*bounds,width,height)
    spec=INDEX_SPECS[index];resolution=spec['resolution_m'];width=max(2,min(512,math.ceil(metres_x/resolution)));height=max(2,min(512,math.ceil(metres_y/resolution)));transform=from_bounds(*bounds,width,height)
    arrays={};raw_valid=None
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR',CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif',GDAL_HTTP_TIMEOUT='20',GDAL_HTTP_MAX_RETRY='1'):
        for band in [*spec['bands'],'scl']:
            asset=item['assets'][band];href=asset['href'];parsed=urlparse(href)
            if parsed.scheme!='https' or parsed.hostname!='sentinel-cogs.s3.us-west-2.amazonaws.com':raise ValueError('Unsupported raster asset host')
            with rasterio.open(href) as source, WarpedVRT(source,crs='EPSG:4326',transform=transform,width=width,height=height,resampling=Resampling.nearest) as vrt:
                raw=vrt.read(1);arrays[band]=raw
            if band!='scl':
                valid=raw!=0;raw_valid=valid if raw_valid is None else raw_valid&valid
                meta=asset.get('raster:bands',[{}])[0];scale=meta.get('scale',.0001);flag=item['properties'].get('earthsearch:boa_offset_applied')
                if flag is None:raise ValueError('Missing BOA offset provenance; cannot safely derive reflectance')
                offset=0 if flag else -1000*scale
                arrays[band]=raw.astype('float32')*scale+offset
    inside=geometry_mask([geometry],out_shape=(height,width),transform=transform,invert=True)
    values=index_values(index,arrays);valid=inside&raw_valid&np.isin(arrays['scl'],[4,5,6])&np.isfinite(values)
    for band in spec['bands']:valid&=arrays[band]>=0
    if not valid.any():raise ValueError('No clear field pixels in this scene')
    ndvi=values
    palettes={'NDMI':[[140,81,10],[216,179,101],[246,232,195],[199,234,229],[90,180,172],[1,102,94]],'NDRE':[[120,40,90],[200,90,120],[240,170,110],[230,230,140],[120,200,110],[30,120,60]],'NDWI':[[140,81,10],[216,179,101],[246,232,195],[160,200,240],[70,130,220],[20,60,160]]}
    colors=np.array(palettes.get(index,[[133,68,55],[214,146,69],[239,211,100],[154,191,76],[47,137,70],[15,83,57]]),dtype=np.uint8)
    # Stretch to this field's own 5–95th percentiles so within-field differences are visible; absolute values stay in the numbers.
    lo,hi=(np.percentile(ndvi[valid],5),np.percentile(ndvi[valid],95)) if valid.sum()>10 else spec['range']
    if hi-lo<.04:mid=(hi+lo)/2;lo,hi=mid-.02,mid+.02
    display=np.nan_to_num(ndvi,nan=lo,posinf=hi,neginf=lo);indices=np.clip(((display-lo)/(hi-lo)*5.999).astype(int),0,5);rgba=np.zeros((height,width,4),dtype=np.uint8);rgba[:,:,:3]=colors[indices];rgba[:,:,3]=np.where(valid,210,0)
    buffer=io.BytesIO();Image.fromarray(rgba).save(buffer,format='PNG')
    annotations=[];candidates=np.argwhere(valid&(ndvi<.35)) if index=='NDVI' else [];chosen=[]
    if len(candidates):
        for candidate_index in np.argsort(ndvi[candidates[:,0],candidates[:,1]]):
            row,col=map(int,candidates[candidate_index])
            if any((row-r)**2+(col-c)**2<max(4,min(width,height)/5)**2 for r,c in chosen):continue
            chosen.append((row,col));longitude,latitude=transform*(col+.5,row+.5);annotations.append({'longitude':longitude,'latitude':latitude,'title':'Нижчий NDVI · перевірити','value':round(float(ndvi[row,col]),3)})
            if len(annotations)>=3:break
    return {**catalog_summary(item),'display_v':2,'display_range':[round(float(lo),3),round(float(hi),3)],'index':index,'index_name':spec['name'],'range':spec['range'],'grid':{'width':width,'height':height,'bounds':list(bounds),'values':[[round(float(ndvi[r,c]),4) if valid[r,c] else None for c in range(width)] for r in range(height)]},'value_mean':round(float(ndvi[valid].mean()),4),'value_p10':round(float(np.percentile(ndvi[valid],10)),4),'value_p90':round(float(np.percentile(ndvi[valid],90)),4),'annotations':annotations,'ndvi_mean':round(float(ndvi[valid].mean()),4),'ndvi_min':round(float(ndvi[valid].min()),4),'ndvi_max':round(float(ndvi[valid].max()),4),'valid_fraction':round(float(valid.sum()/max(1,inside.sum())),3),'sample_count':int(valid.sum()),'native_resolution_m':resolution,'display_cell_m':round(max(metres_x/width,metres_y/height),1),'coordinates':[[left,top],[right,top],[right,bottom],[left,bottom]],'image':'data:image/png;base64,'+base64.b64encode(buffer.getvalue()).decode(),'is_demo':False,'quality':'SCL 4/5/6; cloud, shadow, snow and nodata excluded','method':spec['formula']+'; BOA offset applied once using provider item flag; no gap filling','attribution':f"Contains modified Copernicus Sentinel data {item['properties']['datetime'][:4]}",'boa_offset_applied_upstream':item['properties'].get('earthsearch:boa_offset_applied')}

INDEX_SPECS={
 'NDVI':{'name':'Рослинність','bands':['nir','red'],'resolution_m':10,'range':[-.2,1],'formula':'(NIR-Red)/(NIR+Red)'},
 'NDMI':{'name':'Вода у рослинному покриві','bands':['nir','swir16'],'resolution_m':20,'range':[-1,1],'formula':'(NIR-SWIR1)/(NIR+SWIR1)'},
 'NDRE':{'name':'Червоний край','bands':['nir08','rededge1'],'resolution_m':20,'range':[-.2,1],'formula':'(NIR narrow-RE1)/(NIR narrow+RE1)'},
 'RECI':{'name':'Хлорофіл · red edge','bands':['nir08','rededge1'],'resolution_m':20,'range':[0,8],'formula':'NIR narrow/RE1-1'},
 'GCI':{'name':'Хлорофіл · зелений канал','bands':['nir','green'],'resolution_m':10,'range':[0,8],'formula':'NIR/Green-1'},
 'EVI':{'name':'Посилений індекс рослинності','bands':['nir','red','blue'],'resolution_m':10,'range':[-.2,1],'formula':'2.5*(NIR-Red)/(NIR+6*Red-7.5*Blue+1)'},
 'SAVI':{'name':'Поправка на ґрунтовий фон','bands':['nir','red'],'resolution_m':10,'range':[-.2,1],'formula':'1.5*(NIR-Red)/(NIR+Red+0.5)'},
 'MSAVI':{'name':'Рідкий рослинний покрив','bands':['nir','red'],'resolution_m':10,'range':[-.2,1],'formula':'(2*NIR+1-sqrt((2*NIR+1)^2-8*(NIR-Red)))/2'},
 'NDWI':{'name':'Відкрита вода · спектральна ознака','bands':['green','nir'],'resolution_m':10,'range':[-1,1],'formula':'(Green-NIR)/(Green+NIR)'},
 'NBR':{'name':'Зміни після пожеж · індикатор','bands':['nir','swir22'],'resolution_m':20,'range':[-1,1],'formula':'(NIR-SWIR2)/(NIR+SWIR2)'},
}
def index_values(index,a):
 def ratio(x,y):return np.divide(x,y,out=np.full_like(x,np.nan,dtype='float32'),where=np.abs(y)>1e-6)
 n=a.get('nir');r=a.get('red')
 with np.errstate(invalid='ignore',divide='ignore'):
  if index=='NDVI':return ratio(n-r,n+r)
  if index=='NDMI':return ratio(n-a['swir16'],n+a['swir16'])
  if index=='NDRE':return ratio(a['nir08']-a['rededge1'],a['nir08']+a['rededge1'])
  if index=='RECI':return ratio(a['nir08'],a['rededge1'])-1
  if index=='GCI':return ratio(n,a['green'])-1
  if index=='EVI':return ratio(2.5*(n-r),n+6*r-7.5*a['blue']+1)
  if index=='SAVI':return ratio(1.5*(n-r),n+r+.5)
  if index=='MSAVI':return (2*n+1-np.sqrt(np.maximum(0,(2*n+1)**2-8*(n-r))))/2
  if index=='NDWI':return ratio(a['green']-n,a['green']+n)
  if index=='NBR':return ratio(n-a['swir22'],n+a['swir22'])
 raise ValueError('Unknown index')


def calculate_truecolor(item, geometry, pad=0.35):
    """Natural-colour Sentinel-2 chip (B04/B03/B02, 10 m) around the field with a little context."""
    import rasterio
    from rasterio.vrt import WarpedVRT
    from rasterio.transform import from_bounds
    from rasterio.enums import Resampling
    from PIL import Image
    l, b, r, t = shape(geometry).bounds; dx, dy = (r - l) * pad, (t - b) * pad; l, b, r, t = l - dx, b - dy, r + dx, t + dy
    mx = (r - l) * 111320 * math.cos((b + t) / 2 * math.pi / 180); my = (t - b) * 111320
    w = max(2, min(640, math.ceil(mx / 10))); h = max(2, min(640, math.ceil(my / 10))); transform = from_bounds(l, b, r, t, w, h)
    out = []
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif', GDAL_HTTP_TIMEOUT='20', GDAL_HTTP_MAX_RETRY='1'):
        for band in ['red', 'green', 'blue']:
            asset = item['assets'][band]; href = asset['href']; parsed = urlparse(href)
            if parsed.scheme != 'https' or parsed.hostname != 'sentinel-cogs.s3.us-west-2.amazonaws.com': raise ValueError('Unsupported raster asset host')
            with rasterio.open(href) as source, WarpedVRT(source, crs='EPSG:4326', transform=transform, width=w, height=h, resampling=Resampling.bilinear) as vrt:
                raw = vrt.read(1).astype('float32')
            meta = asset.get('raster:bands', [{}])[0]; scale = meta.get('scale', .0001); flag = item['properties'].get('earthsearch:boa_offset_applied')
            out.append(raw * scale + (0 if flag else -1000 * scale))
    rgb = np.clip(np.stack(out, -1) / .3, 0, 1) ** (1 / 2.2)
    buf = io.BytesIO(); Image.fromarray((rgb * 255).astype(np.uint8)).save(buf, format='JPEG', quality=88)
    return {'image': 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode(), 'coordinates': [[l, t], [r, t], [r, b], [l, b]], 'bounds': [l, b, r, t],
            'date': item['properties']['datetime'], 'scene_id': item['id'], 'cloud_pct': item['properties'].get('eo:cloud_cover'), 'resolution_m': 10, 'kind': 'truecolor',
            'attribution': f"Contains modified Copernicus Sentinel data {item['properties']['datetime'][:4]}"}
