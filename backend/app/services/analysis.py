from collections import defaultdict
from statistics import mean
from app.services.crops import CROPS

class InsufficientData(ValueError):
    pass

def clamp(x):
    return max(0, min(100, x))

def climate_summary(payload):
    months = defaultdict(list)
    seasons = defaultdict(list)
    for row in payload['rows']:
        months[row['date'][:7]].append(row)
        if 4 <= int(row['date'][5:7]) <= 9:
            seasons[row['date'][:4]].append(row)
    monthly = []
    for month, rows in sorted(months.items()):
        ts = [r['temperature'] for r in rows if r['temperature'] is not None]
        ps = [r['precipitation'] for r in rows if r['precipitation'] is not None]
        monthly.append({'month': month, 'temperature': round(mean(ts), 2) if ts else None, 'precipitation': round(sum(ps), 2) if ps else None, 'valid_temperature_days': len(ts), 'valid_precipitation_days': len(ps), 'days': len(rows)})
    # Require >=95% of a full April–September season. Never annualize a short sample.
    complete = {y: [r for r in rows if r['temperature'] is not None and r['precipitation'] is not None] for y, rows in seasons.items()}
    complete = {y: rows for y, rows in complete.items() if len(rows) >= 174}
    return {'monthly': monthly, 'seasons': complete}

def evaluate(field, payload, request):
    summary = climate_summary(payload)
    seasons = summary['seasons']
    if not seasons:
        raise InsufficientData('Load April–September with at least 95% complete daily data (174 of 183 days) before comparing rotations.')
    rows = [r for season in seasons.values() for r in season]
    baseline_temp = mean(r['temperature'] for r in rows)
    rain = mean(sum(r['precipitation'] for r in season) for season in seasons.values())
    adjusted_rain = rain * (1 + request.precipitation_delta / 100)
    temperature = baseline_temp + request.temperature_delta
    # Defined heuristic relative climatic stress index, not a drought probability.
    stress = clamp((450 - adjusted_rain) / 450 * 70 + max(0, temperature - 18) * 5)
    weights = request.weights.model_dump()
    total_weight = sum(weights.values())
    normalized = {key: value / total_weight for key, value in weights.items()}
    strategies = [('S1', field.crop_history), ('S2', ['wheat', 'pea', 'barley', 'clover']), ('S3', ['barley', 'pea', 'sorghum'])]
    result = []
    for strategy, sequence in strategies:
        crops = [CROPS[c] for c in sequence]
        water_need = mean(c['water_mm'] for c in crops) * (1 + .04 * request.temperature_delta)
        soil_penalty = 8 if field.soil_type == 'sand' else 0
        ph_penalty = sum(15 for c in crops if field.soil_ph is not None and not c['ph'][0] <= field.soil_ph <= c['ph'][1]) / len(crops)
        repeated = sum(crops[i]['family'] == crops[(i + 1) % len(crops)]['family'] for i in range(len(crops))) / len(crops)
        scores = {'water': clamp(100 * adjusted_rain / water_need - soil_penalty), 'soil': clamp(mean(c['cover'] for c in crops) - repeated * 15 - ph_penalty), 'resilience': clamp(mean(c['drought'] for c in crops) - stress * .35 - ph_penalty), 'economy': mean(c['market'] for c in crops)}
        contributions = {k: round(scores[k] * normalized[k], 2) for k in scores}
        result.append({'id': strategy, 'crops': sequence, 'score': round(sum(scores[k] * normalized[k] for k in scores), 1), 'criteria': {k: round(v, 1) for k, v in scores.items()}, 'contributions': contributions, 'water_need_mm': round(water_need), 'rainfall_gap_mm': round(max(0, water_need - adjusted_rain)), 'ph_penalty': round(ph_penalty, 1), 'family_repeat_fraction': round(repeated, 2), 'limitations': ['heuristic_not_yield', 'market_not_prices', 'equipment_check'] + (['sunflower_interval'] if 'sunflower' in sequence else []) + (['perennial_orchard'] if any(CROPS[c]['role'] == 'perennial' for c in sequence) else []) + (['soil_unknown'] if field.soil_type == 'unknown' or field.soil_ph is None else []) + (['irrigation_unquantified'] if field.irrigation else [])})
    result.sort(key=lambda s: (-s['score'], s['id']))
    return {'model_version': 'rotation-heuristic-0.1', 'recommended': result[0]['id'], 'strategies': result, 'weights': normalized, 'climate': {'baseline_temperature_c': round(baseline_temp, 2), 'temperature_c': round(temperature, 2), 'baseline_precipitation_mm': round(rain, 1), 'precipitation_mm': round(adjusted_rain, 1), 'stress_index': round(stress, 1), 'hot_mean_days_per_season': round(sum(r['temperature'] + request.temperature_delta > 25 for r in rows) / len(seasons), 1), 'seasons': sorted(seasons), 'valid_days': len(rows)}, 'scenario': {'conditional': request.temperature_delta != 0 or request.precipitation_delta != 0, 'temperature_delta': request.temperature_delta, 'precipitation_delta': request.precipitation_delta}, 'provenance': {k: payload[k] for k in ['source', 'product', 'kind', 'start', 'end', 'coverage', 'downloaded_at', 'spatial_resolution']}, 'explanation': {'winner': result[0]['id'], 'margin': round(result[0]['score'] - result[1]['score'], 1), 'strongest_contribution': max(result[0]['contributions'], key=result[0]['contributions'].get), 'template': 'weighted-comparison-v1'}}
