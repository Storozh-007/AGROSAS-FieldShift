import asyncio
import hmac
import logging
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta, date
from fastapi import FastAPI, Depends, HTTPException, Header, Response, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, delete, text, desc
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import shape, mapping
from pyproj import Geod
from app.config import settings
from app.db import get_db
from app.models import (
    Field,
    Farm,
    ClimateDataset,
    VegetationObservation,
    Device,
    SensorMeasurement,
    AuditLog,
    ORG_ID,
)
from app.schemas import (
    FieldInput,
    PowerRequest,
    HlsRequest,
    EvaluationRequest,
    DeviceCreate,
    TelemetryInput,
    SimulationRequest,
)
from app.services.power import fetch_power, PowerError
from app.services.hls import fetch_hls_observations
from app.services.analysis import evaluate, climate_summary, InsufficientData
from app.services.crops import CROPS
from app.services.ai_agronomist import generate_explanation
from app.services.iot import (
    seed_demo_devices,
    simulate_device_telemetry,
    parse_telemetry_csv,
)
from app.services.safety import get_resilience_status

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('fieldshift')
power_lock = asyncio.Lock()
last_requests: list[float] = []

@asynccontextmanager
async def lifespan(app):
    if len(settings.app_token) < 24:
        raise RuntimeError('Set APP_TOKEN to a random secret of at least 24 characters')
    yield

app = FastAPI(
    title='AGROSAS OS',
    version='0.1.0',
    docs_url='/api/docs', redoc_url='/api/redoc', openapi_url='/api/openapi.json',
    lifespan=lifespan,
    description='NASA Space Apps Challenge 2026. Scientific Earth Observation & AgriTech Intelligence API.',
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=['GET', 'POST', 'PUT', 'DELETE'],
    allow_headers=['Authorization', 'Content-Type'],
)

def authorize(authorization: str = Header(default='')):
    if not settings.app_token or not hmac.compare_digest(authorization, f'Bearer {settings.app_token}'):
        raise HTTPException(401, 'Authentication required')
    return ORG_ID

def get_field(db: Session, field_id: str, org: str) -> Field:
    field = db.scalar(select(Field).where(Field.id == field_id, Field.organization_id == org))
    if not field:
        raise HTTPException(404, 'Field not found')
    return field

def serialize(field: Field) -> dict:
    return {
        'id': field.id,
        'name': field.name,
        'farm_id': field.farm_id,
        'geometry': mapping(to_shape(field.boundary)),
        'area_ha': round(field.area_ha, 2),
        'crop_history': field.crop_history,
        'soil_type': field.soil_type,
        'soil_ph': field.soil_ph,
        'irrigation': field.irrigation,
        'priorities': field.priorities,
        'is_demo': field.is_demo,
        'updated_at': field.updated_at.isoformat(),
    }

def assign(field: Field, data: FieldInput):
    geom = shape(data.geometry.model_dump())
    field.name = data.name
    field.boundary = from_shape(geom, srid=4326)
    area, _ = Geod(ellps='WGS84').geometry_area_perimeter(geom)
    field.area_ha = abs(area) / 10000
    field.crop_history = data.crop_history
    field.soil_type = data.soil_type
    field.soil_ph = data.soil_ph
    field.irrigation = data.irrigation
    field.priorities = data.priorities.model_dump()

def audit(db: Session, action: str, entity_id: str, org: str):
    db.add(AuditLog(organization_id=org, action=action, entity_id=entity_id))

# ==================== Core & Farm Endpoints ====================

@app.get('/api/health')
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text('SELECT 1'))
    except Exception:
        raise HTTPException(503, 'Database unavailable')
    return {
        'status': 'ok',
        'platform': 'AGROSAS OS',
        'mode': 'operational-local',
        'version': '0.1.0',
    }

@app.get('/api/farms')
def farms(db: Session = Depends(get_db), org: str = Depends(authorize)):
    return [{'id': f.id, 'name': f.name} for f in db.scalars(select(Farm).where(Farm.organization_id == org))]

