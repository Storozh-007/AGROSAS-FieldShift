from datetime import date
import json
from pathlib import Path
import pytest
from pydantic import ValidationError
from app.farm_schemas import SceneInput
from app.schemas import Polygon
from app.services.earth_layers import available_date
from app.services.planner import make_plan

def test_date_resolution_respects_advertised_gaps_and_composites():
    layer={'latest':'2026-11-10','periods':['2026-10-01/2026-10-05/P1D','2026-11-02/2026-11-10/P8D']}
    assert available_date(layer,date(2026,10,20))=='2026-10-05'
    assert available_date(layer,date(2026,11,9))=='2026-11-02'
    with pytest.raises(ValueError):available_date(layer,date(2025,1,1))

def test_connections_validate_identity_compatibility_and_uniqueness():
    objects=[{'id':'solar','kind':'solar','name':'Solar','x':20,'z':0},{'id':'probe','kind':'sensor','name':'Probe','x':0,'z':0}]
    edge={'id':'e','from':'solar','to':'probe','kind':'power'}
    with pytest.raises(ValidationError):SceneInput(objects=objects,connections=[edge])
    with pytest.raises(ValidationError):SceneInput(objects=objects,connections=[{**edge,'to':'solar'}])
    parts=[{'id':i,'kind':'battery','name':i,'x':0,'z':0} for i in ['a','b','c']]
    with pytest.raises(ValidationError):SceneInput(objects=parts,connections=[{'id':'same','from':'a','to':to,'kind':'power'} for to in ['b','c']])

def test_public_geometry_snapshot_is_valid_and_preserves_provenance():
    root=Path(__file__).resolve().parents[1]/'app/data/global_fields.geojson';data=json.loads(root.read_text())
    assert len(data['features'])==12
    assert sum(f['properties']['country']=='US' for f in data['features'])==8
    for f in data['features']:
        Polygon.model_validate(f['geometry'])
        assert f['properties']['owner_name'] is None
        assert f['properties']['source_url'].startswith('https://data.source.coop/')

def test_disconnected_load_cannot_borrow_energy_from_another_circuit():
    from app.farm_schemas import PlannerInput
    hours=[{'time':f'2026-06-01T{h:02d}:00:00Z','shortwave_radiation':800,'precipitation':0,'temperature_2m':25,'et0_fao_evapotranspiration':0} for h in range(24)]
    scene={'objects':[{'id':'s','kind':'solar','capacity':100,'enabled':True},{'id':'p','kind':'pump','capacity':12,'enabled':True}], 'connections':[]}
    r=make_plan({'hours':hours},scene,40,PlannerInput())
    assert r['optimized']['totals']['water_m3']==0
    assert r['optimized']['totals']['unserved_kwh']>0

def test_example_import_is_idempotent_and_profiles_are_explicitly_demo(client,auth_headers,sample_field):
    before=client.get('/api/network',headers=auth_headers).json()['fields']
    imported=sum(bool(f['profile'].get('example_source_id')) for f in before)
    first=client.post('/api/network/examples/import',json={},headers=auth_headers)
    assert first.status_code==201 and first.json()['count']+imported==12
    assert client.post('/api/network/examples/import',json={},headers=auth_headers).json()['count']==0
    network=client.get('/api/network',headers=auth_headers).json()
    examples=[f for f in network['fields'] if f['profile'].get('example_source_id')]
    assert len(examples)==12
    assert sum(f['country']=='USA' for f in examples)==8
    assert all(f['operator_origin']=='demo' for f in network['fields'] if f['profile'].get('example_source_id'))

def test_regional_overlay_is_clipped_to_field_and_excludes_holes(monkeypatch):
    import asyncio,base64,io,httpx
    from PIL import Image
    from app.services import earth_layers
    image=Image.new('RGBA',(256,256),(20,140,80,255));stream=io.BytesIO();image.save(stream,format='PNG')
    def respond(request):
        assert request.url.params['BBOX']=='0.0,0.0,1.0,1.0'
        return httpx.Response(200,content=stream.getvalue())
    client=httpx.AsyncClient
    monkeypatch.setattr(earth_layers.httpx,'AsyncClient',lambda **kwargs:client(transport=httpx.MockTransport(respond),**kwargs))
    geometry={'type':'Polygon','coordinates':[[[0,0],[1,0],[0,1],[0,0]],[[.1,.1],[.2,.1],[.2,.2],[.1,.2],[.1,.1]]]}
    layer=earth_layers.LAYERS[0]
    result=asyncio.run(earth_layers.field_overlay(geometry,layer['id']))
    raster=Image.open(io.BytesIO(base64.b64decode(result['image'].split(',')[1])))
    assert raster.getpixel((240,10))[3]==0
    assert raster.getpixel((32,220))[3]==0
    assert raster.getpixel((32,150))[3]==255

def test_orbit_cache_is_not_read_before_first_fetch(monkeypatch):
    import asyncio
    from app.services import orbits
    orbits._cache.clear()
    monkeypatch.setattr(orbits.time,'monotonic',lambda:10.0)
    class Client:
        def __init__(self,**k):pass
        async def __aenter__(self):return self
        async def __aexit__(self,*a):pass
        async def get(self,*a,**k):raise RuntimeError('offline')
    monkeypatch.setattr(orbits.httpx,'AsyncClient',Client)
    data=asyncio.run(orbits.orbit_catalog())
    assert all(r['unavailable'] for r in data['records'])
