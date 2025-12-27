"""add direction column to transaction (copy from type)

Revision ID: add_direction_0001
Revises: 
Create Date: 2025-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "add_direction_0001"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    conn = op.get_bind()
    # add nullable column direction
    op.add_column("transaction", sa.Column("direction", sa.String(), nullable=True))
    # copy values from type -> direction
    conn.execute(sa.text("UPDATE \"transaction\" SET direction = \"type\" WHERE direction IS NULL"))
    # (optional) make not nullable if desired:
    # op.alter_column("transaction", "direction", nullable=False)

def downgrade():
    # remove column on downgrade
    op.drop_column("transaction", "direction")
