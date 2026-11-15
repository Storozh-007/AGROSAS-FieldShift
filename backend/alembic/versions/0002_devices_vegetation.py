"""Add vegetation observations, devices, and sensor measurements tables."""
from alembic import op
import sqlalchemy as sa

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'vegetation_observations',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('field_id', sa.String(), sa.ForeignKey('fields.id', ondelete='CASCADE'), nullable=False),
        sa.Column('scene_date', sa.String(), nullable=False),
        sa.Column('satellite', sa.String(), nullable=False),
        sa.Column('product', sa.String(), nullable=False),
        sa.Column('ndvi_mean', sa.Float(), nullable=False),
        sa.Column('ndvi_min', sa.Float(), nullable=False),
        sa.Column('ndvi_max', sa.Float(), nullable=False),
        sa.Column('cloud_cover_pct', sa.Float(), nullable=False),
        sa.Column('is_demo', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('payload', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_vegetation_observations_field_id', 'vegetation_observations', ['field_id'])
    op.create_index('ix_vegetation_observations_scene_date', 'vegetation_observations', ['scene_date'])

    op.create_table(
        'devices',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('organization_id', sa.String(), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('field_id', sa.String(), sa.ForeignKey('fields.id', ondelete='SET NULL'), nullable=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('device_type', sa.String(), nullable=False),
        sa.Column('serial_number', sa.String(), nullable=False),
        sa.Column('connectivity', sa.String(), nullable=False, server_default='cellular_4g'),
        sa.Column('battery_pct', sa.Float(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='online'),
        sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_demo', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_devices_organization_id', 'devices', ['organization_id'])
    op.create_index('ix_devices_field_id', 'devices', ['field_id'])
    op.create_index('ix_devices_serial_number', 'devices', ['serial_number'], unique=True)

    op.create_table(
        'sensor_measurements',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('device_id', sa.String(), sa.ForeignKey('devices.id', ondelete='CASCADE'), nullable=False),
        sa.Column('field_id', sa.String(), sa.ForeignKey('fields.id', ondelete='SET NULL'), nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('metric', sa.String(), nullable=False),
        sa.Column('value', sa.Float(), nullable=False),
        sa.Column('unit', sa.String(), nullable=False),
        sa.Column('is_demo', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_sensor_measurements_device_id', 'sensor_measurements', ['device_id'])
    op.create_index('ix_sensor_measurements_field_id', 'sensor_measurements', ['field_id'])
    op.create_index('ix_sensor_measurements_timestamp', 'sensor_measurements', ['timestamp'])
    op.create_index('ix_sensor_measurements_metric', 'sensor_measurements', ['metric'])

def downgrade():
    op.drop_table('sensor_measurements')
    op.drop_table('devices')
    op.drop_table('vegetation_observations')
