"""Rotation engine v2: process-based screening of crop rotations on 30 years of climate.

Per crop and year (daily):  FAO-56 single-Kc soil-water balance with SCS-CN runoff,
FAO-33 yield response (Ky), heat stress at flowering, frost / winter-kill, GDD maturity.
Per rotation: gross margin distribution, water demand and deficit, RUSLE erosion,
ICBM soil-carbon change, nitrogen balance with legume credits, pest-cycle breaks,
bare-soil windows. Strategies are generated, not hard-coded, and scored against the
farmer's own rotation (current = 50 on every criterion).

Parameters are literature defaults (FAO-56 Tables 11–12, FAO-33, RUSLE handbooks,
ICBM). They are screening values, not calibrated yield forecasts.
"""
from __future__ import annotations
import itertools, math
from dataclasses import dataclass
from datetime import date, timedelta
import numpy as np

# id: (uk name, winter, sow MM-DD (north), stages [ini,dev,mid,late] days, kc [ini,mid,end], root m, p, Ky,
#      ymax t/ha, price $/t, var cost $/ha, N demand kg/ha, N credit to next crop kg/ha, residue C t/ha, RUSLE C,
#      family, pest group, min return yrs, Tbase, GDD need, heat Tmax at flowering, frost/winter-kill Tmin, ph range, role)
C = {
 'wheat':       ('Озима пшениця', True,  '10-01', [150, 60, 45, 30], [.40, 1.15, .25], 1.5, .55, 1.05, 7.0, 220, 520, 170, 0,  3.2, .20, 'Poaceae', 'cereal', 2, 0, 2000, 32, -20, (5.5, 8.0), 'cereal'),
 'spring_wheat':('Яра пшениця',   False, '04-10', [20, 25, 60, 30],   [.30, 1.15, .30], 1.2, .55, 1.15, 4.5, 230, 430, 120, 0,  2.3, .30, 'Poaceae', 'cereal', 2, 0, 1500, 32, -4,  (5.5, 8.0), 'cereal'),
 'barley':      ('Ячмінь',        False, '04-01', [15, 25, 50, 30],   [.30, 1.15, .25], 1.0, .55, 1.00, 5.5, 200, 400, 100, 0,  2.3, .30, 'Poaceae', 'cereal', 2, 0, 1350, 33, -4,  (6.0, 8.0), 'cereal'),
 'maize':       ('Кукурудза',     False, '05-01', [30, 40, 50, 30],   [.30, 1.20, .35], 1.4, .55, 1.25, 11., 190, 900, 200, 0,  4.5, .38, 'Poaceae', 'maize',  2, 10, 1500, 35, -1,  (5.5, 7.5), 'cereal'),
 'sorghum':     ('Сорго',         False, '05-15', [20, 35, 40, 30],   [.30, 1.00, .55], 1.6, .55, 0.90, 6.5, 180, 600, 130, 0,  3.5, .35, 'Poaceae', 'sorghum', 2, 10, 1300, 38, -1, (5.5, 8.5), 'drought'),
 'sunflower':   ('Соняшник',      False, '04-25', [25, 35, 45, 25],   [.35, 1.05, .35], 1.8, .45, 0.95, 3.0, 420, 550, 90,  0,  2.5, .40, 'Asteraceae', 'sclerotinia', 6, 6, 1600, 35, -2, (6.0, 8.0), 'oilseed'),
 'soybean':     ('Соя',           False, '05-10', [20, 30, 60, 25],   [.40, 1.15, .50], 1.0, .50, 0.85, 3.6, 400, 550, 0,   30, 1.8, .45, 'Fabaceae', 'soy',    2, 10, 1300, 35, -1,  (6.0, 7.5), 'legume'),
 'pea':         ('Горох',         False, '03-25', [20, 25, 35, 15],   [.40, 1.15, .30], 0.8, .35, 1.15, 3.5, 300, 420, 0,   40, 1.5, .40, 'Fabaceae', 'pea',    4, 4, 1100, 30, -5,   (6.0, 7.5), 'legume'),
 'rapeseed':    ('Озимий ріпак',  True,  '08-25', [160, 60, 40, 30], [.35, 1.10, .35], 1.5, .60, 1.00, 3.8, 480, 650, 180, 15, 2.8, .25, 'Brassicaceae', 'clubroot', 4, 0, 2000, 30, -15, (6.0, 7.5), 'oilseed'),
 'clover':      ('Конюшина',      False, '04-01', [30, 40, 120, 30],  [.40, 1.00, .85], 1.2, .50, 0.90, 8.0, 120, 300, 0,   80, 3.5, .02, 'Fabaceae', 'clover', 5, 5, 1200, 35, -15,  (6.0, 7.5), 'forage'),
 'cotton':      ('Бавовник',      False, '05-01', [30, 50, 55, 45],   [.35, 1.18, .60], 1.4, .65, 0.85, 1.6, 1600, 1200, 140, 0, 2.0, .45, 'Malvaceae', 'cotton', 2, 15.6, 1300, 40, -1, (5.8, 8.0), 'fiber'),
 'almond':      ('Мигдаль (сад)', False, '03-01', [30, 50, 130, 30],  [.40, .90, .65], 2.0, .40, 1.00, 2.5, 4500, 6500, 220, 0, 2.0, .10, 'Rosaceae', 'orchard', 0, 7, 2400, 40, -2,  (6.0, 8.0), 'perennial'),
}
KEYS = ['name', 'winter', 'sow', 'stages', 'kc', 'root', 'p', 'ky', 'ymax', 'price', 'cost', 'n_demand', 'n_credit', 'residue_c', 'c_factor', 'family', 'pest', 'min_return', 'tbase', 'gdd', 'heat', 'frost', 'ph', 'role']
CROPS = {k: dict(zip(KEYS, v)) for k, v in C.items()}
N_PRICE = 1.1           # $/kg N
IRRIGATION_COST = 0.25  # $/mm/ha (≈ $25 per 1 000 m³ incl. energy)
COVER_COST = 60         # $/ha for a winter cover crop
CN = {'A': 67, 'B': 78, 'C': 85, 'D': 89}
T_SOIL_LOSS = 5.0       # tolerable soil loss, t/ha/yr (conservative EU threshold)


