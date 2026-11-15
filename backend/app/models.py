import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Float, Boolean, ForeignKey, DateTime, JSON, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from geoalchemy2 import Geometry
from app.db import Base

ORG_ID = 'local-demo-organization'
FARM_ID = 'poltava-demo-farm'

def uid():
    return str(uuid.uuid4())

def now():
    return datetime.now(timezone.utc)

class Organization(Base):
    __tablename__ = 'organizations'
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str]

class Farm(Base):
    __tablename__ = 'farms'
    id: Mapped[str] = mapped_column(String, primary_key=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey('organizations.id'), index=True)
    name: Mapped[str]

class Field(Base):
    __tablename__ = 'fields'
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    farm_id: Mapped[str] = mapped_column(ForeignKey('farms.id'), index=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey('organizations.id'), index=True)
    name: Mapped[str]
    boundary = mapped_column(Geometry('POLYGON', srid=4326, spatial_index=True), nullable=False)
    area_ha: Mapped[float] = mapped_column(Float)
    crop_history: Mapped[list] = mapped_column(JSON)
    soil_type: Mapped[str]
    soil_ph: Mapped[float | None] = mapped_column(Float, nullable=True)
    irrigation: Mapped[bool] = mapped_column(Boolean, default=False)
    priorities: Mapped[dict] = mapped_column(JSON)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)

class ClimateDataset(Base):
    __tablename__ = 'climate_observations'
    __table_args__ = (UniqueConstraint('field_id', 'start', 'end'),)
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    field_id: Mapped[str] = mapped_column(ForeignKey('fields.id', ondelete='CASCADE'), index=True)
    start: Mapped[str]
    end: Mapped[str]
    payload: Mapped[dict] = mapped_column(JSON)
    downloaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class VegetationObservation(Base):
    __tablename__ = 'vegetation_observations'
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    field_id: Mapped[str] = mapped_column(ForeignKey('fields.id', ondelete='CASCADE'), index=True)
    scene_date: Mapped[str] = mapped_column(String, index=True)
    satellite: Mapped[str] = mapped_column(String)
    product: Mapped[str] = mapped_column(String)
    ndvi_mean: Mapped[float] = mapped_column(Float)
    ndvi_min: Mapped[float] = mapped_column(Float)
    ndvi_max: Mapped[float] = mapped_column(Float)
    cloud_cover_pct: Mapped[float] = mapped_column(Float)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    payload: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class Device(Base):
    __tablename__ = 'devices'
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey('organizations.id'), index=True)
    field_id: Mapped[str | None] = mapped_column(ForeignKey('fields.id', ondelete='SET NULL'), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String)
    device_type: Mapped[str] = mapped_column(String)
    serial_number: Mapped[str] = mapped_column(String, unique=True, index=True)
    connectivity: Mapped[str] = mapped_column(String, default='cellular_4g')
    battery_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String, default='online')
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class SensorMeasurement(Base):
    __tablename__ = 'sensor_measurements'
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    device_id: Mapped[str] = mapped_column(ForeignKey('devices.id', ondelete='CASCADE'), index=True)
    field_id: Mapped[str | None] = mapped_column(ForeignKey('fields.id', ondelete='SET NULL'), nullable=True, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
    metric: Mapped[str] = mapped_column(String, index=True)
    value: Mapped[float] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class AuditLog(Base):
    __tablename__ = 'audit_logs'
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(String, index=True)
    action: Mapped[str]
    entity_id: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class FarmDesign(Base):
    __tablename__ = 'farm_designs'
    field_id: Mapped[str] = mapped_column(ForeignKey('fields.id', ondelete='CASCADE'), primary_key=True)
    revision: Mapped[int] = mapped_column(default=1)
    payload: Mapped[dict] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)

class FarmAction(Base):
    __tablename__ = 'farm_actions'
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    field_id: Mapped[str] = mapped_column(ForeignKey('fields.id', ondelete='CASCADE'), index=True)
    payload: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String, default='planned')
    outcome: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class FieldProfile(Base):
    __tablename__ = 'field_profiles'
    field_id: Mapped[str] = mapped_column(ForeignKey('fields.id', ondelete='CASCADE'), primary_key=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)

class SpectralRaster(Base):
    __tablename__ = 'spectral_rasters'
    __table_args__ = (UniqueConstraint('field_id','scene_id','index_name'),)
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    field_id: Mapped[str] = mapped_column(ForeignKey('fields.id',ondelete='CASCADE'),index=True)
    scene_id: Mapped[str]
    index_name: Mapped[str]
    scene_date: Mapped[str]
    payload: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True),default=now)
