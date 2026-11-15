"""Initial PostGIS schema for the first vertical slice."""
from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geometry
revision = '0001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.execute('CREATE EXTENSION IF NOT EXISTS postgis')
    op.create_table('organizations', sa.Column('id', sa.String(), primary_key=True), sa.Column('name', sa.String(), nullable=False))
    op.create_table('farms', sa.Column('id', sa.String(), primary_key=True), sa.Column('organization_id', sa.String(), sa.ForeignKey('organizations.id'), nullable=False), sa.Column('name', sa.String(), nullable=False))
    op.create_index('ix_farms_organization_id', 'farms', ['organization_id'])
    op.create_table('fields', sa.Column('id', sa.String(), primary_key=True), sa.Column('farm_id', sa.String(), sa.ForeignKey('farms.id'), nullable=False), sa.Column('organization_id', sa.String(), sa.ForeignKey('organizations.id'), nullable=False), sa.Column('name', sa.String(), nullable=False), sa.Column('boundary', Geometry('POLYGON', srid=4326), nullable=False), sa.Column('area_ha', sa.Float(), nullable=False), sa.Column('crop_history', sa.JSON(), nullable=False), sa.Column('soil_type', sa.String(), nullable=False), sa.Column('soil_ph', sa.Float()), sa.Column('irrigation', sa.Boolean(), nullable=False), sa.Column('priorities', sa.JSON(), nullable=False), sa.Column('is_demo', sa.Boolean(), nullable=False), sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False))
    op.create_index('ix_fields_organization_id', 'fields', ['organization_id'])
    op.create_index('ix_fields_farm_id', 'fields', ['farm_id'])
    op.create_table('climate_observations', sa.Column('id', sa.String(), primary_key=True), sa.Column('field_id', sa.String(), sa.ForeignKey('fields.id', ondelete='CASCADE'), nullable=False), sa.Column('start', sa.String(), nullable=False), sa.Column('end', sa.String(), nullable=False), sa.Column('payload', sa.JSON(), nullable=False), sa.Column('downloaded_at', sa.DateTime(timezone=True), nullable=False), sa.UniqueConstraint('field_id', 'start', 'end'))
    op.create_index('ix_climate_observations_field_id', 'climate_observations', ['field_id'])
    op.create_table('audit_logs', sa.Column('id', sa.String(), primary_key=True), sa.Column('organization_id', sa.String(), nullable=False), sa.Column('action', sa.String(), nullable=False), sa.Column('entity_id', sa.String(), nullable=False), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False))
    op.create_index('ix_audit_logs_organization_id', 'audit_logs', ['organization_id'])

def downgrade():
    for table in ['audit_logs', 'climate_observations', 'fields', 'farms', 'organizations']:
        op.drop_table(table)
