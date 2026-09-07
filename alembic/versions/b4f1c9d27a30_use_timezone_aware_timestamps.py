"""use timezone aware timestamps

Revision ID: b4f1c9d27a30
Revises: e31dfe69022c
Create Date: 2026-09-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b4f1c9d27a30'
down_revision: Union[str, Sequence[str], None] = 'e31dfe69022c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


COLUMNS = [
    ("users", "created_at"),
    ("users", "token_expires_at"),
    ("user_repositories", "connected_at"),
    ("pull_requests", "opened_at"),
    ("review_findings", "created_at"),
    ("repo_memory", "last_updated"),
    ("agent_runs", "started_at"),
    ("agent_runs", "completed_at"),
]


def upgrade() -> None:
    for table, column in COLUMNS:
        op.alter_column(
            table,
            column,
            type_=sa.DateTime(timezone=True),
            existing_type=sa.DateTime(),
            postgresql_using=f"{column} AT TIME ZONE 'UTC'",
        )


def downgrade() -> None:
    for table, column in COLUMNS:
        op.alter_column(
            table,
            column,
            type_=sa.DateTime(),
            existing_type=sa.DateTime(timezone=True),
            postgresql_using=f"{column} AT TIME ZONE 'UTC'",
        )
