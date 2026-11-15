import pytest
from app.services.crops import CROPS
from app.schemas import CROP_IDS

def test_crop_catalog_completeness():
    assert len(CROPS) >= 7
    for crop_id in ['wheat', 'maize', 'sunflower', 'pea', 'barley', 'sorghum', 'clover']:
        assert crop_id in CROPS
        crop = CROPS[crop_id]
        assert 'uk' in crop
        assert 'en' in crop
        assert 'water_mm' in crop
        assert crop['water_mm'] > 0
        assert 'ph' in crop
        assert crop['ph'][0] < crop['ph'][1]
        assert crop_id in CROP_IDS

def test_phytosanitary_intervals():
    assert CROPS['sunflower']['min_return_years'] >= 5
    assert CROPS['pea']['nitrogen_fixation'] is True
    assert CROPS['clover']['nitrogen_fixation'] is True
