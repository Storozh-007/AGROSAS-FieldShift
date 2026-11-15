import asyncio
from datetime import date,timedelta
from fastapi import Depends,HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from geoalchemy2.shape import to_shape
from shapely.geometry import mapping
from app.db import get_db
from app.models import SpectralRaster,VegetationObservation
from app.services.field_evidence import scene_catalog,calculate_raster,calculate_truecolor,INDEX_SPECS
from app.services.monitoring import compare_rasters,spectral_zones,change_map

def register_monitoring(router,authorize,get_field,audit):
    @router.get('/fields/{field_id}/monitoring/indices')
    def indices(field_id:str,db:Session=Depends(get_db),org:str=Depends(authorize)):
        get_field(db,field_id,org);return INDEX_SPECS
    @router.get('/fields/{field_id}/monitoring/history')
    def history(field_id:str,index:str='NDVI',db:Session=Depends(get_db),org:str=Depends(authorize)):
        get_field(db,field_id,org)
        return [r.payload for r in db.scalars(select(SpectralRaster).where(SpectralRaster.field_id==field_id,SpectralRaster.index_name==index).order_by(SpectralRaster.scene_date)).all()]
    @router.post('/fields/{field_id}/monitoring/raster')
    async def raster(field_id:str,scene_id:str,index:str='NDVI',start:date|None=None,end:date|None=None,db:Session=Depends(get_db),org:str=Depends(authorize)):
        field=get_field(db,field_id,org)
        if index not in INDEX_SPECS:raise HTTPException(422,'Невідомий індекс')
        cached=db.scalar(select(SpectralRaster).where(SpectralRaster.field_id==field_id,SpectralRaster.scene_id==scene_id,SpectralRaster.index_name==index))
        if cached:return cached.payload
        end=end or date.today();start=start or end-timedelta(days=365)
        if start>end or (end-start).days>366:raise HTTPException(422,'Оберіть період до одного року.')
        geometry=mapping(to_shape(field.boundary))
        try:
            items=await scene_catalog(geometry,start,end);item=next((i for i in items if i['id']==scene_id),None)
            if not item:raise ValueError('Сцена не належить вибраному каталогу поля. Оновіть пошук.')
            result=await asyncio.to_thread(calculate_raster,item,geometry,index)
        except ValueError as e:
            detail='На полі немає ясних пікселів: хмари, тіні, сніг або край сцени. Спробуйте іншу дату.' if 'clear field pixels' in str(e) else str(e)
            raise HTTPException(422,detail) from e
        except Exception as e:raise HTTPException(503,'Спектральні канали тимчасово недоступні. Повторіть або оберіть іншу сцену; підкладка не є цим знімком.') from e
        db.add(SpectralRaster(field_id=field_id,scene_id=scene_id,index_name=index,scene_date=result['date'],payload=result))
        if index=='NDVI':
            old=db.scalar(select(VegetationObservation).where(VegetationObservation.field_id==field_id,VegetationObservation.product==scene_id))
            if old:old.payload=result
            else:db.add(VegetationObservation(field_id=field_id,scene_date=result['date'][:10],satellite='Sentinel-2',product=scene_id,ndvi_mean=result['ndvi_mean'],ndvi_min=result['ndvi_min'],ndvi_max=result['ndvi_max'],cloud_cover_pct=result['cloud_pct'] or 0,is_demo=False,payload=result))
        audit(db,'monitoring.raster',field_id,org)
        try:db.commit()
        except IntegrityError:
            db.rollback()
            winner=db.scalar(select(SpectralRaster).where(SpectralRaster.field_id==field_id,SpectralRaster.scene_id==scene_id,SpectralRaster.index_name==index))
            if winner:return winner.payload
            raise
        return result
    def get_raster(db,field_id,scene_id,index):
        r=db.scalar(select(SpectralRaster).where(SpectralRaster.field_id==field_id,SpectralRaster.scene_id==scene_id,SpectralRaster.index_name==index))
        if not r:raise HTTPException(404,'Спочатку завантажте обидві дати для цього індексу.')
        return r.payload
    @router.get('/fields/{field_id}/monitoring/compare')
    def compare(field_id:str,before:str,after:str,index:str='NDVI',db:Session=Depends(get_db),org:str=Depends(authorize)):
        get_field(db,field_id,org)
        try:return compare_rasters(get_raster(db,field_id,before,index),get_raster(db,field_id,after,index))
        except ValueError as e:raise HTTPException(422,str(e)) from e
    async def compute(db,field_id,geometry,item,index):
        cached=db.scalar(select(SpectralRaster).where(SpectralRaster.field_id==field_id,SpectralRaster.scene_id==item['id'],SpectralRaster.index_name==index))
        if cached and (index=='RGB' or cached.payload.get('display_v')==2):return cached.payload
        if cached:db.delete(cached);db.commit()
        result=await asyncio.to_thread(calculate_truecolor if index=='RGB' else calculate_raster,item,geometry,*([] if index=='RGB' else [index]))
        db.add(SpectralRaster(field_id=field_id,scene_id=item['id'],index_name=index,scene_date=result['date'],payload=result))
        try:db.commit()
        except IntegrityError:db.rollback()
        return result
    @router.get('/fields/{field_id}/monitoring/snapshot')
    async def snapshot(field_id:str,gap_days:int=30,db:Session=Depends(get_db),org:str=Depends(authorize)):
        """Latest clear Sentinel-2 scene vs one ~gap_days earlier: natural colour + NDVI/NDMI/NDRE and change maps."""
        field=get_field(db,field_id,org);geometry=mapping(to_shape(field.boundary));end=date.today()
        try:items=sorted(await scene_catalog(geometry,end-timedelta(days=200),end),key=lambda i:i['properties']['datetime'],reverse=True)
        except Exception as e:raise HTTPException(503,'Каталог Sentinel-2 тимчасово недоступний.') from e
        items=[i for i in items if (i['properties'].get('eo:cloud_cover') or 100)<35]
        async def first_clear(cands):
            for it in cands[:6]:
                try:
                    r=await compute(db,field_id,geometry,it,'NDVI')
                    if r.get('valid_fraction',0)>=.7:return it,r
                except Exception:continue
            return None,None
        after,ndvi_a=await first_clear(items)
        if not after:raise HTTPException(422,'За останні пів року немає ясного знімка поля.')
        da=date.fromisoformat(after['properties']['datetime'][:10])
        before,ndvi_b=await first_clear([i for i in items if gap_days*.7<=(da-date.fromisoformat(i['properties']['datetime'][:10])).days<=gap_days*3])
        out={'after':{'date':after['properties']['datetime'][:10],'scene':after['id'],'cloud_pct':after['properties'].get('eo:cloud_cover')},'before':None,'params':{}}
        if before:out['before']={'date':before['properties']['datetime'][:10],'scene':before['id'],'cloud_pct':before['properties'].get('eo:cloud_cover')}
        for idx in ['RGB','NDVI','NDMI','NDRE']:
            try:
                a=ndvi_a if idx=='NDVI' else await compute(db,field_id,geometry,after,idx)
                entry={'after':{k:a.get(k) for k in ['image','coordinates','value_mean','value_p10','value_p90','valid_fraction','date','annotations','attribution','display_range']}}
                if before:
                    b=ndvi_b if idx=='NDVI' else await compute(db,field_id,geometry,before,idx)
                    entry['before']={k:b.get(k) for k in ['image','coordinates','value_mean','date']}
                    if idx!='RGB':
                        entry['compare']=compare_rasters(b,a);entry['change']=change_map(b,a,geometry)
                out['params'][idx]=entry
            except Exception as e:out['params'][idx]={'error':str(e)[:160]}
        return out
    @router.get('/fields/{field_id}/monitoring/zones')
    def zones(field_id:str,scene_id:str,index:str='NDVI',classes:int=3,db:Session=Depends(get_db),org:str=Depends(authorize)):
        f=get_field(db,field_id,org)
        if classes not in [3,5]:raise HTTPException(422,'Доступно 3 або 5 зон.')
        return spectral_zones(get_raster(db,field_id,scene_id,index),mapping(to_shape(f.boundary)),classes)