@app.get('/api/fields')
def fields(db: Session = Depends(get_db), org: str = Depends(authorize)):
    from app.models import FieldProfile
    records=db.scalars(select(Field).where(Field.organization_id == org).order_by(Field.updated_at.desc())).all()
    profiles={p.field_id:p.payload for p in db.scalars(select(FieldProfile).where(FieldProfile.field_id.in_([f.id for f in records])))}
    result=[{**serialize(f),'country':profiles.get(f.id,{}).get('country'),'boundary_provenance':profiles.get(f.id,{}).get('boundary_status'),'crop_origin':profiles.get(f.id,{}).get('crop_origin'),'operator_name':profiles.get(f.id,{}).get('operator_name')} for f in records]
    return sorted(result,key=lambda f:f.get('country')!='USA')

@app.post('/api/fields', status_code=201)
def create_field(data: FieldInput, db: Session = Depends(get_db), org: str = Depends(authorize)):
    farm = db.scalar(select(Farm).where(Farm.organization_id == org))
    if not farm:
        raise HTTPException(409, 'Run seed script or create a farm first')
    field = Field(farm_id=farm.id, organization_id=org, is_demo=False)
    assign(field, data)
    db.add(field)
    db.flush()
    audit(db, 'field.create', field.id, org)
    db.commit()
    return serialize(field)

@app.get('/api/fields/{field_id}/overview')
def field_overview(field_id: str, db: Session = Depends(get_db), org: str = Depends(authorize)):
    field = get_field(db, field_id, org)
    latest_climate = db.scalar(
        select(ClimateDataset)
        .where(ClimateDataset.field_id == field_id)
        .order_by(ClimateDataset.downloaded_at.desc())
    )
    latest_vegetation = db.scalar(
        select(VegetationObservation)
        .where(VegetationObservation.field_id == field_id)
        .order_by(VegetationObservation.scene_date.desc())
    )
    devices = db.scalars(select(Device).where(Device.field_id == field_id)).all()

    return {
        'field': serialize(field),
        'has_climate_data': latest_climate is not None,
        'latest_climate_period': f'{latest_climate.start} — {latest_climate.end}' if latest_climate else None,
        'latest_ndvi': latest_vegetation.ndvi_mean if latest_vegetation else None,
        'latest_scene_date': latest_vegetation.scene_date if latest_vegetation else None,
        'connected_devices_count': len(devices),
    }

@app.put('/api/fields/{field_id}')
def update_field(field_id: str, data: FieldInput, db: Session = Depends(get_db), org: str = Depends(authorize)):
    field = get_field(db, field_id, org)
    if not to_shape(field.boundary).equals_exact(shape(data.geometry.model_dump()), tolerance=1e-10):
        db.execute(delete(ClimateDataset).where(ClimateDataset.field_id == field_id))
        db.execute(delete(VegetationObservation).where(VegetationObservation.field_id == field_id))
    assign(field, data)
    audit(db, 'field.update', field.id, org)
    db.commit()
    return serialize(field)

@app.delete('/api/fields/{field_id}', status_code=204)
def delete_field(field_id: str, db: Session = Depends(get_db), org: str = Depends(authorize)):
    field = get_field(db, field_id, org)
    audit(db, 'field.delete', field.id, org)
    db.delete(field)
    db.commit()
    return Response(status_code=204)

# ==================== NASA POWER Integration ====================

@app.get('/api/fields/{field_id}/observations')
def observations(field_id: str, db: Session = Depends(get_db), org: str = Depends(authorize)):
    get_field(db, field_id, org)
    datasets = db.scalars(
        select(ClimateDataset)
        .where(ClimateDataset.field_id == field_id)
        .order_by(ClimateDataset.downloaded_at.desc())
    ).all()
    return [{'id': d.id, **d.payload, 'monthly': climate_summary(d.payload)['monthly']} for d in datasets]

