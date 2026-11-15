from sqlalchemy import select
from app.db import SessionLocal
from app.models import Organization, Farm, Field, ORG_ID, FARM_ID
from app.schemas import FieldInput
from app.main import assign

def seed():
    with SessionLocal() as db:
        if not db.get(Organization, ORG_ID):
            db.add(Organization(id=ORG_ID, name='FieldShift demo'))
            db.flush()
        if not db.get(Farm, FARM_ID):
            db.add(Farm(id=FARM_ID, organization_id=ORG_ID, name='Полтавські лани'))
            db.flush()
        db.commit()
        print('Workspace ready. Add your field or import verified public examples in /network.')

if __name__ == '__main__':
    seed()
