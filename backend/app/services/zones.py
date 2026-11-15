"""Management zones, limiting factors and a soil-sampling route on a 20 m field grid.

Layers: SRTM terrain (elevation, slope, flow, TWI, LS), soil erodibility, rainfall
erosivity, and — when available — a Sentinel-2 NDVI scene from peak season.
Zones are k-means clusters of standardised layers, ordered by a productivity index.
Values are modelled screening estimates to guide scouting and sampling, not
yield-monitor measurements.
"""
import math
import numpy as np

T_SOIL_LOSS = 5.0


def _z(a, mask):
    v = a[mask]; s = v.std()
    return (a - v.mean()) / (s if s > 1e-9 else 1)


def sample_ndvi(raster, lats, lons):
    if not raster or not raster.get('grid'): return None
    g = raster['grid']; l, b, r, t = g['bounds']; h, w = g['height'], g['width']; vals = g['values']
    out = np.full((len(lats), len(lons)), np.nan)
    for i, la in enumerate(lats):
        row = int((t - la) / (t - b) * h)
        if not 0 <= row < h: continue
        for j, lo in enumerate(lons):
            col = int((lo - l) / (r - l) * w)
            if 0 <= col < w and vals[row][col] is not None: out[i, j] = vals[row][col]
    return out


def smooth(a, mask, passes=2):
    """Masked 3×3 mean filter: removes single-cell noise from 30 m source data resampled to 20 m."""
    a = np.where(mask, a, 0.0); w = mask.astype(float)
    for _ in range(passes):
        pa, pw = np.pad(a, 1), np.pad(w, 1); sa = np.zeros_like(a); sw = np.zeros_like(w)
        for di in range(3):
            for dj in range(3):
                sa += pa[di:di + a.shape[0], dj:dj + a.shape[1]]; sw += pw[di:di + a.shape[0], dj:dj + a.shape[1]]
        a = np.where(mask, sa / np.maximum(sw, 1e-9), 0.0)
    return a


def majority(zone, mask, k, passes=2):
    for _ in range(passes):
        p = np.pad(zone, 1); out = zone.copy()
        for i in range(zone.shape[0]):
            for j in range(zone.shape[1]):
                if not mask[i, j]: continue
                win = p[i:i + 3, j:j + 3].ravel(); win = win[win > 0]
                counts = np.bincount(win, minlength=k + 1)
                if counts.max() >= 5: out[i, j] = counts.argmax()
        zone = out
    return zone


def kmeans(X, k, init, iters=40):
    centers = init.copy()
    for _ in range(iters):
        d = ((X[:, None, :] - centers[None, :, :]) ** 2).sum(-1); lab = d.argmin(1)
        new = np.array([X[lab == c].mean(0) if (lab == c).any() else centers[c] for c in range(k)])
        if np.allclose(new, centers): break
        centers = new
    return lab


