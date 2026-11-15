import math
from datetime import date, datetime, timedelta, timezone
import httpx
from app.config import settings

CMR_URL = 'https://cmr.earthdata.nasa.gov/search/granules.json'

def calculate_ndvi(nir: float, red: float) -> float:
    """Calculate Normalized Difference Vegetation Index.
    NDVI = (NIR - RED) / (NIR + RED)
    Returns a value bounded to [-1.0, 1.0].
    """
    denom = nir + red
    if abs(denom) < 1e-6:
        return 0.0
    ndvi = (nir - red) / denom
    return round(max(-1.0, min(1.0, ndvi)), 4)

def generate_synthetic_hls_scenes(field_id: str, latitude: float, longitude: float, start: date, end: date) -> list[dict]:
    """Generates realistic HLS scenes conforming to NASA HLSS30/HLSL30 data model
    when live Earthdata tokens are unavailable or offline.
    Uses realistic phenology for Ukrainian agricultural regions (Poltava / forest-steppe):
    - Winter (Dec-Feb): snow/dormancy NDVI 0.15 - 0.25
    - Spring (Mar-May): rapid greenup NDVI 0.35 - 0.65
    - Summer peak (Jun-Jul): maximum canopy NDVI 0.72 - 0.84
    - Autumn (Aug-Oct): maturity, harvest, drying NDVI 0.25 - 0.45
    Every scene is explicitly tagged with is_demo: True.
    """
    scenes = []
    current_date = start
    scene_index = 0

    while current_date <= end:
        # HLS revisit cadence is roughly every 2-4 days combined Landsat 8/9 + Sentinel-2A/B
        current_date += timedelta(days=6)
        if current_date > end:
            break

        day_of_year = current_date.timetuple().tm_yday
        # Phenological sine model centered on day 190 (mid-July)
        phase = (day_of_year - 80) / 220.0
        if 0.0 <= phase <= 1.0:
            base_curve = math.sin(phase * math.pi)
            ndvi_mean = 0.25 + 0.55 * (base_curve ** 1.3)
        else:
            ndvi_mean = 0.18 + 0.05 * math.sin(day_of_year / 365.0 * 2 * math.pi)

        # Slight variation for noise & cloud cover
        cloud_cover = round(float((scene_index * 17) % 35), 1)
        scene_index += 1
        if cloud_cover > 25:
            # Overcast scene; degrade quality
            continue

        satellite = 'Sentinel-2B' if scene_index % 2 == 0 else 'Landsat-9'
        product = 'HLSS30.v2.0' if 'Sentinel' in satellite else 'HLSL30.v2.0'

        # Synthesize surface reflectance NIR and RED matching target NDVI
        # NDVI = (NIR - RED)/(NIR + RED)  =>  NIR = RED * (1 + NDVI)/(1 - NDVI)
        red_refl = 0.06
        nir_refl = round(red_refl * (1 + ndvi_mean) / max(0.01, 1 - ndvi_mean), 4)

        ndvi_calc = calculate_ndvi(nir_refl, red_refl)
        ndvi_min = round(max(0.0, ndvi_calc - 0.08), 3)
        ndvi_max = round(min(1.0, ndvi_calc + 0.07), 3)

        scenes.append({
            'field_id': field_id,
            'scene_date': current_date.isoformat(),
            'satellite': satellite,
            'product': product,
            'spatial_resolution': '30 m × 30 m gridded reflectance',
            'spectral_bands': {
                'nir_band': 'B8A' if 'Sentinel' in satellite else 'B05',
                'red_band': 'B04',
                'nir_reflectance': nir_refl,
                'red_reflectance': red_refl,
            },
            'ndvi_mean': ndvi_calc,
            'ndvi_min': ndvi_min,
            'ndvi_max': ndvi_max,
            'cloud_cover_pct': cloud_cover,
            'is_demo': True,
            'quality': 'high' if cloud_cover < 10 else 'medium',
            'latitude': latitude,
            'longitude': longitude,
        })

    return scenes

async def fetch_hls_observations(field_id: str, latitude: float, longitude: float, start: date, end: date) -> list[dict]:
    """Legacy explicit demonstration series. CMR metadata alone cannot provide NDVI.

    Real per-pixel observations are calculated by field_evidence from reflectance
    and quality masks. Never label a constant derived from catalog metadata as real.
    """
    return generate_synthetic_hls_scenes(field_id, latitude, longitude, start, end)
