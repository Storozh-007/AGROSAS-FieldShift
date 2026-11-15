from datetime import date, datetime
from typing import Literal
from pydantic import BaseModel, Field, model_validator, field_validator
from shapely.geometry import shape
from pyproj import Geod

CROP_IDS = {'spring_wheat', 'wheat', 'maize', 'sunflower', 'pea', 'barley', 'sorghum', 'clover', 'soybean', 'rapeseed', 'cotton', 'almond'}

class Weights(BaseModel):
    water: float = Field(default=30, ge=0, le=100)
    soil: float = Field(default=30, ge=0, le=100)
    resilience: float = Field(default=25, ge=0, le=100)
    economy: float = Field(default=15, ge=0, le=100)

    @model_validator(mode='after')
    def nonzero(self):
        if sum(self.model_dump().values()) <= 0:
            raise ValueError('At least one priority must be greater than zero')
        return self

class Polygon(BaseModel):
    type: Literal['Polygon'] = 'Polygon'
    coordinates: list[list[tuple[float, float]]]

    @model_validator(mode='after')
    def valid_polygon(self):
        if len(self.coordinates) != 1:
            raise ValueError('MVP supports a single exterior ring without holes')
        ring = self.coordinates[0]
        if not 4 <= len(ring) <= 1000 or ring[0] != ring[-1]:
            raise ValueError('Polygon must be closed and contain 3–999 vertices')
        if any(not (-180 <= x <= 180 and -85 <= y <= 85) for x, y in ring):
            raise ValueError('Invalid WGS84 longitude/latitude')
        geom = shape(self.model_dump())
        if not geom.is_valid or geom.is_empty:
            raise ValueError('Polygon must not self-intersect')
        area, _ = Geod(ellps='WGS84').geometry_area_perimeter(geom)
        if not 100 <= abs(area) <= 1_000_000_000:
            raise ValueError('Field area must be between 0.01 and 100,000 ha')
        return self

class FieldInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    geometry: Polygon
    crop_history: list[str] = Field(default=['wheat', 'maize', 'sunflower'], min_length=1, max_length=8)
    soil_type: Literal['loam', 'clay', 'sand', 'unknown'] = 'unknown'
    soil_ph: float | None = Field(default=None, ge=3, le=10)
    irrigation: bool = False
    priorities: Weights = Field(default_factory=Weights)

    @field_validator('name')
    @classmethod
    def clean_name(cls, value: str) -> str:
        if not value.strip():
            raise ValueError('Name cannot be empty')
        return value.strip()

    @field_validator('crop_history')
    @classmethod
    def valid_crops(cls, value: list[str]) -> list[str]:
        if any(c not in CROP_IDS for c in value):
            raise ValueError('Unknown crop in history')
        return value

class PowerRequest(BaseModel):
    field_id: str
    start: date
    end: date

    @model_validator(mode='after')
    def valid_dates(self):
        if self.start > self.end or self.start < date(1981, 1, 1) or self.end >= date.today():
            raise ValueError('Use historical dates from 1981 through yesterday')
        if (self.end - self.start).days > 1826:
            raise ValueError('Request at most five years at a time')
        return self

class HlsRequest(BaseModel):
    field_id: str
    start: date | None = None
    end: date | None = None

class EvaluationRequest(BaseModel):
    field_id: str
    weights: Weights = Field(default_factory=Weights)
    temperature_delta: float = Field(default=0, ge=0, le=4)
    precipitation_delta: float = Field(default=0, ge=-50, le=20)
    dataset_id: str | None = None

class DeviceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    device_type: Literal['soil_moisture', 'soil_temperature', 'weather_station', 'rain_gauge', 'lora_gateway']
    serial_number: str = Field(min_length=3, max_length=64)
    field_id: str | None = None
    connectivity: Literal['starlink', 'cellular_4g', 'lorawan', 'offline'] = 'cellular_4g'
    battery_pct: float | None = Field(default=100.0, ge=0, le=100)

class TelemetryInput(BaseModel):
    model_config = {'allow_inf_nan': False}
    device_id: str
    metric: Literal['moisture_pct', 'temp_c', 'rainfall_mm', 'ec_ds_m', 'solar_w_m2']
    value: float
    unit: str = ''
    timestamp: datetime | None = None
    field_id: str | None = None

class SimulationRequest(BaseModel):
    field_id: str
    days: int = Field(default=7, ge=1, le=30)