@dataclass
class Site:
    lat: float
    awc_mm_m: float
    ph: float | None
    om_pct: float
    k_factor: float
    hsg: str
    ls: float
    erosivity: float
    t_mean: float
    irrigated: bool
    max_irrigation_mm: float | None = None


def _kc(day, stages, kc):
    ini, dev, mid, late = stages
    if day < ini: return kc[0]
    if day < ini + dev: return kc[0] + (kc[1] - kc[0]) * (day - ini) / dev
    if day < ini + dev + mid: return kc[1]
    return kc[1] + (kc[2] - kc[1]) * (day - ini - dev - mid) / late


def simulate_crop(crop_id, clim, index, site: Site, years, dT=0.0, dP=0.0):
    """Daily water balance for one crop across harvest years. Returns per-year dicts."""
    c = CROPS[crop_id]; total = sum(c['stages']); out = {}
    taw = site.awc_mm_m * c['root']; raw = c['p'] * taw
    cn = CN.get(site.hsg, 82); S = 25400 / cn - 254; Ia = 0.2 * S
    south = site.lat < 0; mm, dd = map(int, c['sow'].split('-'))
    monthly_def = np.zeros(12)
    for y in years:
        sy = y - 1 if c['winter'] else y
        try: sow = date(sy, mm, dd)
        except ValueError: continue
        if south: sow = sow + timedelta(days=182)
        i0 = index.get(sow.isoformat())
        if i0 is None or i0 + total >= len(clim['time']): continue
        dr = 0.3 * taw; etc_s = eta_s = peff_s = irr = gdd = 0.0; heat_days = 0; frost_hit = False; frost_marginal = False
        flower = c['stages'][0] + c['stages'][1]
        for d in range(total):
            i = i0 + d
            tx = (clim['tmax'][i] or 0) + dT; tn = (clim['tmin'][i] or 0) + dT
            p = max(0.0, (clim['precip'][i] or 0) * (1 + dP / 100)); et0 = (clim['et0'][i] or 0) * (1 + .03 * dT)
            q = (p - Ia) ** 2 / (p + .8 * S) if p > Ia else 0.0; pe = p - q
            etc = _kc(d, c['stages'], c['kc']) * et0
            ks = 1.0 if dr <= raw else max(0.0, (taw - dr) / ((1 - c['p']) * taw))
            eta = ks * etc
            dr = dr - pe + eta
            if dr < 0: dr = 0.0
            if site.irrigated and dr > raw and (site.max_irrigation_mm is None or irr < site.max_irrigation_mm):
                add = dr if site.max_irrigation_mm is None else min(dr, site.max_irrigation_mm - irr)
                irr += add / .8; dr -= add
            if dr > taw: dr = taw
            etc_s += etc; eta_s += eta; peff_s += pe
            monthly_def[int(clim['time'][i][5:7]) - 1] += etc - eta
            gdd += max(0.0, (tx + tn) / 2 - c['tbase'])
            if abs(d - flower) <= 10 and tx >= c['heat']: heat_days += 1
            if c['winter'] and d < c['stages'][0] and tn < 0:
                crown = 0.6 * tn  # snow/soil insulation of the tillering node (screening approximation)
                if crown <= c['frost']: frost_hit = True
                elif crown <= c['frost'] + 4: frost_marginal = True
            if not c['winter'] and d < 30 and tn <= c['frost']: frost_hit = True
        fw = max(0.0, 1 - c['ky'] * (1 - eta_s / etc_s)) if etc_s else 1.0
        fh = max(.5, 1 - .03 * heat_days)
        ff = .6 if frost_hit else .92 if frost_marginal else 1.0
        fg = min(1.0, gdd / c['gdd']) ** 2 if c['gdd'] else 1.0
        fph = .85 if site.ph is not None and not c['ph'][0] <= site.ph <= c['ph'][1] else 1.0
        factor = fw * fh * ff * fg * fph
        out[y] = {'yield': c['ymax'] * factor, 'factor': factor, 'fw': fw, 'fh': fh, 'ff': ff, 'fg': fg, 'etc': etc_s, 'eta': eta_s, 'deficit': etc_s - eta_s,
                  'irrigation': irr, 'peff': peff_s, 'heat_days': heat_days, 'frost': frost_hit, 'gdd_ratio': gdd / c['gdd'] if c['gdd'] else 1,
                  'sow_doy': sow.timetuple().tm_yday, 'harvest_doy': (sow + timedelta(days=total)).timetuple().tm_yday}
    n_years = max(1, len(out))
    return out, (monthly_def / n_years).round(1).tolist()


