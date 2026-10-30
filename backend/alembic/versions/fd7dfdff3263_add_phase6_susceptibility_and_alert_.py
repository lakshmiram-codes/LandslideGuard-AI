"""add_phase6_susceptibility_and_alert_safeguards

Revision ID: fd7dfdff3263
Revises: eb997b8d5b17
Create Date: 2026-10-29 16:02:38.297887

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fd7dfdff3263'
down_revision: Union[str, Sequence[str], None] = 'eb997b8d5b17'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('alerts', sa.Column('triggering_assessment_id', sa.Integer(), nullable=True))
    op.add_column('alerts', sa.Column('alert_fingerprint', sa.String(length=100), nullable=True))
    op.add_column('alerts', sa.Column('cooldown_until', sa.DateTime(timezone=True), nullable=True))
    op.add_column('alerts', sa.Column('uncertainty_notes', sa.Text(), nullable=True))
    op.add_column('alerts', sa.Column('is_experimental', sa.Boolean(), server_default=sa.text('true'), nullable=False))
    op.create_index(op.f('ix_alerts_alert_fingerprint'), 'alerts', ['alert_fingerprint'], unique=False)
    op.create_index(op.f('ix_alerts_triggering_assessment_id'), 'alerts', ['triggering_assessment_id'], unique=False)
    op.create_foreign_key('fk_alerts_triggering_assessment_id', 'alerts', 'risk_assessments', ['triggering_assessment_id'], ['id'], ondelete='SET NULL')
    op.add_column('risk_assessments', sa.Column('assessment_type', sa.String(length=30), server_default=sa.text("'dynamic_risk'"), nullable=False))
    op.add_column('risk_assessments', sa.Column('susceptibility_score', sa.Float(), nullable=True))
    op.add_column('risk_assessments', sa.Column('trigger_score', sa.Float(), nullable=True))
    op.add_column('risk_assessments', sa.Column('data_quality_status', sa.String(length=30), nullable=True))
    op.add_column('risk_assessments', sa.Column('contributing_factors_json', sa.Text(), nullable=True))
    op.add_column('risk_assessments', sa.Column('limitations_notes', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('risk_assessments', 'limitations_notes')
    op.drop_column('risk_assessments', 'contributing_factors_json')
    op.drop_column('risk_assessments', 'data_quality_status')
    op.drop_column('risk_assessments', 'trigger_score')
    op.drop_column('risk_assessments', 'susceptibility_score')
    op.drop_column('risk_assessments', 'assessment_type')
    op.drop_constraint('fk_alerts_triggering_assessment_id', 'alerts', type_='foreignkey')
    op.drop_index(op.f('ix_alerts_triggering_assessment_id'), table_name='alerts')
    op.drop_index(op.f('ix_alerts_alert_fingerprint'), table_name='alerts')
    op.drop_column('alerts', 'is_experimental')
    op.drop_column('alerts', 'uncertainty_notes')
    op.drop_column('alerts', 'cooldown_until')
    op.drop_column('alerts', 'alert_fingerprint')
    op.drop_column('alerts', 'triggering_assessment_id')
    # ### end Alembic commands ###
