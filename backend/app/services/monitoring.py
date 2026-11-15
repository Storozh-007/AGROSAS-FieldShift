"""Co-registered numeric changes and clipped spectral zones. No disease/yield inference."""
import numpy as np
from shapely.geometry import shape,box,mapping
from shapely.ops import unary_union
from pyproj import Geod
GEOD=Geod(ellps='WGS84')
def compare_rasters(before,after):
    a=before['grid'];b=after['grid']
    if before['index']!=after['index'] or a['bounds']!=b['bounds'] or a['width']!=b['width'] or a['height']!=b['height']:raise ValueError('Сітки різні: оберіть той самий індекс і межі поля.')
    x=np.array(a['values'],dtype=float);y=np.array(b['values'],dtype=float);common=np.isfinite(x)&np.isfinite(y)
    if not common.any():raise ValueError('Дві дати не мають спільних придатних пікселів.')
    delta=y-x;v=delta[common]
    return {'before':before['date'],'after':after['date'],'index':before['index'],'common_pixels':int(common.sum()),'common_grid_fraction':round(float(common.mean()),4),'before_mean':round(float(x[common].mean()),4),'after_mean':round(float(y[common].mean()),4),'delta_mean':round(float(v.mean()),4),'decreased_pct':round(float((v<-.1).mean()*100),1),'increased_pct':round(float((v>.1).mean()*100),1),'stable_pct':round(float((abs(v)<=.1).mean()*100),1),'threshold':.1,'interpretation':'Зміна індексу на спільних пікселях. Це не підтвердження збитку, хвороби чи забруднення. Порівнюйте однакові фази сезону.'}
def spectral_zones(raster,geometry,classes=3):
    grid=raster['grid'];a=np.array(grid['values'],dtype=float);valid=np.isfinite(a)
    if not valid.any():raise ValueError('Немає придатних пікселів.')
    cut=np.unique(np.quantile(a[valid],np.linspace(0,1,classes+1)[1:-1]));labels=np.digitize(a,cut);left,bottom,right,top=grid['bounds'];dx=(right-left)/grid['width'];dy=(top-bottom)/grid['height'];boundary=shape(geometry);features=[]
    for k in range(len(cut)+1):
        cells=[box(left+c*dx,top-(r+1)*dy,left+(c+1)*dx,top-r*dy) for r,c in np.argwhere(valid&(labels==k))]
        if not cells:continue
        polygon=unary_union(cells).intersection(boundary);area=abs(GEOD.geometry_area_perimeter(polygon)[0])/10000
        features.append({'type':'Feature','geometry':mapping(polygon),'properties':{'zone':k+1,'area_ha':round(area,4),'mean':round(float(a[valid&(labels==k)].mean()),4),'pixels':len(cells),'rate':0}})
    return {'type':'FeatureCollection','features':features,'metadata':{'index':raster['index'],'date':raster['date'],'source':raster['source'],'native_resolution_m':raster['native_resolution_m'],'method':'Quantile zones of valid spectral pixels; cells clipped to boundary; not fertilizer recommendations','unobserved':'No rate assigned to missing pixels','rates_origin':'user_required'}}


def change_map(before, after, geometry):
    """Per-pixel difference image (red = fell, green = rose) and where the largest drop sits."""
    import base64, io
    from PIL import Image
    a = np.array(before['grid']['values'], dtype=float); b = np.array(after['grid']['values'], dtype=float); common = np.isfinite(a) & np.isfinite(b)
    d = np.where(common, b - a, np.nan); h, w = d.shape; rng = max(.15, float(np.nanpercentile(np.abs(d), 95)) if common.any() else .15)
    t = np.clip(np.nan_to_num(d / rng), -1, 1); rgba = np.zeros((h, w, 4), np.uint8)
    rgba[..., 0] = np.where(t < 0, 220, np.round(240 - t * 170)); rgba[..., 1] = np.where(t < 0, np.round(225 + t * 150), 215); rgba[..., 2] = np.where(t < 0, np.round(210 + t * 160), np.round(200 - t * 140))
    rgba[..., 3] = np.where(common, np.round(70 + np.abs(t) * 185), 0)
    buf = io.BytesIO(); Image.fromarray(rgba.astype(np.uint8)).save(buf, format='PNG')
    drop = common & (d < -.1); rise = common & (d > .1)
    def where(mask):
        if not mask.any(): return None
        rows, cols = np.nonzero(mask); cy, cx = rows.mean() / h - .5, cols.mean() / w - .5
        if abs(cx) < .12 and abs(cy) < .12: return 'центральна частина'
        ns = 'північно' if cy < -.12 else 'південно' if cy > .12 else ''; ew = 'східна' if cx > .12 else 'західна' if cx < -.12 else ''
        return (f'{ns}-{ew}' if ns and ew else ns[:-1] + 'на' if ns else ew) + ' частина'
    left, bottom, right, top = before['grid']['bounds']
    return {'image': 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode(), 'coordinates': [[left, top], [right, top], [right, bottom], [left, bottom]],
            'range': round(rng, 3), 'drop_where': where(drop), 'rise_where': where(rise), 'drop_pct': round(float(drop.sum() / max(common.sum(), 1) * 100), 1), 'rise_pct': round(float(rise.sum() / max(common.sum(), 1) * 100), 1)}