def soc_fraction(site: Site):
    return site.om_pct / 1.724 / 100  # kg C per kg soil


def soc_stock(site: Site, bd=1.3, depth_cm=30):
    return site.om_pct / 1.724 * 10 * bd * depth_cm / 10  # t C/ha


def evaluate_rotation(seq, sims, site: Site, years, prices, cover=False):
    """Cycle `seq` over the climate years for every phase; aggregate the farm-level outcomes."""
    L = len(seq); gm, yrs_gm, deficits, etcs, irr, nfert, carbon, revenue = [], {}, [], [], [], [], [], []
    min_n = min(60.0, 15 * site.om_pct)
    for phase in range(L):
        for k, y in enumerate(years):
            crop = seq[(k + phase) % L]; prev = seq[(k + phase - 1) % L]; r = sims[crop].get(y)
            if r is None: continue
            c = CROPS[crop]; price = prices.get(crop, c['price'])
            n_need = c['n_demand'] * (0.5 + 0.5 * r['factor']) if c['n_demand'] else 0
            n = max(0.0, n_need - CROPS[prev]['n_credit'] - min_n - (20 if cover else 0)) if n_need else 0.0
            value = r['yield'] * price - c['cost'] - n * N_PRICE - r['irrigation'] * IRRIGATION_COST - (COVER_COST if cover and gap_days(prev, crop) > 75 else 0)
            revenue.append(r['yield'] * price); gm.append(value); yrs_gm.setdefault(y, []).append(value); deficits.append(r['deficit']); etcs.append(r['etc']); irr.append(r['irrigation']); nfert.append(n)
            carbon.append(c['residue_c'] * (0.4 + 0.6 * r['factor']) + (0.8 if cover and gap_days(prev, crop) > 75 else 0))
    if not gm: return None
    gm = np.array(gm); yearly = np.array([np.mean(yrs_gm[y]) for y in sorted(yrs_gm)])
    c_rot = float(np.mean([CROPS[x]['c_factor'] for x in seq]))
    bare = float(np.mean([gap_days(seq[i - 1], seq[i]) for i in range(L)])) if L > 1 or CROPS[seq[0]]['role'] != 'perennial' else 0.0
    if cover: c_rot *= 0.75 if bare > 75 else 1.0
    erosion = site.erosivity * site.k_factor * max(site.ls, .05) * c_rot
    stock = soc_stock(site); inputs = float(np.mean(carbon))
    pest = pest_break(seq)
    return {'gm_mean': float(gm.mean()), 'revenue_mean': float(np.mean(revenue)), 'gm_p10': float(np.percentile(yearly, 10)), 'gm_p90': float(np.percentile(yearly, 90)), 'loss_prob': float((yearly < 0).mean()),
            'yearly_gm': yearly.round(0).tolist(), 'deficit_mm': float(np.mean(deficits)), 'etc_mm': float(np.mean(etcs)), 'irrigation_mm': float(np.mean(irr)),
            'n_fert_kg': float(np.mean(nfert)), 'erosion_t': float(erosion), 'c_factor': c_rot, 'carbon_input_t': inputs, 'soc_change_t': 0.0,
            'soc_stock_t': float(stock), 'pest_break': pest, 'bare_days': bare, 'families': len({CROPS[x]['family'] for x in seq}),
            'legume_share': sum(CROPS[x]['role'] in ('legume', 'forage') for x in seq) / L}


