"""create indexes on transaction table

Revision ID: create_indexes_0002
Revises: add_direction_0001
Create Date: 2026-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "create_indexes_0002"
down_revision = "add_direction_0001"
branch_labels = None
depends_on = None

def upgrade():
    op.create_index("ix_transaction_date", "transaction", ["date"], unique=False)
    op.create_index("ix_transaction_direction", "transaction", ["direction"], unique=False)
    op.create_index("ix_transaction_major", "transaction", ["major_category"], unique=False)

def downgrade():
    op.drop_index("ix_transaction_date", table_name="transaction")
    op.drop_index("ix_transaction_direction", table_name="transaction")
    op.drop_index("ix_transaction_major", table_name="transaction")
