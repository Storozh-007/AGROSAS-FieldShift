import json
import numpy as np
import pytest
from shapely.geometry import box, mapping, shape
from app.services.monitoring import compare_rasters, spectral_zones
from app.services.crop_history import CROP_MAP

def raster(values):
    return {'index':'NDVI','date':'2026-07-01','source':'test spectral measurement','native_resolution_m':10,'grid':{'bounds':[34,49,34.002,49.002],'width':2,'height':2,'values':values}}

def test_change_uses_only_common_pixels_not_independent_scene_means():
    a=raster([[.2,None],[.6,.8]]);b=raster([[.4,.9],[None,.8]])
    result=compare_rasters(a,b)
    assert result['common_pixels']==2
    assert result['before_mean']==.5
    assert result['after_mean']==.6
    assert result['delta_mean']==.1
    assert result['increased_pct']==50
    json.dumps(result,allow_nan=False)

def test_change_rejects_unregistered_or_empty_observations():
    a=raster([[None,None],[None,None]]);b=raster([[.4,.9],[.3,.8]])
    with pytest.raises(ValueError):compare_rasters(a,b)
    a=raster([[.2,.3],[.6,.8]]);b['grid']['bounds'][0]=33
    with pytest.raises(ValueError):compare_rasters(a,b)

def test_zones_clip_to_field_exclude_clouds_and_do_not_prescribe_rates():
    boundary=box(34.0002,49.0002,34.0018,49.0018)
    result=spectral_zones(raster([[.1,None],[.5,.9]]),mapping(boundary))
    polygons=[shape(f['geometry']) for f in result['features']]
    assert sum(f['properties']['pixels'] for f in result['features'])==3
    assert all(boundary.covers(p) for p in polygons)
    assert all(f['properties']['rate']==0 for f in result['features'])
    assert all(polygons[i].intersection(polygons[j]).area==0 for i in range(len(polygons)) for j in range(i))
    assert sum(p.area for p in polygons)==pytest.approx(boundary.area*.75)
    json.dumps(result,allow_nan=False)

def test_usda_crop_mapping_keeps_spring_and_winter_wheat_distinct():
    assert CROP_MAP[23]=='spring_wheat'
    assert CROP_MAP[24]=='wheat'
    assert 36 not in CROP_MAP  # Alfalfa must not be silently relabeled clover.

def test_confirmed_crop_history_persists_and_updates_rotation_baseline(client,auth_headers,sample_field):
    url=f'/api/fields/{sample_field.id}/agronomy'
    assert client.put(url,json={'seasons':[{'year':2024,'crop':'spring_wheat'},{'year':2025,'crop':'soybean'}]},headers=auth_headers).status_code==200
    data=client.get(url,headers=auth_headers).json()
    assert [s['crop'] for s in data['seasons']]==['spring_wheat','soybean']
    assert data['origin']=='farmer_confirmed'
    assert client.put(url,json={'seasons':[{'year':2024,'crop':'wheat'},{'year':2024,'crop':'maize'}]},headers=auth_headers).status_code==422
    assert client.put(url,json={'seasons':[]},headers=auth_headers).status_code==422
    assert client.get(url,headers={'Authorization':'Bearer invalid'}).status_code in (401,403)

def test_cdl_import_populates_seasons_without_overwriting_farmer_records(client,auth_headers,sample_field,monkeypatch,db):
    async def classified(_):
        return {'source':'USDA CDL','seasons':[{'year':2024,'crop':'spring_wheat','origin':'USDA_CDL_point_samples','sowing_date':None},{'year':2025,'crop':'soybean','origin':'USDA_CDL_point_samples','sowing_date':None}]}
    monkeypatch.setattr('app.agronomy_routes.fetch_crop_history',classified)
    url=f'/api/fields/{sample_field.id}/agronomy'
    assert client.post(url+'/import-cdl',headers=auth_headers).status_code==200
    history=client.get(url,headers=auth_headers).json()
    assert history['seasons'][0]['crop']=='spring_wheat'
    assert history['seasons'][0]['sowing_date'] is None
    assert history['origin']=='USDA_CDL_point_samples'
    db.refresh(sample_field)
    assert sample_field.crop_history==['spring_wheat','soybean']
    confirmed={'seasons':[{'year':2024,'crop':'barley'},{'year':2025,'crop':'maize'}]}
    assert client.put(url,json=confirmed,headers=auth_headers).status_code==200
    assert client.post(url+'/import-cdl',headers=auth_headers).status_code==200
    assert client.get(url,headers=auth_headers).json()['seasons'][0]['crop']=='barley'
    assert client.put(url,json={'seasons':[{'year':2021,'crop':'wheat','sowing_date':'2026-11-14'}]},headers=auth_headers).status_code==422