def season_window(crop):
    c = CROPS[crop]; mm, dd = map(int, c['sow'].split('-')); sow = date(2001, mm, dd).timetuple().tm_yday
    return sow, (sow + sum(c['stages'])) % 365


def gap_days(prev, nxt):
    """Days between harvest of `prev` and sowing of `nxt` (bare-soil window)."""
    if CROPS[prev]['role'] == 'perennial' and prev == nxt: return 0
    _, harvest = season_window(prev); sow, _ = season_window(nxt)
    return (sow - harvest) % 365


def pest_break(seq):
    L = len(seq); ok = 0
    for i, crop in enumerate(seq):
        need = CROPS[crop]['min_return']
        if need == 0: ok += 1; continue
        dist = next((d for d in range(1, L + 1) if CROPS[seq[(i - d) % L]]['pest'] == CROPS[crop]['pest']), L)
        ok += dist >= need
    return ok / L


def valid_sequence(seq):
    """Hard agronomic rules. Recommended return intervals are scored in pest_break, not forbidden."""
    L = len(seq)
    if any(CROPS[x]['role'] == 'perennial' for x in seq): return L == 1
    if L == 1: return False
    for i, crop in enumerate(seq):
        if seq[i - 1] == crop: return False
        need = CROPS[crop]['min_return']; hard = max(2, need - 1) if need else 0
        dist = next((d for d in range(1, L + 1) if CROPS[seq[(i - d) % L]]['pest'] == CROPS[crop]['pest']), L)
        if dist < hard: return False
    if all(CROPS[x]['family'] == 'Poaceae' for x in seq) and L > 2: return False
    return True


