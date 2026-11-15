import numpy as np
import pytest
import rasterio
from rasterio.io import MemoryFile
from rasterio.transform import from_bounds
from app.services.field_evidence import calculate_raster

@pytest.mark.parametrize('upstream,red,nir,expected',[(True,1000,5000,2/3),(False,2000,6000,2/3),(True,1000,1100,1/21)])
def test_ndvi_applies_boa_offset_exactly_once_and_masks_cloud(monkeypatch,upstream,red,nir,expected):
    values={'red':np.full((4,4),red,dtype='uint16'),'nir':np.full((4,4),nir,dtype='uint16'),'scl':np.full((4,4),4,dtype='uint8')}
    values['scl'][0,:]=9
    memories={}
    for band,array in values.items():
        memory=MemoryFile()
        with memory.open(driver='GTiff',width=4,height=4,count=1,dtype=array.dtype,crs='EPSG:4326',transform=from_bounds(34,49,34.0004,49.0004,4,4)) as ds:ds.write(array,1)
        memories[band]=memory
    monkeypatch.setattr(rasterio,'open',lambda href:memories[href.split('/')[-1][:-4]].open())
    item={'id':'fixture','properties':{'datetime':'2026-06-01T00:00:00Z','earthsearch:boa_offset_applied':upstream},'assets':{band:{'href':f'https://sentinel-cogs.s3.us-west-2.amazonaws.com/{band}.tif','raster:bands':[{'scale':.0001,'offset':-.1}]} for band in values}}
    geometry={'type':'Polygon','coordinates':[[[34,49],[34.0004,49],[34.0004,49.0004],[34,49.0004],[34,49]]]}
    result=calculate_raster(item,geometry)
    import json
    json.dumps(result,allow_nan=False)
    assert result['index']=='NDVI'
    assert result['ndvi_mean']==pytest.approx(expected,abs=.0001)
    assert 0<result['valid_fraction']<1
    assert result['is_demo'] is False
    assert result['image'].startswith('data:image/png;base64,')
    for memory in memories.values():memory.close()
