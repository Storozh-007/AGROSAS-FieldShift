from datetime import datetime,timedelta,timezone
import pytest
from pydantic import ValidationError
from app.farm_schemas import PlannerInput,SceneInput
from app.services.planner import make_plan

def weather():
    start=datetime(2026,6,1,tzinfo=timezone.utc)
    return {'source':'TEST FIXTURE','fetched_at':start.isoformat(),'hours':[{'time':(start+timedelta(hours=i)).isoformat(),'shortwave_radiation':800 if 8<=i%24<17 else 0,'precipitation':0,'temperature_2m':25,'et0_fao_evapotranspiration':.15} for i in range(72)]}
def scene(solar=45,battery=100,pump=12,barn=8):return {'objects':[{'kind':k,'enabled':True,'capacity':v} for k,v in [('solar',solar),('battery',battery),('pump',pump),('barn',barn)]]}
def test_plan_respects_water_budget_and_storage_bounds():
    p=PlannerInput(target_mm=10,water_m3=95)
    r=make_plan(weather(),scene(),60,p)
    assert len(r['optimized']['hours'])==72
    assert r['optimized']['totals']['water_m3']<=95
    assert all(0<=h['soc_pct']<=100 for h in r['optimized']['hours'])
    assert r['unmet_water_m3']>0
    assert r['optimized']['totals']['water_m3']==pytest.approx(r['baseline']['totals']['water_m3'])
def test_solar_windows_reduce_grid_use_in_controlled_conditions():
    r=make_plan(weather(),scene(battery=0),60,PlannerInput(water_m3=150))
    assert r['grid_saving_kwh']>0
    assert all(h['pv_kw']>0 for h in r['optimized']['hours'] if h['water_m3']>0)
def test_blackout_never_pumps_without_available_power():
    r=make_plan(weather(),scene(solar=0,battery=0),60,PlannerInput(outage=True,outage_start=0,outage_end=24))
    assert r['optimized']['totals']['water_m3']==0
    assert r['optimized']['totals']['unserved_kwh']>0
    assert r['optimized']['totals']['grid_kwh']==0

def test_no_pump_means_no_scheduled_irrigation():
    r=make_plan(weather(),scene(pump=0),60,PlannerInput())
    assert r['optimized']['totals']['water_m3']==0
    assert r['warnings']
def test_schema_rejects_invalid_physics_and_duplicate_objects():
    with pytest.raises(ValidationError):PlannerInput(field_capacity=15,wilting_point=25)
    obj={'id':'same','kind':'pump','name':'pump','x':0,'z':0}
    with pytest.raises(ValidationError):SceneInput(objects=[obj,obj])
    with pytest.raises(ValidationError):SceneInput(objects=[{**obj,'x':999}])

def test_design_revision_prevents_lost_updates(client,auth_headers,sample_field):
    path=f'/api/fields/{sample_field.id}/design'
    assert client.get(path,headers=auth_headers).json() is None
    first=client.put(path,json={'crop':'sunflower','objects':[]},headers=auth_headers)
    assert first.status_code==200 and first.json()['revision']==1
    assert client.put(path,json={'crop':'maize','objects':[]},headers=auth_headers).status_code==409
    changed=client.put(path,json={**first.json(),'crop':'maize'},headers=auth_headers)
    assert changed.status_code==200 and changed.json()['revision']==2
    assert client.get(path,headers=auth_headers).json()['crop']=='maize'

def test_dry_soil_is_not_artificially_raised_to_wilting_point():
    r=make_plan(weather(),scene(pump=0),60,PlannerInput(target_mm=0,initial_moisture=5))
    assert r['optimized']['hours'][0]['moisture_pct']<=5
    assert r['optimized']['totals']['risk_hours']==72
