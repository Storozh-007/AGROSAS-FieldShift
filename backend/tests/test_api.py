import pytest
from datetime import date

def test_api_health(client):
    res = client.get('/api/health')
    assert res.status_code == 200
    assert res.json()['status'] == 'ok'

def test_api_farms_unauthorized(client):
    res = client.get('/api/farms')
    assert res.status_code == 401

def test_api_farms_authorized(client, auth_headers):
    res = client.get('/api/farms', headers=auth_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)

def test_api_field_crud(client, auth_headers):
    # 1. Create field
    payload = {
        'name': 'API Тестове Поле',
        'geometry': {
            'type': 'Polygon',
            'coordinates': [
                [[34.45, 49.62], [34.48, 49.62], [34.48, 49.60], [34.45, 49.60], [34.45, 49.62]]
            ],
        },
        'crop_history': ['wheat', 'pea', 'sunflower'],
        'soil_type': 'loam',
        'soil_ph': 6.8,
        'irrigation': False,
        'priorities': {'water': 35, 'soil': 35, 'resilience': 20, 'economy': 10},
    }
    create_res = client.post('/api/fields', json=payload, headers=auth_headers)
    assert create_res.status_code == 201
    field_data = create_res.json()
    field_id = field_data['id']
    assert field_data['name'] == 'API Тестове Поле'
    assert field_data['area_ha'] > 0

    # 2. Get overview
    overview_res = client.get(f'/api/fields/{field_id}/overview', headers=auth_headers)
    assert overview_res.status_code == 200
    assert overview_res.json()['field']['id'] == field_id

    # 3. Download NASA POWER climate data (or fallback)
    power_res = client.post(
        '/api/nasa/power',
        json={'field_id': field_id, 'start': '2024-04-01', 'end': '2024-09-30'},
        headers=auth_headers,
    )
    assert power_res.status_code == 200
    power_data = power_res.json()
    assert 'rows' in power_data
    assert len(power_data['rows']) >= 180

    # 4. Compare rotations
    compare_res = client.post(
        '/api/rotations/compare',
        json={'field_id': field_id, 'temperature_delta': 1.0, 'precipitation_delta': -15.0},
        headers=auth_headers,
    )
    assert compare_res.status_code == 200
    comp_data = compare_res.json()
    assert comp_data['recommended'] in {'S1', 'S2', 'S3'}
    assert len(comp_data['strategies']) == 3

    # 5. Get Explainable AI Recommendations
    rec_res = client.post(
        f'/api/recommendations?lang=uk',
        json={'field_id': field_id, 'temperature_delta': 1.0, 'precipitation_delta': -15.0},
        headers=auth_headers,
    )
    assert rec_res.status_code == 200
    rec_data = rec_res.json()
    assert 'explanation' in rec_data
    assert 'summary' in rec_data['explanation']

    # 6. Delete field
    del_res = client.delete(f'/api/fields/{field_id}', headers=auth_headers)
    assert del_res.status_code == 204

def test_api_devices_and_telemetry(client, auth_headers):
    # 1. List devices (triggers seeding if empty)
    dev_res = client.get('/api/devices', headers=auth_headers)
    assert dev_res.status_code == 200
    devices = dev_res.json()
    assert len(devices) > 0
    dev_id = devices[0]['id']

    # 2. Ingest telemetry measurement
    meas_payload = {
        'device_id': dev_id,
        'metric': 'moisture_pct',
        'value': 24.8,
        'unit': '%',
    }
    ingest_res = client.post('/api/telemetry', json=meas_payload, headers=auth_headers)
    assert ingest_res.status_code == 201

    # 3. Query telemetry
    query_res = client.get(f'/api/telemetry?device_id={dev_id}', headers=auth_headers)
    assert query_res.status_code == 200
    measurements = query_res.json()
    assert len(measurements) > 0
    assert measurements[0]['metric'] == 'moisture_pct'

def test_api_safety_resilience(client, auth_headers):
    safety_res = client.get('/api/safety?region=Полтавська+область', headers=auth_headers)
    assert safety_res.status_code == 200
    safety_data = safety_res.json()
    assert safety_data['country'] == 'UA'
    assert 'contacts' in safety_data
    assert len(safety_data['contacts']) >= 4
    assert 'checklist' in safety_data
