import math
from datetime import date, timedelta
import numpy as np
import pytest
from app.services import rotation_engine as E
from app.services import site as S
from app.services.zones import build_zones


def climate(years=8, rain=1.6, hot=0.0, start=2015):
    d0 = date(start, 1, 1); n = (date(start + years, 1, 1) - d0).days; t, tx, tn, p, e = [], [], [], [], []
    for i in range(n):
        day = d0 + timedelta(days=i); doy = day.timetuple().tm_yday; base = 9 + 14 * math.sin((doy - 105) / 365 * 2 * math.pi) + hot
        t.append(day.isoformat()); tx.append(base + 6); tn.append(base - 6); p.append(rain * (1.6 if i % 5 == 0 else .85)); e.append(max(.3, 1.5 + 3 * math.sin((doy - 100) / 365 * 2 * math.pi)))
    return {'time': t, 'tmax': tx, 'tmin': tn, 'precip': p, 'et0': e}


def site(**kw):
    return E.Site(**{'lat': 49.6, 'awc_mm_m': 170, 'ph': 6.8, 'om_pct': 3.5, 'k_factor': .03, 'hsg': 'C', 'ls': .6, 'erosivity': 1300, 't_mean': 9, 'irrigated': False, **kw})


def test_water_stress_cuts_yield_and_irrigation_removes_it():
    clim = climate(rain=.6); index = {x: i for i, x in enumerate(clim['time'])}; years = list(range(2016, 2023))
    dry, _ = E.simulate_crop('maize', clim, index, site(), years)
    wet, _ = E.simulate_crop('maize', clim, index, site(irrigated=True), years)
    assert np.mean([r['fw'] for r in dry.values()]) < .8
    assert all(r['fw'] > .97 for r in wet.values()) and all(r['irrigation'] > 0 for r in wet.values())


def test_short_cool_season_fails_cotton_maturity():
    clim = climate(hot=-4); index = {x: i for i, x in enumerate(clim['time'])}
    sims, _ = E.simulate_crop('cotton', clim, index, site(), list(range(2016, 2023)))
    assert max(r['gdd_ratio'] for r in sims.values()) < .9


def test_rules_reject_monoculture_and_short_sunflower_return():
    assert not E.valid_sequence(['maize', 'maize'])
    assert not E.valid_sequence(['sunflower', 'wheat'])
    assert E.valid_sequence(['wheat', 'sunflower', 'barley', 'maize', 'soybean'])
    assert E.canonical(['wheat', 'rapeseed', 'wheat', 'rapeseed']) == ('rapeseed', 'wheat')


def test_legume_credit_lowers_fertiliser_and_cover_cuts_erosion():
    clim = climate(); index = {x: i for i, x in enumerate(clim['time'])}; years = list(range(2016, 2023)); s = site()
    sims = {c: E.simulate_crop(c, clim, index, s, years)[0] for c in ['wheat', 'maize', 'soybean']}
    cereal = E.evaluate_rotation(['wheat', 'maize'], sims, s, years, {})
    legume = E.evaluate_rotation(['soybean', 'maize'], sims, s, years, {})
    covered = E.evaluate_rotation(['wheat', 'maize'], sims, s, years, {}, cover=True)
    assert legume['n_fert_kg'] < cereal['n_fert_kg']
    assert covered['erosion_t'] < cereal['erosion_t'] and covered['carbon_input_t'] > cereal['carbon_input_t']


def test_engine_returns_current_plus_generated_strategies():
    r = E.run(site(), climate(), ['wheat', 'sunflower', 'barley', 'maize', 'soybean'], {'water': 30, 'soil': 30, 'resilience': 25, 'economy': 15}, max_len=4)
    assert r['strategies'][0]['id'] == 'S1' and r['strategies'][0]['score'] == pytest.approx(50)
    assert len(r['strategies']) >= 3 and r['searched'] > 50
    assert len({E.canonical(s['crops']) for s in r['strategies']}) == len(r['strategies'])
    assert len(r['vulnerable_months']) == 12


def test_warming_scenario_increases_water_deficit():
    s = site(); cur = ['wheat', 'maize', 'soybean']
    a = E.run(s, climate(), cur, {'water': 25, 'soil': 25, 'resilience': 25, 'economy': 25}, max_len=3)
    b = E.run(s, climate(), cur, {'water': 25, 'soil': 25, 'resilience': 25, 'economy': 25}, dT=3, dP=-20, max_len=3)
    assert b['strategies'][0]['metrics']['deficit_mm'] > a['strategies'][0]['metrics']['deficit_mm']


