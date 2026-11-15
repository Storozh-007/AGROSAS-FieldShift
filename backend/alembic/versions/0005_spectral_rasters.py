"""Field spectral observations with actual numeric pixels and provenance."""
from alembic import op
import sqlalchemy as sa
revision='0005'
down_revision='0004'
branch_labels=None
depends_on=None
def upgrade():
    op.create_table('spectral_rasters',sa.Column('id',sa.String(),primary_key=True),sa.Column('field_id',sa.String(),sa.ForeignKey('fields.id',ondelete='CASCADE'),nullable=False),sa.Column('scene_id',sa.String(),nullable=False),sa.Column('index_name',sa.String(),nullable=False),sa.Column('scene_date',sa.String(),nullable=False),sa.Column('payload',sa.JSON(),nullable=False),sa.Column('created_at',sa.DateTime(timezone=True),nullable=False),sa.UniqueConstraint('field_id','scene_id','index_name'))
    op.create_index('ix_spectral_rasters_field_id','spectral_rasters',['field_id'])
def downgrade():op.drop_table('spectral_rasters')
