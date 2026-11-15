from uuid import uuid4

from app.main import get_telemetry
from app.models import Organization, Device, SensorMeasurement


def test_telemetry_cannot_read_another_organizations_device(db):
    """All reads, including explicit device-id queries, stay inside the caller's org."""
    org_a, org_b = str(uuid4()), str(uuid4())
    db.add_all([Organization(id=org_a, name='A'), Organization(id=org_b, name='B')])
    db.flush()
    own = Device(organization_id=org_a, name='A probe', device_type='soil', serial_number=str(uuid4()))
    other = Device(organization_id=org_b, name='B probe', device_type='soil', serial_number=str(uuid4()))
    db.add_all([own, other])
    db.flush()
    db.add_all([SensorMeasurement(device_id=own.id, metric='moisture_pct', value=24, unit='%'),
                SensorMeasurement(device_id=other.id, metric='moisture_pct', value=30, unit='%')])
    db.flush()
    assert {m['device_id'] for m in get_telemetry(db=db, org=org_a)} == {own.id}
    assert get_telemetry(device_id=other.id, db=db, org=org_a) == []
    assert get_telemetry(device_id=own.id, db=db, org=org_a)[0]['value'] == 24
    db.rollback()
