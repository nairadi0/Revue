"""add installation_id and make triggered_by_user_id nullable

Revision ID: c7a2e58f4b19
Revises: b4f1c9d27a30
Create Date: 2026-09-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c7a2e58f4b19'
down_revision: Union[str, Sequence[str], None] = 'b4f1c9d27a30'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('repositories', sa.Column('installation_id', sa.Integer(), nullable=True))
    op.alter_column('agent_runs', 'triggered_by_user_id', existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    op.alter_column('agent_runs', 'triggered_by_user_id', existing_type=sa.Integer(), nullable=False)
    op.drop_column('repositories', 'installation_id')
