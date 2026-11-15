"""Field identity, country and boundary provenance."""
from alembic import op
import sqlalchemy as sa
revision='0004'
down_revision='0003'
branch_labels=None
depends_on=None

def upgrade():
    op.create_table('field_profiles',sa.Column('field_id',sa.String(),sa.ForeignKey('fields.id',ondelete='CASCADE'),primary_key=True),sa.Column('payload',sa.JSON(),nullable=False),sa.Column('updated_at',sa.DateTime(timezone=True),nullable=False))
def downgrade():op.drop_table('field_profiles')
