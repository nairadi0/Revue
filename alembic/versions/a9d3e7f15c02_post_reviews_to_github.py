"""post reviews to github: run-scoped findings, review id, per-repo toggle

Revision ID: a9d3e7f15c02
Revises: c7a2e58f4b19
Create Date: 2026-09-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a9d3e7f15c02'
down_revision: Union[str, Sequence[str], None] = 'c7a2e58f4b19'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('review_findings', sa.Column('agent_run_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_review_findings_agent_run_id', 'review_findings', 'agent_runs', ['agent_run_id'], ['id'])
    op.add_column('agent_runs', sa.Column('github_review_id', sa.BigInteger(), nullable=True))
    op.add_column('repositories', sa.Column('post_reviews', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.drop_column('repositories', 'webhook_id')


def downgrade() -> None:
    op.add_column('repositories', sa.Column('webhook_id', sa.Integer(), nullable=True))
    op.drop_column('repositories', 'post_reviews')
    op.drop_column('agent_runs', 'github_review_id')
    op.drop_constraint('fk_review_findings_agent_run_id', 'review_findings', type_='foreignkey')
    op.drop_column('review_findings', 'agent_run_id')
