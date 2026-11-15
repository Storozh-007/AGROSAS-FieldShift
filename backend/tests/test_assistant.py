import pytest
from app import assistant as A


def test_validation_rejects_bad_inputs():
    assert A.validate('plan_rotation', {'field_id': 'x', 'goal': 'soil'})
    with pytest.raises(ValueError): A.validate('plan_rotation', {'goal': 'soil'})
    with pytest.raises(ValueError): A.validate('plan_rotation', {'field_id': 'x', 'goal': 'banana'})
    with pytest.raises(ValueError): A.validate('create_field', {'name': 'A', 'confirmed': 'yes'})
    with pytest.raises(ValueError): A.validate('navigate', {'page': 'dashboard', 'extra': 1})


def test_square_has_requested_area():
    from shapely.geometry import Polygon
    from pyproj import Geod
    ring = A.square(49.6, 34.5, 40)
    area = abs(Geod(ellps='WGS84').geometry_area_perimeter(Polygon(ring))[0]) / 1e4
    assert 39 < area < 41


async def test_create_requires_confirmation_and_navigate_builds_href():
    actions = []
    r = await A.run_tool(None, 'create_field', {'name': 'A', 'confirmed': False, 'center_lat': 49, 'center_lon': 34, 'area_ha': 10}, actions)
    assert 'error' in r and not actions
    r = await A.run_tool(None, 'navigate', {'page': 'farm-lab', 'field_id': 'abc', 'tab': 'zones'}, actions)
    assert r['opened'] == '/farm-lab?field=abc#zones' and actions[0] == {'kind': 'navigate', 'href': r['opened']}


def test_local_agent_answers_without_key(client, auth_headers, sample_field, monkeypatch):
    import json
    from app import local_agent as L
    monkeypatch.delenv('ANTHROPIC_API_KEY', raising=False); monkeypatch.delenv('ANTHROPIC_AUTH_TOKEN', raising=False)
    assert client.get('/api/assistant/status', headers=auth_headers).json()['mode'] == 'local'
    r = client.post('/api/assistant/chat', json={'messages': [{'role': 'user', 'content': 'Створи поле 40 га'}]}, headers=auth_headers)
    events = [json.loads(x) for x in r.text.splitlines() if x]
    assert any(e['type'] == 'action' and e.get('kind') == 'field_draw' for e in events) and events[-1]['type'] == 'done'
    assert L.detect('Що загрожує моєму полю?') == 'threats' and L.detect('Which crop should I sow next?') == 'rotation' and L.detect('What threatens my field?') == 'threats' and L.detect('коли обприскувати') == 'weather'
    assert L.area_from('поле 40 га') == 40 and L.place_from('Створи поле біля Полтави') == 'Полтави' and L.crops_from('сіяли кукурудзу і сою') == ['maize', 'soybean']
