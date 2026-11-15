import pytest
from datetime import date
from app.services.hls import calculate_ndvi, generate_synthetic_hls_scenes
from app.services.ai_agronomist import generate_explanation
from app.services.power import generate_demonstration_power
from app.services.analysis import evaluate
from app.models import Field
from app.schemas import FieldInput, EvaluationRequest
from app.main import assign

def test_calculate_ndvi_formula():
    # Healthy dense green canopy: NIR=0.5, RED=0.1 => (0.5-0.1)/(0.5+0.1) = 0.4/0.6 = 0.6667
    ndvi_green = calculate_ndvi(0.5, 0.1)
    assert 0.66 <= ndvi_green <= 0.67

    # Bare dry soil: NIR=0.2, RED=0.18 => (0.2-0.18)/(0.2+0.18) = 0.02/0.38 = 0.0526
    ndvi_soil = calculate_ndvi(0.2, 0.18)
    assert 0.05 <= ndvi_soil <= 0.06

    # Water body: NIR=0.02, RED=0.08 => negative
    ndvi_water = calculate_ndvi(0.02, 0.08)
    assert ndvi_water < 0

def test_generate_synthetic_hls_scenes():
    scenes = generate_synthetic_hls_scenes('test-f1', 49.62, 34.46, date(2025, 4, 1), date(2025, 9, 30))
    assert len(scenes) >= 15
    for s in scenes:
        assert s['field_id'] == 'test-f1'
        assert -1.0 <= s['ndvi_mean'] <= 1.0
        assert s['satellite'] in {'Sentinel-2B', 'Landsat-9'}
        assert s['is_demo'] is True

def test_ai_agronomist_explanation_uk_and_en():
    f = Field(name='Поле Дружба', farm_id='farm-1', organization_id='org-1')
    assign(f, FieldInput(
        name='Поле Дружба',
        geometry={'type': 'Polygon', 'coordinates': [[[34.45, 49.62], [34.47, 49.62], [34.47, 49.61], [34.45, 49.61], [34.45, 49.62]]]},
        crop_history=['wheat', 'maize', 'sunflower'],
    ))
    payload = generate_demonstration_power(49.6, 34.5, date(2024, 4, 1), date(2024, 9, 30))
    req = EvaluationRequest(field_id='f1')
    eval_res = evaluate(f, payload, req)

    # Ukrainian explanation
    expl_uk = generate_explanation('Поле Дружба', eval_res, lang='uk')
    assert 'Поле Дружба' in expl_uk['summary']
    assert len(expl_uk['factors']) >= 3
    assert len(expl_uk['next_actions']) >= 3
    assert expl_uk['recommended_id'] in {'S1', 'S2', 'S3'}

    # English explanation
    expl_en = generate_explanation('Field Druzhba', eval_res, lang='en')
    assert 'Field Druzhba' in expl_en['summary']
    assert len(expl_en['factors']) >= 3