@app.post('/api/nasa/power')
async def power(request: PowerRequest, db: Session = Depends(get_db), org: str = Depends(authorize)):
    field = get_field(db, request.field_id, org)
    start, end = request.start.isoformat(), request.end.isoformat()
    async with power_lock:
        cached = db.scalar(
            select(ClimateDataset).where(
                ClimateDataset.field_id == field.id,
                ClimateDataset.start == start,
                ClimateDataset.end == end,
            )
        )
        if cached and (cached.payload.get('coverage', 0) == 1 or cached.downloaded_at > datetime.now(timezone.utc) - timedelta(hours=6)):
            return {'id': cached.id, **cached.payload, 'cached': True}

        clock = time.monotonic()
        last_requests[:] = [t for t in last_requests if clock - t < 60]
        if len(last_requests) >= 5:
            raise HTTPException(429, 'Limit: five NASA downloads per minute', headers={'Retry-After': '60'})
        last_requests.append(clock)

        point = to_shape(field.boundary).centroid
        original_geometry = to_shape(field.boundary)
        try:
            payload = await fetch_power(point.y, point.x, request.start, request.end)
        except PowerError as exc:
            logger.warning('POWER download failed for field %s: %s', field.id, exc)
            raise HTTPException(502, str(exc))

        db.expire_all()
        field = db.scalar(select(Field).where(Field.id == request.field_id, Field.organization_id == org).with_for_update())
        if not field or not to_shape(field.boundary).equals_exact(original_geometry, 1e-10):
            db.rollback()
            raise HTTPException(409, 'Field changed during download; retry')

        if cached:
            cached.payload = payload
            cached.downloaded_at = datetime.now(timezone.utc)
            dataset = cached
        else:
            dataset = ClimateDataset(field_id=field.id, start=start, end=end, payload=payload)
            db.add(dataset)

        audit(db, 'nasa.power.download', field.id, org)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, 'A matching download was saved concurrently; reload')

        return {'id': dataset.id, **payload, 'cached': False}

# ==================== NASA HLS & Vegetation ====================

@app.get('/api/fields/{field_id}/vegetation')
def get_vegetation(field_id: str, db: Session = Depends(get_db), org: str = Depends(authorize)):
    get_field(db, field_id, org)
    obs = db.scalars(
        select(VegetationObservation)
        .where(VegetationObservation.field_id == field_id)
        .order_by(VegetationObservation.scene_date.asc())
    ).all()
    return [
        {
            'id': o.id,
            'field_id': o.field_id,
            'scene_date': o.scene_date,
            'satellite': o.satellite,
            'product': o.product,
            'ndvi_mean': o.ndvi_mean,
            'ndvi_min': o.ndvi_min,
            'ndvi_max': o.ndvi_max,
            'cloud_cover_pct': o.cloud_cover_pct,
            'is_demo': o.is_demo,
            'payload': o.payload,
        }
        for o in obs
    ]

@app.post('/api/nasa/hls')
async def hls(request: HlsRequest, db: Session = Depends(get_db), org: str = Depends(authorize)):
    field = get_field(db, request.field_id, org)
    centroid = to_shape(field.boundary).centroid

    start = request.start or date(2025, 4, 1)
    end = request.end or date(2025, 9, 30)

    scenes = await fetch_hls_observations(field.id, centroid.y, centroid.x, start, end)

    # Save to database
    saved_records = []
    for s in scenes:
        existing = db.scalar(
            select(VegetationObservation).where(
                VegetationObservation.field_id == field.id,
                VegetationObservation.scene_date == s['scene_date'],
            )
        )
        if not existing:
            rec = VegetationObservation(
                field_id=field.id,
                scene_date=s['scene_date'],
                satellite=s['satellite'],
                product=s['product'],
                ndvi_mean=s['ndvi_mean'],
                ndvi_min=s['ndvi_min'],
                ndvi_max=s['ndvi_max'],
                cloud_cover_pct=s['cloud_cover_pct'],
                is_demo=s['is_demo'],
                payload=s,
            )
            db.add(rec)
            saved_records.append(rec)

    db.commit()
    audit(db, 'nasa.hls.sync', field.id, org)

    return {
        'field_id': field.id,
        'scenes_count': len(scenes),
        'scenes': scenes,
        'source': 'NASA HLS (Harmonized Landsat Sentinel-2)',
        'is_demo': any(s.get('is_demo') for s in scenes),
    }

# ==================== Crop Rotation & Climate Time Machine ====================

@app.get('/api/rotations')
def crops(org: str = Depends(authorize)):
    return {'crops': CROPS, 'model_version': 'rotation-heuristic-0.1'}

