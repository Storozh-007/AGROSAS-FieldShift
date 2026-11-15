import pytest
from datetime import date
from app.services.analysis import evaluate, climate_summary, InsufficientData
from app.services.power import generate_demonstration_power
from app.schemas import EvaluationRequest, Weights
from app.models import Field
from app.schemas import FieldInput
from app.main import assign

@pytest.fixture
def mock_field():
    f = Field(name='Полтавське Дослідне Поле', farm_id='farm-1', organization_id='org-1')
    assign(f, FieldInput(
        name='Полтавське Дослідне Поле',
        geometry={'type': 'Polygon', 'coordinates': [[[34.45, 49.62], [34.47, 49.62], [34.47, 49.61], [34.45, 49.61], [34.45, 49.62]]]},
        crop_history=['wheat', 'maize', 'sunflower'],
        soil_type='loam',
        soil_ph=6.5,
    ))
    return f

def test_climate_summary_requires_complete_season():
    # Only 30 days
    short_payload = generate_demonstration_power(49.6, 34.5, date(2024, 5, 1), date(2024, 5, 30))
    summary = climate_summary(short_payload)
    assert len(summary['seasons']) == 0

    # Full season (April 1 to September 30)
    full_payload = generate_demonstration_power(49.6, 34.5, date(2024, 4, 1), date(2024, 9, 30))
    summary = climate_summary(full_payload)
    assert '2024' in summary['seasons']

def test_evaluate_insufficient_data_error(mock_field):
    short_payload = generate_demonstration_power(49.6, 34.5, date(2024, 5, 1), date(2024, 5, 30))
    req = EvaluationRequest(field_id='field-1')
    with pytest.raises(InsufficientData):
        evaluate(mock_field, short_payload, req)

def test_evaluate_success_and_strategies(mock_field):
    payload = generate_demonstration_power(49.6, 34.5, date(2024, 4, 1), date(2024, 9, 30))
    req = EvaluationRequest(field_id='field-1', weights=Weights(water=40, soil=30, resilience=20, economy=10))
    res = evaluate(mock_field, payload, req)

    assert res['model_version'] == 'rotation-heuristic-0.1'
    assert res['recommended'] in {'S1', 'S2', 'S3'}
    assert len(res['strategies']) == 3
    for s in res['strategies']:
        assert 0 <= s['score'] <= 100
        assert s['water_need_mm'] > 0
        assert 'crops' in s
        assert len(s['crops']) > 0

def test_climate_time_machine_sensitivity(mock_field):
    payload = generate_demonstration_power(49.6, 34.5, date(2024, 4, 1), date(2024, 9, 30))
    
    # Baseline
    req_base = EvaluationRequest(field_id='field-1', temperature_delta=0, precipitation_delta=0)
    res_base = evaluate(mock_field, payload, req_base)

    # Severe drought scenario: +3.0°C and -30% precipitation
    req_drought = EvaluationRequest(field_id='field-1', temperature_delta=3.0, precipitation_delta=-30.0)
    res_drought = evaluate(mock_field, payload, req_drought)

    assert res_drought['climate']['stress_index'] > res_base['climate']['stress_index']
    assert res_drought['climate']['precipitation_mm'] < res_base['climate']['precipitation_mm']
    assert res_drought['climate']['temperature_c'] > res_base['climate']['temperature_c']
