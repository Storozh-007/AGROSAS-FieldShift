import pytest
from datetime import date
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings
from app.db import SessionLocal
from app.models import ORG_ID, FARM_ID, Organization, Farm, Field
from app.schemas import FieldInput
from app.main import assign

@pytest.fixture(scope='session')
def auth_headers():
    return {'Authorization': f'Bearer {settings.app_token}'}

@pytest.fixture(scope='session')
def client():
    with TestClient(app) as test_client:
        yield test_client

@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

@pytest.fixture
def sample_field(db):
    org = db.get(Organization, ORG_ID)
    if not org:
        org = Organization(id=ORG_ID, name='Test Org')
        db.add(org)
    farm = db.get(Farm, FARM_ID)
    if not farm:
        farm = Farm(id=FARM_ID, organization_id=ORG_ID, name='Test Farm')
        db.add(farm)
    db.commit()

    field_in = FieldInput(
        name='Тестове Поле #1',
        geometry={'type': 'Polygon', 'coordinates': [[[34.45, 49.62], [34.47, 49.62], [34.47, 49.61], [34.45, 49.61], [34.45, 49.62]]]},
        crop_history=['wheat', 'maize', 'sunflower'],
        soil_type='loam',
        soil_ph=6.8,
        irrigation=False,
    )
    field = Field(farm_id=FARM_ID, organization_id=ORG_ID, is_demo=True)
    assign(field, field_in)
    db.add(field)
    db.commit()
    db.refresh(field)
    return field