@app.post('/api/rotations/compare')
@app.post('/api/scenarios/evaluate')
def compare(request: EvaluationRequest, db: Session = Depends(get_db), org: str = Depends(authorize)):
    field = get_field(db, request.field_id, org)
    query = select(ClimateDataset).where(ClimateDataset.field_id == field.id)
    if request.dataset_id:
        query = query.where(ClimateDataset.id == request.dataset_id)
    dataset = db.scalar(query.order_by(ClimateDataset.downloaded_at.desc()))
    if not dataset:
        raise HTTPException(409, 'Load NASA POWER observations for this field first')
    try:
        return evaluate(field, dataset.payload, request)
    except InsufficientData as exc:
        raise HTTPException(422, str(exc))

@app.post('/api/recommendations')
def get_recommendation(
    request: EvaluationRequest,
    lang: str = Query('uk', pattern='^(uk|en)$'),
    db: Session = Depends(get_db),
    org: str = Depends(authorize),
):
    field = get_field(db, request.field_id, org)
    query = select(ClimateDataset).where(ClimateDataset.field_id == field.id)
    if request.dataset_id:
        query = query.where(ClimateDataset.id == request.dataset_id)
    dataset = db.scalar(query.order_by(ClimateDataset.downloaded_at.desc()))
    if not dataset:
        raise HTTPException(409, 'Load NASA POWER observations for this field first')
    try:
        eval_result = evaluate(field, dataset.payload, request)
    except InsufficientData as exc:
        raise HTTPException(422, str(exc))

    explanation = generate_explanation(field.name, eval_result, lang=lang)
    return {
        'evaluation': eval_result,
        'explanation': explanation,
    }

# ==================== IoT & Smart Farm Kit Endpoints ====================

@app.get('/api/devices')
def list_devices(field_id: str | None = None, db: Session = Depends(get_db), org: str = Depends(authorize)):
    query = select(Device).where(Device.organization_id == org)
    if field_id:
        query = query.where(Device.field_id == field_id)

    devices = db.scalars(query.order_by(Device.created_at.desc())).all()
    if not devices and not field_id:
        # Seed default demonstration devices for first launch
        field = db.scalar(select(Field).where(Field.organization_id == org))
        seed_demo_devices(db, org, field.id if field else None)
        devices = db.scalars(query.order_by(Device.created_at.desc())).all()

    return [
        {
            'id': d.id,
            'name': d.name,
            'device_type': d.device_type,
            'serial_number': d.serial_number,
            'field_id': d.field_id,
            'connectivity': d.connectivity,
            'battery_pct': d.battery_pct,
            'status': d.status,
            'last_seen_at': d.last_seen_at.isoformat() if d.last_seen_at else None,
            'is_demo': d.is_demo,
            'created_at': d.created_at.isoformat(),
        }
        for d in devices
    ]

@app.post('/api/devices', status_code=201)
def create_device(data: DeviceCreate, db: Session = Depends(get_db), org: str = Depends(authorize)):
    existing = db.scalar(select(Device).where(Device.serial_number == data.serial_number))
    if existing:
        raise HTTPException(409, 'Device with this serial number already registered')

    device = Device(
        organization_id=org,
        field_id=data.field_id,
        name=data.name,
        device_type=data.device_type,
        serial_number=data.serial_number,
        connectivity=data.connectivity,
        battery_pct=data.battery_pct,
        status='online',
        last_seen_at=datetime.now(timezone.utc),
        is_demo=False,
    )
    db.add(device)
    db.commit()
    audit(db, 'device.create', device.id, org)
    return {
        'id': device.id,
        'name': device.name,
        'serial_number': device.serial_number,
        'device_type': device.device_type,
    }

@app.delete('/api/devices/{device_id}', status_code=204)
def delete_device(device_id: str, db: Session = Depends(get_db), org: str = Depends(authorize)):
    device = db.scalar(select(Device).where(Device.id == device_id, Device.organization_id == org))
    if not device:
        raise HTTPException(404, 'Device not found')
    db.delete(device)
    db.commit()
    audit(db, 'device.delete', device_id, org)
    return Response(status_code=204)

