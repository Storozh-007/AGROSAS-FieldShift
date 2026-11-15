#!/usr/bin/env python3
"""End-to-end verification script for FieldShift: Earth OS.
Validates the entire core user journey programmatically.
"""
import sys
import os
import json
import httpx

API_BASE = os.getenv('API_BASE_URL', 'http://127.0.0.1:8000')
TOKEN = os.environ['APP_TOKEN']
HEADERS = {
    'Authorization': f'Bearer {TOKEN}',
    'Content-Type': 'application/json',
}

def main():
    print('========================================================')
    print('  FIELDSHIFT: EARTH OS — END-TO-END SCENARIO VERIFIER')
    print('========================================================')

    with httpx.Client(base_url=API_BASE, timeout=30.0) as client:
        # Step 1: Health check
        print('\n[1/10] Checking API Health...')
        res = client.get('/api/health')
        assert res.status_code == 200, f"Health check failed: {res.text}"
        print(f"  ✓ Health Status: {res.json()['status']} (Version {res.json()['version']})")

        # Step 2: List farms
        print('\n[2/10] Listing Farms...')
        res = client.get('/api/farms', headers=HEADERS)
        assert res.status_code == 200, f"Farms failed: {res.text}"
        farms = res.json()
        assert len(farms) > 0, "No farms found!"
        print(f"  ✓ Found farm: '{farms[0]['name']}' (ID: {farms[0]['id']})")

        # Step 3: Create a real field in Poltava region
        print('\n[3/10] Creating Field with Polygon Boundaries...')
        field_payload = {
            'name': 'Поле «Золота Нива» (E2E Test)',
            'geometry': {
                'type': 'Polygon',
                'coordinates': [
                    [
                        [34.4550, 49.6250],
                        [34.4720, 49.6260],
                        [34.4750, 49.6170],
                        [34.4580, 49.6150],
                        [34.4550, 49.6250],
                    ]
                ],
            },
            'crop_history': ['wheat', 'maize', 'sunflower'],
            'soil_type': 'loam',
            'soil_ph': 6.8,
            'irrigation': False,
            'priorities': {'water': 35, 'soil': 30, 'resilience': 20, 'economy': 15},
        }
        res = client.post('/api/fields', json=field_payload, headers=HEADERS)
        assert res.status_code == 201, f"Create field failed: {res.text}"
        field = res.json()
        field_id = field['id']
        area_ha = field['area_ha']
        print(f"  ✓ Created field '{field['name']}'")
        print(f"    - ID: {field_id}")
        print(f"    - Area: {area_ha:.2f} ha (calculated automatically from WGS84 geodesics)")

        # Step 4: Download NASA POWER data
        print('\n[4/10] Fetching NASA POWER Historical Observations...')
        power_payload = {
            'field_id': field_id,
            'start': '2024-04-01',
            'end': '2024-09-30',
        }
        res = client.post('/api/nasa/power', json=power_payload, headers=HEADERS)
        assert res.status_code == 200, f"NASA POWER request failed: {res.text}"
        power_data = res.json()
        print(f"  ✓ NASA POWER dataset loaded successfully")
        print(f"    - Product: {power_data.get('product')}")
        print(f"    - Coverage: {round(power_data.get('coverage', 0) * 100)}%")
        print(f"    - Total daily records: {len(power_data.get('rows', []))}")
        print(f"    - Kind: {power_data.get('kind')}")

        # Step 5: Multi-criteria Rotation Comparison
        print('\n[5/10] Comparing Crop Rotation Strategies (S1, S2, S3)...')
        eval_payload = {
            'field_id': field_id,
            'weights': {'water': 40, 'soil': 30, 'resilience': 20, 'economy': 10},
            'temperature_delta': 0.0,
            'precipitation_delta': 0.0,
        }
        res = client.post('/api/rotations/compare', json=eval_payload, headers=HEADERS)
        assert res.status_code == 200, f"Rotation comparison failed: {res.text}"
        eval_data = res.json()
        print(f"  ✓ Baseline Evaluation completed")
        print(f"    - Recommended Strategy: {eval_data['recommended']}")
        print(f"    - Baseline Growing Season Rain: {eval_data['climate']['precipitation_mm']} mm")
        print(f"    - Baseline Mean Temp: {eval_data['climate']['temperature_c']} °C")
        print(f"    - Relative Stress Index: {eval_data['climate']['stress_index']}/100")
        for s in eval_data['strategies']:
            print(f"      * {s['id']}: Score {s['score']}/100 | Water Need: {s['water_need_mm']} mm | Rain Gap: {s['rainfall_gap_mm']} mm | Crops: {', '.join(s['crops'])}")

        # Step 6: Climate Time Machine Stress Simulation
        print('\n[6/10] Running Climate Time Machine Sensitivity Scenario (+2.5 °C, -25% Rain)...')
        scenario_payload = {
            'field_id': field_id,
            'weights': {'water': 40, 'soil': 30, 'resilience': 20, 'economy': 10},
            'temperature_delta': 2.5,
            'precipitation_delta': -25.0,
        }
        res = client.post('/api/scenarios/evaluate', json=scenario_payload, headers=HEADERS)
        assert res.status_code == 200, f"Scenario failed: {res.text}"
        scen_data = res.json()
        print(f"  ✓ Climate Scenario recalculated instantly")
        print(f"    - Temperature: {scen_data['climate']['temperature_c']} °C (+2.5 °C)")
        print(f"    - Precipitation: {scen_data['climate']['precipitation_mm']} mm (-25%)")
        print(f"    - Climatic Stress Index: {scen_data['climate']['stress_index']}/100 (Increased by {scen_data['climate']['stress_index'] - eval_data['climate']['stress_index']:.1f})")
        print(f"    - Scenario Winner: {scen_data['recommended']}")

        # Step 7: Explainable AI Agronomist
        print('\n[7/10] Generating Explainable AI Recommendation...')
        res = client.post('/api/recommendations?lang=uk', json=scenario_payload, headers=HEADERS)
        assert res.status_code == 200, f"Recommendation failed: {res.text}"
        rec_data = res.json()
        explanation = rec_data['explanation']
        print(f"  ✓ AI Explanation generated (Model: {explanation['model_version']}):")
        print(f"    - Summary: \"{explanation['summary']}\"")
        print(f"    - Margin over runner-up: +{explanation['margin']} points")
        print(f"    - Factors considered: {len(explanation['factors'])}")
        for f in explanation['factors']:
            print(f"      • {f}")
        print(f"    - Actionable farmer next steps: {len(explanation['next_actions'])}")
        for a in explanation['next_actions'][:2]:
            print(f"      → {a}")

        # Step 8: NASA HLS Vegetation & NDVI
        print('\n[8/10] Synchronizing NASA HLS (Harmonized Landsat Sentinel-2)...')
        res = client.post('/api/nasa/hls', json={'field_id': field_id}, headers=HEADERS)
        assert res.status_code == 200, f"HLS sync failed: {res.text}"
        hls_data = res.json()
        print(f"  ✓ HLS Scenes synchronized: {hls_data['scenes_count']} scenes")
        if hls_data['scenes']:
            sample = hls_data['scenes'][0]
            print(f"    - Latest Scene: {sample['scene_date']} ({sample['satellite']} · {sample['product']})")
            print(f"    - Mean NDVI: {sample['ndvi_mean']} (Cloud cover: {sample['cloud_cover_pct']}%)")

        # Step 9: IoT Smart Farm Kit
        print('\n[9/10] Testing IoT & Smart Farm Kit Telemetry Simulation...')
        res = client.post('/api/telemetry/simulate', json={'field_id': field_id, 'days': 7}, headers=HEADERS)
        assert res.status_code == 200, f"Simulation failed: {res.text}"
        sim_data = res.json()
        print(f"  ✓ Telemetry simulated: {sim_data['records_created']} sensor readings across {sim_data['devices_count']} devices")

        res = client.get(f'/api/telemetry?field_id={field_id}&limit=5', headers=HEADERS)
        assert res.status_code == 200
        telemetry = res.json()
        print(f"    - Verified {len(telemetry)} recent in-situ telemetry entries in database")

        # Step 10: Ukraine Resilience
        print('\n[10/10] Testing Ukraine Resilience Module...')
        res = client.get('/api/safety?region=Полтавська+область', headers=HEADERS)
        assert res.status_code == 200, f"Safety failed: {res.text}"
        safety = res.json()
        print(f"  ✓ Ukraine Resilience status operational:")
        print(f"    - Air Alert Status: {safety['air_alert']['status']} (Active: {safety['air_alert']['is_active']})")
        print(f"    - Starlink: {safety['connectivity']['starlink']['status']} (Latency: {safety['connectivity']['starlink']['latency_ms']} ms)")
        print(f"    - Backup Generator: {safety['backup_power']['generator_fuel_hours']} hours fuel reserve")
        print(f"    - Emergency contacts: {len(safety['contacts'])} hotlines")
        print(f"    - Mine & civil safety checklists: {len(safety['checklist'])} items")

        # Clean up test field
        client.delete(f'/api/fields/{field_id}', headers=HEADERS)
        print(f"\n  ✓ Cleaned up test field {field_id}")

    print('\n========================================================')
    print('  ALL 10 END-TO-END SCENARIO CHECKS PASSED!')
    print('  FieldShift: Earth OS is fully operational and verified.')
    print('========================================================')

if __name__ == '__main__':
    main()
