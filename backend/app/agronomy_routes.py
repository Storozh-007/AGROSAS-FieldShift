from datetime import date
from fastapi import Depends,HTTPException
from pydantic import BaseModel,Field as PField
from sqlalchemy.orm import Session
from shapely.geometry import mapping
from geoalchemy2.shape import to_shape
from app.db import get_db
from app.models import FieldProfile
from app.schemas import CROP_IDS
from app.services.crop_history import fetch_crop_history
class Season(BaseModel):
    year:int=PField(ge=1981,le=2100)
    crop:str
    sowing_date:date|None=None
REGIONAL_TYPICAL={'UA':['wheat','sunflower','barley','maize','soybean'],'FR':['rapeseed','wheat','barley','rapeseed','wheat'],'DE':['rapeseed','wheat','barley','maize','wheat']}
def regional_scenario(payload):
    crops=REGIONAL_TYPICAL.get(payload.get('country')) if payload.get('example_source_id') else None
    if not crops:return None
    latest=date.today().year-1
    return {'seasons':[{'year':latest-4+i,'crop':c,'sowing_date':None,'origin':'regional_typical_scenario'} for i,c in enumerate(crops)],'origin':'regional_typical_scenario','note':'Типова сівозміна регіону для навчального поля. Не є класифікацією цього поля — підтвердіть або змініть.'}
class SeasonInput(BaseModel):seasons:list[Season]=PField(min_length=1,max_length=8)
def register_agronomy(router,authorize,get_field,audit):
    @router.get('/fields/{field_id}/weather14')
    async def weather(field_id:str,db:Session=Depends(get_db),org:str=Depends(authorize)):
        from app.services.forecast import fetch_weather14
        f=get_field(db,field_id,org);pt=to_shape(f.boundary).representative_point()
        try:return await fetch_weather14(pt.y,pt.x)
        except Exception as e:raise HTTPException(503,'Прогноз тимчасово недоступний. Значення не підставляються.') from e
    @router.get('/fields/{field_id}/weather-detail')
    async def weather_detail(field_id:str,db:Session=Depends(get_db),org:str=Depends(authorize)):
        from app.services.forecast import fetch_weather_detail
        f=get_field(db,field_id,org);pt=to_shape(f.boundary).representative_point()
        try:return await fetch_weather_detail(pt.y,pt.x)
        except Exception as e:raise HTTPException(503,'Прогноз тимчасово недоступний.') from e
    @router.get('/fields/{field_id}/agronomy')
    def get(field_id:str,db:Session=Depends(get_db),org:str=Depends(authorize)):
        get_field(db,field_id,org);p=db.get(FieldProfile,field_id);payload=p.payload if p else {};agronomy=payload.get('agronomy') or (None if payload.get('cdl_history') else regional_scenario(payload)) or {};return {'seasons':[],**agronomy,'cdl_history':payload.get('cdl_history')}
    @router.post('/fields/{field_id}/agronomy/import-cdl')
    async def cdl(field_id:str,db:Session=Depends(get_db),org:str=Depends(authorize)):
        f=get_field(db,field_id,org);result=await fetch_crop_history(mapping(to_shape(f.boundary)));p=db.get(FieldProfile,field_id)
        if not p:p=FieldProfile(field_id=field_id,payload={});db.add(p)
        agronomy=p.payload.get('agronomy',{})
        if agronomy.get('origin')!='farmer_confirmed' and result.get('seasons') and all(s.get('crop') for s in result['seasons']):
            agronomy={'seasons':result['seasons'],'origin':'USDA_CDL_point_samples'};f.crop_history=[s['crop'] for s in result['seasons']]
        p.payload={**p.payload,'cdl_history':result,'agronomy':agronomy};audit(db,'agronomy.cdl_import',field_id,org);db.commit();return result
    @router.put('/fields/{field_id}/agronomy')
    def save(field_id:str,data:SeasonInput,db:Session=Depends(get_db),org:str=Depends(authorize)):
        f=get_field(db,field_id,org)
        if any(v.sowing_date and not(date(v.year-1,7,1)<=v.sowing_date<=date(v.year,12,31)) for v in data.seasons):raise HTTPException(422,'Дата посіву має відповідати сезону або попередній осені.')
        if len({v.year for v in data.seasons})!=len(data.seasons) or any(v.crop not in CROP_IDS for v in data.seasons):raise HTTPException(422,'Перевірте культури та унікальність сезонів.')
        p=db.get(FieldProfile,field_id)
        if not p:p=FieldProfile(field_id=field_id,payload={});db.add(p)
        result={'seasons':[{**v.model_dump(mode='json'),'origin':'farmer_confirmed'} for v in sorted(data.seasons,key=lambda s:s.year)],'origin':'farmer_confirmed'};p.payload={**p.payload,'agronomy':result,'crop_origin':'farmer_confirmed'}
        if data.seasons:f.crop_history=[v.crop for v in sorted(data.seasons,key=lambda s:s.year)]
        audit(db,'agronomy.confirm',field_id,org);db.commit();return result