@app.get('/api/telemetry')
def get_telemetry(
    device_id: str | None = None,
    field_id: str | None = None,
    metric: str | None = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    org: str = Depends(authorize),
):
    query = select(SensorMeasurement).join(Device, Device.id == SensorMeasurement.device_id).where(Device.organization_id == org)
    if device_id:
        query = query.where(SensorMeasurement.device_id == device_id)
    if field_id:
        query = query.where(SensorMeasurement.field_id == field_id)
    if metric:
        query = query.where(SensorMeasurement.metric == metric)

    if not 1 <= limit <= 1000:raise HTTPException(422, 'Use a telemetry limit from 1 to 1000')
    measurements = db.scalars(query.order_by(desc(SensorMeasurement.timestamp)).limit(limit)).all()
    return [
        {
            'id': m.id,
            'device_id': m.device_id,
            'field_id': m.field_id,
            'timestamp': m.timestamp.isoformat(),
            'metric': m.metric,
            'value': m.value,
            'unit': m.unit,
            'is_demo': m.is_demo,
        }
        for m in measurements
    ]

@app.post('/api/telemetry', status_code=201)
def ingest_telemetry(data: TelemetryInput, db: Session = Depends(get_db), org: str = Depends(authorize)):
    device = db.scalar(select(Device).where(Device.id == data.device_id, Device.organization_id == org))
    if not device:
        raise HTTPException(404, 'Device not registered')

    if data.field_id and data.field_id != device.field_id:
        raise HTTPException(422, 'Measurement field must match its registered device')
    now = datetime.now(timezone.utc)
    measurement = SensorMeasurement(
        device_id=device.id,
        field_id=data.field_id or device.field_id,
        timestamp=data.timestamp or now,
        metric=data.metric,
        value=data.value,
        unit=data.unit or {'moisture_pct':'%','temp_c':'°C','rainfall_mm':'mm','ec_ds_m':'dS/m','solar_w_m2':'W/m²'}[data.metric],
        is_demo=device.is_demo,
    )
    device.last_seen_at = now
    device.status = 'online'
    db.add(measurement)
    db.commit()
    return {'status': 'ingested', 'measurement_id': measurement.id}

@app.post('/api/telemetry/simulate')
def simulate_telemetry(req: SimulationRequest, db: Session = Depends(get_db), org: str = Depends(authorize)):
    get_field(db, req.field_id, org)
    devices = db.scalars(select(Device).where(Device.organization_id == org, Device.field_id == req.field_id)).all()
    if not devices:
        # Check if there are any devices for org
        devices = db.scalars(select(Device).where(Device.organization_id == org)).all()
        for d in devices:
            d.field_id = req.field_id
        db.commit()

    if not devices:
        seed_demo_devices(db, org, req.field_id)
        devices = db.scalars(select(Device).where(Device.organization_id == org)).all()

    total_simulated = 0
    for d in devices:
        total_simulated += simulate_device_telemetry(db, d, days=req.days)

    return {
        'status': 'simulated',
        'records_created': total_simulated,
        'devices_count': len(devices),
        'is_demo': True,
    }

# ==================== Ukraine Resilience Endpoints ====================

@app.get('/api/safety')
def safety_status(region: str = Query('Полтавська область'), org: str = Depends(authorize)):
    return get_resilience_status(region=region)

from app.farm_routes import router_for
app.include_router(router_for(authorize, get_field, audit))
from app.global_routes import router_for as global_router_for
app.include_router(global_router_for(authorize, get_field, assign, audit))
from app.sources_routes import router_for as sources_router_for
app.include_router(sources_router_for(authorize))
from app.assistant import router_for as assistant_router_for
app.include_router(assistant_router_for(authorize))
from app.planner_routes import router_for as planner_router_for
app.include_router(planner_router_for(authorize, get_field, audit))
from app.services.orbits import orbit_catalog, starlink_sample
@app.get('/api/orbits/starlink')
async def starlink_orbits(org: str = Depends(authorize)):
    try:
        return await starlink_sample()
    except Exception as exc:
        raise HTTPException(503, 'Starlink elements unavailable') from exc
@app.get('/api/orbits')
async def live_orbit_catalog(org: str = Depends(authorize)):
    return await orbit_catalog()
