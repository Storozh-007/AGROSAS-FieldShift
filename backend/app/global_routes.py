from datetime import datetime,timezone
from pathlib import Path
import json
from pydantic import BaseModel,Field as PField
from fastapi import APIRouter,Depends,HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from geoalchemy2.shape import to_shape
from shapely.geometry import shape
from app.db import get_db
from app.models import Field,FieldProfile,FarmDesign,FARM_ID
from app.services.events import official_events
from app.schemas import FieldInput

class ProfileInput(BaseModel):
    operator_name:str=PField(default='',max_length=120)
    country:str=PField(default='',max_length=3)
    region:str=PField(default='',max_length=120)
    notes:str=PField(default='',max_length=1000)
    annual_harvest_tonnes:float|None=PField(default=None,ge=0,le=10000000,allow_inf_nan=False)
    employee_count:int|None=PField(default=None,ge=0,le=1000000)
    local_supply_pct:float|None=PField(default=None,ge=0,le=100,allow_inf_nan=False)
    report_year:int|None=PField(default=None,ge=1981,le=2100)

def router_for(authorize,get_field,assign,audit):
    r=APIRouter(prefix='/api')
    @r.get('/network')
    def network(db:Session=Depends(get_db),org:str=Depends(authorize)):
        fields=db.scalars(select(Field).where(Field.organization_id==org)).all();profiles=[]
        for f in fields:
            record=db.get(FieldProfile,f.id);design=db.get(FarmDesign,f.id);p=record.payload if record else {};point=to_shape(f.boundary).representative_point();objects=design.payload.get('objects',[]) if design else []
            profiles.append({'id':f.id,'name':f.name,'area_ha':round(f.area_ha,2),'operator_name':p.get('operator_name') or 'Оператор не вказаний','operator_origin':p.get('operator_origin','unknown'),'country':p.get('country','UA' if 22<point.x<41 and 44<point.y<53 else ''),'region':p.get('region',''),'profile':p,'equipment_count':len(objects),'wind_kw':sum(o['capacity'] for o in objects if o['kind']=='wind' and o['enabled']),'solar_kw':sum(o['capacity'] for o in objects if o['kind']=='solar' and o['enabled']),'is_demo':f.is_demo})
        profiles.sort(key=lambda x:(x['country']!='USA',x['country'],x['name']));return {'fields':profiles,'total_area_ha':round(sum(f.area_ha for f in fields),2),'countries':len({p['country'] for p in profiles if p['country']}),'note':'Статистика площ — з геометрії. Потужності — інвентар проєкту. Власність, виробництво й внесок у ВВП автоматично не підтверджуються.'}
    @r.get('/fields/{field_id}/profile')
    def profile(field_id:str,db:Session=Depends(get_db),org:str=Depends(authorize)):
        get_field(db,field_id,org);record=db.get(FieldProfile,field_id);return record.payload if record else {}
    @r.put('/fields/{field_id}/profile')
    def set_profile(field_id:str,data:ProfileInput,db:Session=Depends(get_db),org:str=Depends(authorize)):
        get_field(db,field_id,org);record=db.get(FieldProfile,field_id)
        if not record:record=FieldProfile(field_id=field_id,payload={});db.add(record)
        record.payload={**record.payload,**data.model_dump(),'operator_origin':'user_declared','updated_at':datetime.now(timezone.utc).isoformat()};audit(db,'profile.update',field_id,org);db.commit();return record.payload
    @r.get('/events')
    async def events(db:Session=Depends(get_db),org:str=Depends(authorize)):
        fields=db.scalars(select(Field).where(Field.organization_id==org)).all();countries={(db.get(FieldProfile,f.id).payload.get('country') if db.get(FieldProfile,f.id) else None) or '' for f in fields};countries={'USA' if c in ('USA','US') else c for c in countries if c};return await official_events([{'id':f.id,'geometry':to_shape(f.boundary)} for f in fields],countries)
    @r.get('/network/examples')
    def examples(org:str=Depends(authorize)):
        path=Path(__file__).resolve().parent/'data/global_fields.geojson'
        if not path.exists():return {'features':[],'status':'Geometry snapshot is being prepared'}
        return json.loads(path.read_text())
    @r.post('/network/examples/import',status_code=201)
    def import_examples(db:Session=Depends(get_db),org:str=Depends(authorize)):
        path=Path(__file__).resolve().parent/'data/global_fields.geojson'
        if not path.exists():raise HTTPException(503,'Verified geometry snapshot unavailable')
        data=json.loads(path.read_text());created=[]
        for feature in data['features']:
            p=feature['properties'];source_id=str(p.get('id') or p.get('source_id') or feature.get('id'));existing=db.scalars(select(FieldProfile)).all()
            if any(x.payload.get('example_source_id')==source_id for x in existing):continue
            geom=shape(feature['geometry'])
            if geom.geom_type!='Polygon' or len(geom.exterior.coords)>999:continue
            country=p.get('country') or p.get('country_code','');country='USA' if country in ['US','USA'] else country;name=p.get('name') or f"{country} · {p.get('region','Field')} · {source_id[-6:]}"
            field=Field(farm_id=FARM_ID,organization_id=org,is_demo=True);assign(field,FieldInput(name=name,geometry={'type':'Polygon','coordinates':[list(geom.exterior.coords)]},crop_history=['maize'],soil_type='unknown'));db.add(field);db.flush()
            layout=[{'id':'solar','kind':'solar','name':'Сонячна станція · PLAN','x':28,'z':18,'capacity':45,'enabled':True,'rotation':0,'scale':1,'device_id':None},{'id':'battery','kind':'battery','name':'Накопичувач · PLAN','x':43,'z':9,'capacity':100,'enabled':True,'rotation':0,'scale':1,'device_id':None},{'id':'wind','kind':'wind','name':'Bergey EXCEL 15 · PLAN','x':39,'z':-27,'capacity':15.6,'enabled':True,'rotation':0,'scale':1,'hardware_id':'excel15','device_id':None},{'id':'barn','kind':'barn','name':'Господарська будівля · PLAN','x':29,'z':-8,'capacity':8,'enabled':True,'rotation':0,'scale':1,'device_id':None}]
            links=[{'id':f'line-{kind}','from':kind,'to':'battery','kind':'power','enabled':True} for kind in ['solar','wind','barn']]
            db.add(FarmDesign(field_id=field.id,revision=1,payload={'crop':'maize','stage':.75,'density':1,'grid':False,'labels':True,'snap':1,'satellite':True,'objects':layout,'connections':links}))
            db.add(FieldProfile(field_id=field.id,payload={**p,'country':country,'operator_name':f'Навчальне господарство · {p.get("region",country)}','operator_origin':'demo','example_source_id':source_id,'boundary_origin':'model_derived_public_dataset','crop_origin':'scenario_not_classification','note':'Навчальний запис господарства; геометрія з відкритого джерела. Реальна власність і культура не встановлені.'}));created.append(field.id)
        audit(db,'network.examples.import',str(len(created)),org);db.commit();return {'created':created,'count':len(created)}
    return r