def canonical(seq):
    seq = list(seq); L = len(seq)
    for p in range(1, L):
        if L % p == 0 and seq == seq[:p] * (L // p): seq = seq[:p]; L = p; break
    return min(tuple(seq[i:] + seq[:i]) for i in range(L))


def relative_soc(m, base, site: Site):
    """ICBM humified input (h = 0.125) relative to continuing current practice, minus carbon carried by extra erosion.
    Assumes the present soil carbon is in balance with the current rotation; reports the divergence from that path."""
    return 0.125 * (m['carbon_input_t'] - base['carbon_input_t']) - (m['erosion_t'] - base['erosion_t']) * soc_fraction(site)


CRITERIA = {  # key, better direction, scale for tanh around current
    'gm_mean': (1, 150), 'gm_p10': (1, 150), 'loss_prob': (-1, .15), 'deficit_mm': (-1, 60), 'irrigation_mm': (-1, 80),
    'soc_change_t': (1, .15), 'erosion_t': (-1, 1.5), 'n_fert_kg': (-1, 40), 'pest_break': (1, .25), 'bare_days': (-1, 60),
}
GROUPS = {'economy': {'gm_mean': 1}, 'resilience': {'gm_p10': .6, 'loss_prob': .4}, 'water': {'deficit_mm': .7, 'irrigation_mm': .3},
          'soil': {'soc_change_t': .35, 'erosion_t': .3, 'n_fert_kg': .15, 'pest_break': .1, 'bare_days': .1}}


def criterion_scores(m, base):
    out = {}
    for k, (sign, scale) in CRITERIA.items():
        delta = (m[k] - base[k]) * sign
        if k == 'erosion_t': delta = -math.log(max(m[k], .01) / max(base[k], .01)) * 1.5
        out[k] = 50 + 50 * math.tanh(delta / scale)
    return out


def group_scores(cs):
    return {g: sum(cs[k] * w for k, w in parts.items()) for g, parts in GROUPS.items()}


def run(site: Site, clim, current, weights, prices=None, excluded=(), dT=0.0, dP=0.0, allow_cover=True, max_len=5):
    prices = prices or {}
    index = {t: i for i, t in enumerate(clim['time'])}
    first, last = int(clim['time'][0][:4]) + 1, int(clim['time'][-1][:4])
    years = list(range(first, last + 1))
    sims, monthly = {}, {}
    for crop in CROPS:
        sims[crop], monthly[crop] = simulate_crop(crop, clim, index, site, years, dT, dP)
    years = [y for y in years if all(y in sims[c] for c in current if c in sims)] or years
    suit = {c: float(np.mean([r['factor'] for r in sims[c].values()])) if sims[c] else 0.0 for c in CROPS}
    current = [c for c in current if c in CROPS] or ['wheat', 'maize', 'sunflower']
    base = evaluate_rotation(current, sims, site, years, prices)
    candidates = [c for c in CROPS if c not in excluded and suit[c] >= .55 and (CROPS[c]['role'] != 'perennial' or site.irrigated)]
    # keep the agronomically and economically strongest set to bound the search
    candidates = sorted(candidates, key=lambda c: -(suit[c] * CROPS[c]['ymax'] * prices.get(c, CROPS[c]['price']) - CROPS[c]['cost']))[:9]
    w_total = sum(weights.values()) or 1; w = {k: v / w_total for k, v in weights.items()}
    seen, pool = set(), []
    for L in range(1, max_len + 1):
        for seq in itertools.product(candidates, repeat=L):
            seq = list(seq); key = canonical(seq)
            if key in seen or not valid_sequence(seq): continue
            seen.add(key)
            for cover in ([False, True] if allow_cover else [False]):
                m = evaluate_rotation(list(key), sims, site, years, prices, cover)
                if not m: continue
                m['soc_change_t'] = relative_soc(m, base, site)
                cs = criterion_scores(m, base); gs = group_scores(cs)
                pool.append({'crops': list(key), 'cover_crop': cover, 'metrics': m, 'criteria': cs, 'groups': gs, 'score': sum(gs[g] * w.get(g, 0) for g in gs)})
    base_cs = criterion_scores(base, base); base_gs = group_scores(base_cs)
    current_s = {'crops': current, 'cover_crop': False, 'metrics': base, 'criteria': base_cs, 'groups': base_gs, 'score': sum(base_gs[g] * w.get(g, 0) for g in base_gs)}
    picks = [('S1', 'current', current_s)]
    def best(key, cond=lambda s: True):
        for s in sorted(pool, key=key):
            if cond(s) and all(canonical(s['crops']) != canonical(p[2]['crops']) for p in picks): return s
    viable = lambda s: s['metrics']['gm_mean'] >= base['gm_mean'] - max(120, abs(base['gm_mean']) * .25)
    for label, key, cond in [('balanced', lambda s: -s['score'], lambda s: True),
                             ('soil', lambda s: -s['groups']['soil'], viable),
                             ('water', lambda s: -(s['groups']['water'] * .6 + s['groups']['resilience'] * .4), viable),
                             ('income', lambda s: -s['metrics']['gm_mean'], lambda s: s['groups']['soil'] >= 40)]:
        s = best(key, cond)
        if s: picks.append((f'S{len(picks) + 1}', label, s))
    strategies = []
    for sid, label, s in picks:
        win = float(np.mean(np.array(s['metrics']['yearly_gm']) > np.array(base['yearly_gm']))) if len(s['metrics']['yearly_gm']) == len(base['yearly_gm']) else None
        md = (np.sum([monthly[c] for c in s['crops']], axis=0) / len(s['crops'])).round(1).tolist()
        strategies.append({'id': sid, 'kind': label, **s, 'monthly_deficit': md, 'win_rate_vs_current': win, 'risks': crop_risks(s['crops'], sims, years), 'benefits': crop_benefits(s, base)})
    recommended = max(strategies, key=lambda s: s['score'])['id']
    cur_months = np.sum([monthly[c] for c in current], axis=0) / len(current)
    return {'strategies': strategies, 'recommended': recommended, 'weights': w, 'years': [years[0], years[-1]], 'n_years': len(years), 'searched': len(pool),
            'suitability': {c: round(v, 3) for c, v in sorted(suit.items(), key=lambda x: -x[1])},
            'vulnerable_months': [round(float(x), 1) for x in cur_months], 'bare_windows': [{'after': current[i - 1], 'before': current[i], 'days': gap_days(current[i - 1], current[i])} for i in range(len(current))],
            'scenario': {'temperature_delta': dT, 'precipitation_delta': dP}, 'model_version': 'rotation-engine-2.1',
            'calendar': {c: {'sow': season_window(c)[0] if site.lat >= 0 else (season_window(c)[0] + 182) % 365, 'days': sum(CROPS[c]['stages']), 'stages': CROPS[c]['stages'], 'kc': CROPS[c]['kc'], 'winter': CROPS[c]['winter']} for c in CROPS},
            'crop_params': {c: {k: CROPS[c][k] for k in ['ky', 'root', 'p', 'ymax', 'price', 'cost', 'n_demand', 'n_credit', 'residue_c', 'c_factor', 'tbase', 'gdd', 'heat', 'frost', 'family', 'min_return']} for c in CROPS},
            'site_params': {'awc_mm_m': site.awc_mm_m, 'k_factor': site.k_factor, 'ls': site.ls, 'erosivity': site.erosivity, 'hsg': site.hsg, 'cn': CN.get(site.hsg, 82), 'om_pct': site.om_pct, 'soc_stock_t': round(soc_stock(site), 1)}}


def crop_risks(seq, sims, years):
    out = []
    for crop in dict.fromkeys(seq):
        r = [sims[crop][y] for y in years if y in sims[crop]]
        if not r: continue
        n = len(r); heat = sum(x['fh'] < .9 for x in r); frost = sum(x['frost'] for x in r); dry = sum(x['fw'] < .75 for x in r); gdd = sum(x['fg'] < .9 for x in r)
        if heat: out.append({'crop': crop, 'type': 'heat', 'years': heat, 'of': n})
        if frost: out.append({'crop': crop, 'type': 'winterkill' if CROPS[crop]['winter'] else 'frost', 'years': frost, 'of': n})
        if dry: out.append({'crop': crop, 'type': 'drought', 'years': dry, 'of': n})
        if gdd: out.append({'crop': crop, 'type': 'season_short', 'years': gdd, 'of': n})
        if CROPS[crop]['pest'] == 'sclerotinia': out.append({'crop': crop, 'type': 'sunflower_interval', 'years': 0, 'of': n})
    return out


def crop_benefits(s, base):
    m = s['metrics']; out = []
    roles = {CROPS[c]['role'] for c in s['crops']}
    if 'legume' in roles or 'forage' in roles: out.append('nitrogen_fixation')
    if any(CROPS[c]['root'] >= 1.6 for c in s['crops']): out.append('deep_roots')
    if any(CROPS[c]['winter'] for c in s['crops']) or s['cover_crop']: out.append('winter_cover')
    if 'drought' in roles: out.append('drought_tolerant')
    if m['pest_break'] > base['pest_break'] + .01: out.append('pest_break')
    if m['families'] >= 3: out.append('diversity')
    return out
