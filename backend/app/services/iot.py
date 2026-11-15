import csv
import io
import math
import random
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, desc
from sqlalchemy.orm import Session
from app.models import Device, SensorMeasurement, Field

DEFAULT_DEVICES = [
    {
        'name': 'Метеостанція Poltava Vantage Pro',
        'device_type': 'weather_station',
        'serial_number': 'FS-WS-2026-001',
        'connectivity': 'starlink',
        'battery_pct': 96.0,
        'status': 'online',
        'is_demo': True,
    },
    {
        'name': 'Ґрунтовий зонд Multi-Depth (10-30-60 см)',
        'device_type': 'soil_moisture',
        'serial_number': 'FS-SM-2026-104',
        'connectivity': 'lorawan',
        'battery_pct': 88.0,
        'status': 'online',
        'is_demo': True,
    },
    {
        'name': 'Опадомір Tipping Bucket Pro',
        'device_type': 'rain_gauge',
        'serial_number': 'FS-RG-2026-042',
        'connectivity': 'cellular_4g',
        'battery_pct': 92.0,
        'status': 'online',
        'is_demo': True,
    },
]

def seed_demo_devices(db: Session, org_id: str, field_id: str | None = None):
    """Seed standard IoT demo devices for initial evaluation."""
    for dev_meta in DEFAULT_DEVICES:
        existing = db.scalar(select(Device).where(Device.serial_number == dev_meta['serial_number']))
        if not existing:
            device = Device(
                organization_id=org_id,
                field_id=field_id,
                name=dev_meta['name'],
                device_type=dev_meta['device_type'],
                serial_number=dev_meta['serial_number'],
                connectivity=dev_meta['connectivity'],
                battery_pct=dev_meta['battery_pct'],
                status=dev_meta['status'],
                last_seen_at=datetime.now(timezone.utc),
                is_demo=True,
            )
            db.add(device)
    db.commit()

def simulate_device_telemetry(db: Session, device: Device, days: int = 7) -> int:
    """Generates realistic diurnal telemetry for the device over the past N days.
    Explicitly tags all rows with is_demo: True.
    """
    now = datetime.now(timezone.utc)
    measurements = []

    # Choose metrics according to device type
    metrics = {
        'soil_moisture': [('moisture_pct', '%', 22.0, 32.0)],
        'soil_temperature': [('temp_c', '°C', 12.0, 24.0)],
        'weather_station': [
            ('temp_c', '°C', 14.0, 28.0),
            ('solar_w_m2', 'W/m²', 0.0, 850.0),
        ],
        'rain_gauge': [('rainfall_mm', 'mm', 0.0, 12.0)],
        'lora_gateway': [('temp_c', '°C', 18.0, 35.0)],
    }.get(device.device_type, [('moisture_pct', '%', 20.0, 30.0)])

    # Generate 4 readings per day (every 6 hours)
    for step in range(days * 4):
        timestamp = now - timedelta(hours=6 * (days * 4 - step))
        hour = timestamp.hour
        # Diurnal solar cycle
        diurnal_factor = max(0.0, math.sin((hour - 6) / 12.0 * math.pi)) if 6 <= hour <= 18 else 0.0

        for metric_name, unit, low, high in metrics:
            if metric_name == 'solar_w_m2':
                val = round(high * diurnal_factor + random.uniform(0, 40), 1)
            elif metric_name == 'temp_c':
                val = round(low + (high - low) * diurnal_factor + random.uniform(-1, 1), 1)
            elif metric_name == 'rainfall_mm':
                # Occasional shower on day 3 or 5
                val = round(random.uniform(1.5, 8.5), 1) if step in (8, 16) else 0.0
            else:
                # Soil moisture slowly changes
                base = 26.0 - (step / (days * 4)) * 3.5
                val = round(base + random.uniform(-0.4, 0.4), 1)

            measurement = SensorMeasurement(
                device_id=device.id,
                field_id=device.field_id,
                timestamp=timestamp,
                metric=metric_name,
                value=val,
                unit=unit,
                is_demo=True,
            )
            measurements.append(measurement)

    device.last_seen_at = now
    device.status = 'online'
    db.add_all(measurements)
    db.commit()
    return len(measurements)

def parse_telemetry_csv(csv_content: str, device: Device, db: Session) -> int:
    """Parses user-provided CSV telemetry records.
    Expected header format: timestamp,metric,value,unit (or metric,value,unit)
    """
    reader = csv.DictReader(io.StringIO(csv_content))
    created = 0
    now = datetime.now(timezone.utc)

    for row in reader:
        metric = row.get('metric', '').strip()
        val_str = row.get('value', '').strip()
        if not metric or not val_str:
            continue
        try:
            val = float(val_str)
        except ValueError:
            continue

        unit = row.get('unit', '').strip()
        ts_str = row.get('timestamp', '').strip()
        if ts_str:
            try:
                ts = datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
            except Exception:
                ts = now
        else:
            ts = now

        meas = SensorMeasurement(
            device_id=device.id,
            field_id=device.field_id,
            timestamp=ts,
            metric=metric,
            value=val,
            unit=unit,
            is_demo=False,
        )
        db.add(meas)
        created += 1

    if created:
        device.last_seen_at = now
        db.commit()

    return created
