"""Persist per-field scene editor and decision journal."""
from alembic import op
import sqlalchemy as sa
revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('farm_designs', sa.Column('field_id', sa.String(), sa.ForeignKey('fields.id', ondelete='CASCADE'), primary_key=True), sa.Column('revision', sa.Integer(), nullable=False), sa.Column('payload', sa.JSON(), nullable=False), sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False))
    op.create_table('farm_actions', sa.Column('id', sa.String(), primary_key=True), sa.Column('field_id', sa.String(), sa.ForeignKey('fields.id', ondelete='CASCADE'), nullable=False), sa.Column('payload', sa.JSON(), nullable=False), sa.Column('status', sa.String(), nullable=False), sa.Column('outcome', sa.JSON(), nullable=False), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False))
    op.create_index('ix_farm_actions_field_id', 'farm_actions', ['field_id'])

def downgrade():
    op.drop_table('farm_actions')
    op.drop_table('farm_designs')
