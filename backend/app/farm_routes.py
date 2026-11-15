import asyncio
from datetime import datetime, timezone, timedelta, date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from geoalchemy2.shape import to_shape
from shapely.geometry import mapping
from app.db import get_db
from app.models import FarmDesign,FarmAction,Device,VegetationObservation
from app.farm_schemas import SceneInput,PlannerInput,ActionInput,OutcomeInput
from app.services.forecast import fetch_forecast
from app.services.earth_layers import layer_catalog,field_overlay,refresh_catalog
from app.services.planner import make_plan
from app.services.field_evidence import scene_catalog,catalog_summary,calculate_raster

# Dependencies are supplied by main to keep ownership checks identical across routes.
def router_for(authorize,get_field,audit):
    router=APIRouter(prefix='/api')
    def scene_record(record):return {**record.payload,'revision':record.revision,'updated_at':record.updated_at.isoformat()}
    @router.get('/fields/{field_id}/layers')
    async def earth_layers(field_id:str,db:Session=Depends(get_db),org:str=Depends(authorize)):
        get_field(db,field_id,org);return await refresh_catalog()
    @router.get('/fields/{field_id}/layers/{layer_id}')
    async def earth_overlay(field_id:str,layer_id:str,date_:date|None=None,db:Session=Depends(get_db),org:str=Depends(authorize)):
        field=get_field(db,field_id,org)
        try:return await field_overlay(mapping(to_shape(field.boundary)),layer_id,date_)
        except ValueError as exc:raise HTTPException(422,str(exc)) from exc
        except Exception as exc:raise HTTPException(503,'NASA GIBS layer unavailable; no model substituted') from exc
    @router.get('/fields/{field_id}/design')
    def read_design(field_id:str,db:Session=Depends(get_db),org:str=Depends(authorize)):
        get_field(db,field_id,org);record=db.get(FarmDesign,field_id)
        return scene_record(record) if record else None
    @router.put('/fields/{field_id}/design')
    def save_design(field_id:str,data:SceneInput,db:Session=Depends(get_db),org:str=Depends(authorize)):
        get_field(db,field_id,org)
        for item in data.objects:
            if item.device_id and not db.scalar(select(Device).where(Device.id==item.device_id,Device.organization_id==org,Device.field_id==field_id)):raise HTTPException(422,'Linked device must belong to this field')
        payload=data.model_dump(exclude={'revision'},by_alias=True);now=datetime.now(timezone.utc)
        if data.revision==0:
            record=FarmDesign(field_id=field_id,revision=1,payload=payload,updated_at=now);db.add(record)
            try:db.flush()
            except IntegrityError:db.rollback();raise HTTPException(409,'Design changed elsewhere. Reload before saving.')
        else:
            result=db.execute(update(FarmDesign).where(FarmDesign.field_id==field_id,FarmDesign.revision==data.revision).values(payload=payload,revision=data.revision+1,updated_at=now))
            if result.rowcount!=1:db.rollback();raise HTTPException(409,'Design changed elsewhere. Reload before saving.')
        audit(db,'farm.design.save',field_id,org);db.commit();return scene_record(db.get(FarmDesign,field_id))
    @router.get('/fields/{field_id}/forecast')
    async def forecast(field_id:str,db:Session=Depends(get_db),org:str=Depends(authorize)):
        field=get_field(db,field_id,org);point=to_shape(field.boundary).centroid
        try:return await fetch_forecast(point.y,point.x)
        except Exception as exc:raise HTTPException(503,'ECMWF forecast unavailable; no synthetic forecast substituted') from exc
    async def calculate(field_id,data,db,org):
        field=get_field(db,field_id,org);record=db.get(FarmDesign,field_id)
        if not record:raise HTTPException(422,'Save the farm equipment design first')
        point=to_shape(field.boundary).centroid
        try:weather=await fetch_forecast(point.y,point.x)
        except Exception as exc:raise HTTPException(503,'Forecast unavailable. Try again later.') from exc
        plan=make_plan(weather,record.payload,field.area_ha,data);plan['inputs']=data.model_dump();plan['design_revision']=record.revision
        return plan
    @router.post('/fields/{field_id}/plan')
    async def plan(field_id:str,data:PlannerInput,db:Session=Depends(get_db),org:str=Depends(authorize)):
        return await calculate(field_id,data,db,org)
    @router.post('/fields/{field_id}/actions',status_code=201)
    async def accept_plan(field_id:str,data:ActionInput,db:Session=Depends(get_db),org:str=Depends(authorize)):
        plan=await calculate(field_id,data.plan,db,org);record=FarmAction(field_id=field_id,payload=plan);db.add(record);audit(db,'farm.plan.accept',field_id,org);db.commit();return {'id':record.id,'status':record.status,'payload':record.payload,'outcome':record.outcome,'created_at':record.created_at.isoformat()}
    @router.get('/fields/{field_id}/actions')
    def actions(field_id:str,db:Session=Depends(get_db),org:str=Depends(authorize)):
        get_field(db,field_id,org);return [{'id':r.id,'status':r.status,'payload':r.payload,'outcome':r.outcome,'created_at':r.created_at.isoformat()} for r in db.scalars(select(FarmAction).where(FarmAction.field_id==field_id).order_by(FarmAction.created_at.desc()).limit(50))]
    @router.put('/fields/{field_id}/actions/{action_id}')
    def outcome(field_id:str,action_id:str,data:OutcomeInput,db:Session=Depends(get_db),org:str=Depends(authorize)):
        get_field(db,field_id,org);record=db.scalar(select(FarmAction).where(FarmAction.id==action_id,FarmAction.field_id==field_id))
        if not record:raise HTTPException(404,'Plan not found')
        record.status=data.status;record.outcome={**data.model_dump(exclude={'status'}),'origin':'user_reported','updated_at':datetime.now(timezone.utc).isoformat()};audit(db,'farm.plan.outcome',action_id,org);db.commit();return {'id':record.id,'status':record.status,'outcome':record.outcome}
    @router.get('/fields/{field_id}/evidence/scenes')
    async def scenes(field_id:str,start:date|None=None,end:date|None=None,db:Session=Depends(get_db),org:str=Depends(authorize)):
        field=get_field(db,field_id,org);end=end or date.today();start=start or end-timedelta(days=120)
        if start>end or (end-start).days>366:raise HTTPException(422,'Use a period of at most one year')
        try:items=await scene_catalog(mapping(to_shape(field.boundary)),start,end)
        except Exception as exc:raise HTTPException(503,'Sentinel-2 catalog unavailable') from exc
        return [catalog_summary(i) for i in items]
    @router.get('/fields/{field_id}/evidence/latest')
    def latest_raster(field_id:str,db:Session=Depends(get_db),org:str=Depends(authorize)):
        get_field(db,field_id,org)
        records=db.scalars(select(VegetationObservation).where(VegetationObservation.field_id==field_id,VegetationObservation.is_demo==False).order_by(VegetationObservation.scene_date.desc()).limit(20))
        return next((r.payload for r in records if r.payload.get('image')),None)
    @router.post('/fields/{field_id}/evidence/ndvi')
    async def ndvi(field_id:str,scene_id:str,start:date|None=None,end:date|None=None,db:Session=Depends(get_db),org:str=Depends(authorize)):
        field=get_field(db,field_id,org);end=end or date.today();start=start or end-timedelta(days=120)
        if start>end or (end-start).days>366:raise HTTPException(422,'Use a period of at most one year')
        cached=db.scalar(select(VegetationObservation).where(VegetationObservation.field_id==field_id,VegetationObservation.satellite=='Sentinel-2',VegetationObservation.product==scene_id))
        if cached and cached.payload.get('image'):return cached.payload
        try:
            geometry=mapping(to_shape(field.boundary));items=await scene_catalog(geometry,start,end);item=next((i for i in items if i['id']==scene_id),None)
            if not item:raise ValueError('Scene not in the current field catalog')
            result=await asyncio.to_thread(calculate_raster,item,geometry)
        except Exception as exc:raise HTTPException(422,'Не вдалося прочитати придатні пікселі. Оберіть іншу дату або повторіть завантаження.') from exc
        db.add(VegetationObservation(field_id=field_id,scene_date=result['date'][:10],satellite='Sentinel-2',product=scene_id,ndvi_mean=result['ndvi_mean'],ndvi_min=result['ndvi_min'],ndvi_max=result['ndvi_max'],cloud_cover_pct=result['cloud_pct'] or 0,is_demo=False,payload=result));db.commit();return result
    from app.monitoring_routes import register_monitoring
    register_monitoring(router,authorize,get_field,audit)
    from app.agronomy_routes import register_agronomy
    register_agronomy(router,authorize,get_field,audit)
    return router