def test_soil_science_helpers():
    t33, t1500 = S.saxton_rawls(40, 20, 2.5); assert .2 < t33 < .35 and .08 < t1500 < .16
    assert .01 < S.williams_k(40, 20, 2.5) < .06
    assert S.texture_class(90, 5) == 'sand' and S.texture_class(20, 45) == 'clay'
    assert 1000 < S.erosivity(600) < 1700


def test_zones_and_sampling_route_on_synthetic_slope():
    rows, cols = 20, 24; y, x = np.mgrid[0:rows, 0:cols]
    elev = 100 + y * 1.5 + 2 * np.sin(x / 3); inside = np.ones((rows, cols), int); inside[:3, :5] = 0
    grid = {'rows': rows, 'cols': cols, 'bounds': [0, 0, .0044, .0036], 'cell_m': 20, 'inside': inside.tolist(), 'elevation': elev.tolist(),
            'slope_pct': (np.hypot(*np.gradient(elev, 20)) * 100).tolist(), 'twi': (8 - y * .2 + np.cos(x)).tolist(), 'ls': (.2 + y * .05).tolist(), 'flow': np.zeros((rows, cols)).tolist()}
    z = build_zones(grid, {'k_factor_si': .03}, {'erosivity_R': 1400, 'season_balance_mean_mm': -300}, {'c_factor': .38, 'gm_mean': 300, 'revenue_mean': 1200})
    assert z['k'] == 4 and abs(sum(q['share'] for q in z['zones']) - 1) < .01
    assert [q['zone'] for q in z['zones']] == [1, 2, 3, 4]
    assert z['zones'][0]['productivity_index'] < z['zones'][-1]['productivity_index']
    assert z['samples']['points'] and z['samples']['points'][0]['order'] == 1 and z['samples']['route_m'] > 0
    assert all(grid['inside'][p['row']][p['col']] for p in z['samples']['points'])


def test_plan_endpoint_uses_site_passport(client, auth_headers, sample_field, monkeypatch):
    import app.planner_routes as P
    async def fake_site(geometry):
        clim = climate()
        return {'point': [34.46, 49.61], 'errors': {}, 'built_at': 'now', 'climate_daily': clim, 'climate': {**S.climate_summary(clim, 49.6), 'source': 'synthetic', 'native_resolution': 'test'},
                'soil': S.summarize_soil(35, 28, 3.6, 6.9, 170, .03, 'C', 'test', 'test'), 'terrain': {'ls_mean': .5, 'source': 'test', 'native_resolution': 'test'}}
    monkeypatch.setattr(P, 'build_site', fake_site)
    r = client.post(f'/api/fields/{sample_field.id}/site', params={'rebuild': True}, headers=auth_headers)
    assert r.status_code == 200 and r.json()['soil']['texture'] == 'clay loam' and 'climate_daily' not in r.json()
    plan = client.post(f'/api/fields/{sample_field.id}/rotation-plan', json={'weights': {'water': 40, 'soil': 30, 'resilience': 20, 'economy': 10}}, headers=auth_headers)
    assert plan.status_code == 200, plan.text
    body = plan.json(); assert body['strategies'][0]['kind'] == 'current' and body['evidence'] and 'prices_default' in body['gaps']
    assert len(body['threats']) == 7 and body['weights_source'] == 'manual' and abs(sum(body['weights_pct'].values()) - 100) < 1
    assert len(body['strategies'][1]['monthly_deficit']) == 12 and body['calendar']['wheat']['winter']
    dry = client.post(f'/api/fields/{sample_field.id}/rotation-plan', json={'scenario': 'dry', 'goal': 'water'}, headers=auth_headers).json()
    assert dry['scenario']['precipitation_delta'] < 0 and dry['weights_source'] == 'goal+threats' and abs(sum(dry['weights_pct'].values()) - 100) < 1
    bench = client.get('/api/farm/benchmark', headers=auth_headers).json()
    assert any(f['id'] == sample_field.id and f['computed'] for f in bench['fields'])
    assert client.post(f'/api/fields/{sample_field.id}/rotation-plan', json={'excluded': ['banana']}, headers=auth_headers).status_code == 422