def build_zones(grid, soil, climate, base=None, raster=None, k=4):
    rows, cols = grid['rows'], grid['cols']; l, b, r, t = grid['bounds']; cell = grid['cell_m']
    inside = np.array(grid['inside'], bool)
    elev, slope, twi, ls = (np.array(grid[x], float) for x in ['elevation', 'slope_pct', 'twi', 'ls'])
    dlat = (t - b) / rows; dlon = (r - l) / cols
    lats = t - (np.arange(rows) + .5) * dlat; lons = l + (np.arange(cols) + .5) * dlon
    ndvi = sample_ndvi(raster, lats, lons)
    has_ndvi = ndvi is not None and np.isfinite(ndvi[inside]).mean() > .5
    if has_ndvi: ndvi = np.where(np.isfinite(ndvi), ndvi, np.nanmedian(ndvi[inside]))
    R = climate.get('erosivity_R', 1500); K = soil.get('k_factor_si', .03); c_rot = (base or {}).get('c_factor', .35)
    erosion = R * K * np.maximum(ls, .03) * c_rot
    balance = climate.get('season_balance_mean_mm', -200)
    ez, sz, tz = _z(elev, inside), _z(smooth(slope, inside), inside), _z(smooth(twi, inside), inside)
    if has_ndvi: ndvi = smooth(ndvi, inside, 1)
    # Water accumulation helps in a dry season and hurts in a wet one.
    wet_sign = 1.0 if balance < -150 else -0.5
    pi = (0.6 * _z(ndvi, inside) if has_ndvi else 0) + 0.25 * wet_sign * tz - 0.25 * _z(np.log(erosion + .01), inside) - (0.1 * sz if not has_ndvi else 0)
    pi = _z(smooth(pi, inside), inside)
    feats = [ez, sz, tz] + ([_z(ndvi, inside)] if has_ndvi else [])
    X = np.stack([f[inside] for f in feats] + [pi[inside] * 1.5], 1)
    order = np.argsort(pi[inside]); n = len(order); k = min(k, max(2, n // 12))
    init = np.array([X[order[int((i + .5) / k * n)]] for i in range(k)])
    lab = kmeans(X, k, init)
    means = [pi[inside][lab == c].mean() if (lab == c).any() else -9 for c in range(k)]
    rank = {c: i + 1 for i, c in enumerate(np.argsort(means))}
    zone = np.zeros((rows, cols), int); zone[inside] = [rank[c] for c in lab]; zone = majority(zone, inside, k)
    low = elev <= np.percentile(elev[inside], 12)
    factor = np.full((rows, cols), '', object)
    for i in range(rows):
        for j in range(cols):
            if not inside[i, j]: continue
            if erosion[i, j] > T_SOIL_LOSS: factor[i, j] = 'erosion'
            elif tz[i, j] > 1.2 and low[i, j]: factor[i, j] = 'waterlogging' if balance > -250 else 'frost_pocket'
            elif tz[i, j] > 1.2 and balance > -150: factor[i, j] = 'waterlogging'
            elif tz[i, j] < -0.9 and balance < -200: factor[i, j] = 'drought'
            elif has_ndvi and _z(ndvi, inside)[i, j] < -1.0: factor[i, j] = 'low_vigor'
            else: factor[i, j] = 'none'
    cell_ha = cell * cell / 1e4
    revenue = (base or {}).get('revenue_mean'); gm = (base or {}).get('gm_mean')
    zones = []
    for z in range(1, k + 1):
        m = zone == z
        if not m.any(): continue
        rel = float(np.clip(1 + 0.12 * pi[m].mean(), .7, 1.25))
        facs, counts = np.unique(factor[m], return_counts=True); dom = facs[counts.argmax()]
        zgm = gm + revenue * (rel - 1) if gm is not None and revenue else None
        zones.append({'zone': z, 'area_ha': round(float(m.sum() * cell_ha), 2), 'share': round(float(m.sum() / inside.sum()), 3),
                      'productivity_index': round(float(pi[m].mean()), 2), 'relative_yield': round(rel, 3), 'slope_pct': round(float(slope[m].mean()), 2),
                      'erosion_t': round(float(erosion[m].mean()), 2), 'twi': round(float(twi[m].mean()), 2), 'elevation_m': round(float(elev[m].mean()), 1),
                      'ndvi': round(float(ndvi[m].mean()), 3) if has_ndvi else None, 'limiting_factor': str(dom),
                      'factor_shares': {str(f): round(float(c / m.sum()), 2) for f, c in zip(facs, counts)},
                      'gm_per_ha': round(zgm) if zgm is not None else None, 'seed_rate_pct': round((rel - 1) * 60), 'n_rate_pct': round((rel - 1) * 80),
                      'center': centroid_lonlat(m, lats, lons)})
    samples = sampling_plan(zone, lats, lons, inside, cell_ha)
    return {'k': len(zones), 'zones': zones, 'has_ndvi': bool(has_ndvi), 'ndvi_scene': raster.get('date') if has_ndvi and raster else None,
            'grid': {'rows': rows, 'cols': cols, 'bounds': [l, b, r, t], 'cell_m': cell, 'inside': grid['inside'], 'elevation': grid['elevation'],
                     'slope_pct': grid['slope_pct'], 'flow': grid.get('flow'), 'zone': zone.tolist(), 'productivity': np.round(np.where(inside, pi, 0), 2).tolist(),
                     'erosion': np.round(np.where(inside, erosion, 0), 2).tolist(), 'factor': factor.tolist(),
                     'ndvi': np.round(np.where(inside, ndvi, 0), 3).tolist() if has_ndvi else None},
            'samples': samples, 'tolerable_loss_t': T_SOIL_LOSS,
            'method': 'k-means on standardised elevation, slope, TWI' + (', NDVI' if has_ndvi else '') + ' and a productivity index; erosion A = R·K·LS·C (RUSLE); routes: nearest-neighbour'}


def centroid_lonlat(mask, lats, lons):
    idx = np.argwhere(mask); i, j = idx.mean(0)
    # snap to a cell that is actually in the zone
    best = idx[((idx - [i, j]) ** 2).sum(1).argmin()]
    return [round(float(lons[best[1]]), 6), round(float(lats[best[0]]), 6)]


def sampling_plan(zone, lats, lons, inside, cell_ha, per_zone=None):
    points = []
    for z in sorted(set(zone[inside].tolist())):
        idx = np.argwhere(zone == z); n = per_zone or int(min(10, max(3, round(len(idx) * cell_ha / 3))))
        chosen = [idx[len(idx) // 2]]
        while len(chosen) < min(n, len(idx)):
            d = np.min([((idx - c) ** 2).sum(1) for c in chosen], axis=0); chosen.append(idx[d.argmax()])
        points += [{'zone': int(z), 'row': int(c[0]), 'col': int(c[1]), 'lon': round(float(lons[c[1]]), 6), 'lat': round(float(lats[c[0]]), 6)} for c in chosen]
    if not points: return {'points': [], 'route_m': 0}
    start = min(range(len(points)), key=lambda i: (points[i]['row'] * -1, points[i]['col']))
    route = [start]; left = set(range(len(points))) - {start}
    while left:
        cur = points[route[-1]]; nxt = min(left, key=lambda i: (points[i]['row'] - cur['row']) ** 2 + (points[i]['col'] - cur['col']) ** 2)
        route.append(nxt); left.remove(nxt)
    cell_m = math.sqrt(cell_ha * 1e4)
    dist = sum(math.hypot(points[a]['row'] - points[b]['row'], points[a]['col'] - points[b]['col']) for a, b in zip(route, route[1:])) * cell_m
    return {'points': [dict(points[i], order=n + 1) for n, i in enumerate(route)], 'route_m': round(dist)}
