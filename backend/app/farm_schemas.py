from typing import Literal
from pydantic import BaseModel, Field, ConfigDict, model_validator
from app.schemas import CROP_IDS

ModuleKind = Literal['solar','battery','pump','sensor','weather','barn','gateway','tank','silo','tractor','combine','road','fence','tree','pole','irrigation','wind']
class Equipment(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    id: str = Field(min_length=1,max_length=64)
    kind: ModuleKind
    name: str = Field(min_length=1,max_length=100)
    x: float = Field(ge=-55,le=55)
    z: float = Field(ge=-39,le=39)
    rotation: float = Field(default=0,ge=-360,le=360)
    scale: float = Field(default=1,ge=.4,le=2)
    enabled: bool = True
    capacity: float = Field(default=0,ge=0,le=10000)
    device_id: str | None = None
    hardware_id: str | None = Field(default=None,max_length=100)

class Connection(BaseModel):
    id: str = Field(min_length=1,max_length=150)
    from_: str = Field(alias='from',min_length=1,max_length=64)
    to: str = Field(min_length=1,max_length=64)
    kind: Literal['power','water','data']
    enabled: bool = True

class SceneInput(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    revision: int = Field(default=0,ge=0)
    crop: str = 'wheat'
    stage: float = Field(default=.75,ge=0,le=1)
    density: float = Field(default=1,ge=.4,le=1.6)
    labels: bool = True
    grid: bool = False
    snap: float = Field(default=1,ge=0,le=5)
    satellite: bool = True
    connections: list[Connection] | None = Field(default=None,max_length=180)
    objects: list[Equipment] = Field(default_factory=list,max_length=60)
    @model_validator(mode='after')
    def valid(self):
        if self.crop not in CROP_IDS: raise ValueError('Unknown crop')
        if len({x.id for x in self.objects}) != len(self.objects): raise ValueError('Equipment ids must be unique')
        if len({e.id for e in self.connections or []}) != len(self.connections or []):raise ValueError('Connection ids must be unique')
        ids={x.id for x in self.objects}
        ports={'wind':{'power'},'solar':{'power'},'battery':{'power'},'pole':{'power'},'barn':{'power'},'pump':{'power','water'},'tank':{'water'},'irrigation':{'water'},'sensor':{'data'},'weather':{'data'},'gateway':{'power','data'}}
        objects={x.id:x for x in self.objects};seen=set()
        for edge in self.connections or []:
            if edge.from_ not in ids or edge.to not in ids or edge.from_==edge.to:raise ValueError('Invalid connection endpoint')
            key=(edge.kind,tuple(sorted([edge.from_,edge.to])))
            if key in seen:raise ValueError('Duplicate connection')
            seen.add(key)
            if any(edge.kind not in ports.get(objects[i].kind,set()) for i in [edge.from_,edge.to]):raise ValueError('Incompatible connection ports')
        return self

class PlannerInput(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    target_mm: float = Field(default=5,ge=0,le=50)
    water_m3: float = Field(default=150,ge=0,le=100000)
    initial_moisture: float = Field(default=25,ge=5,le=50)
    root_depth_m: float = Field(default=.3,ge=.1,le=2)
    field_capacity: float = Field(default=32,ge=10,le=55)
    wilting_point: float = Field(default=14,ge=1,le=40)
    kc: float = Field(default=1,ge=.1,le=1.5)
    reserve_pct: float = Field(default=20,ge=0,le=90)
    initial_soc: float = Field(default=55,ge=0,le=100)
    grid_price: float = Field(default=6,ge=0,le=100)
    outage_start: int = Field(default=18,ge=0,le=23)
    outage_end: int = Field(default=22,ge=0,le=24)
    outage: bool = False
    @model_validator(mode='after')
    def moisture_bounds(self):
        if self.wilting_point >= self.field_capacity: raise ValueError('Wilting point must be below field capacity')
        return self

class ActionInput(BaseModel):
    plan: PlannerInput
class OutcomeInput(BaseModel):
    status: Literal['planned','completed','cancelled']
    water_m3: float | None = Field(default=None,ge=0,le=100000)
    energy_kwh: float | None = Field(default=None,ge=0,le=100000)
    note: str = Field(default='',max_length=1000)
