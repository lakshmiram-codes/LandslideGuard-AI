"""add_phase7_crowdsourcing_and_cap_tables

Revision ID: c71a39f04e12
Revises: fd7dfdff3263
Create Date: 2026-10-29 19:35:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c71a39f04e12'
down_revision: Union[str, Sequence[str], None] = 'fd7dfdff3263'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Extend incident_reports table
    op.add_column('incident_reports', sa.Column('location_description', sa.String(length=255), nullable=True))
    op.add_column('incident_reports', sa.Column('reporter_name', sa.String(length=100), nullable=True))
    op.add_column('incident_reports', sa.Column('reporter_contact', sa.String(length=100), nullable=True))
    op.add_column('incident_reports', sa.Column('reporter_user_id', sa.Integer(), nullable=True))
    op.add_column('incident_reports', sa.Column('consent_given', sa.Boolean(), server_default=sa.text('true'), nullable=False))
    op.add_column('incident_reports', sa.Column('is_community_report', sa.Boolean(), server_default=sa.text('true'), nullable=False))
    op.add_column('incident_reports', sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('incident_reports', sa.Column('verified_by_id', sa.Integer(), nullable=True))
    op.add_column('incident_reports', sa.Column('review_notes', sa.Text(), nullable=True))

    op.create_index(op.f('ix_incident_reports_is_community_report'), 'incident_reports', ['is_community_report'], unique=False)
    op.create_index(op.f('ix_incident_reports_reporter_user_id'), 'incident_reports', ['reporter_user_id'], unique=False)
    op.create_index(op.f('ix_incident_reports_verified_by_id'), 'incident_reports', ['verified_by_id'], unique=False)

    op.create_foreign_key(
        'fk_incident_reports_reporter_user_id',
        'incident_reports',
        'users',
        ['reporter_user_id'],
        ['id'],
        ondelete='SET NULL',
    )
    op.create_foreign_key(
        'fk_incident_reports_verified_by_id',
        'incident_reports',
        'users',
        ['verified_by_id'],
        ['id'],
        ondelete='SET NULL',
    )

    # 2. Create incident_attachments table
    op.create_table(
        'incident_attachments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('incident_id', sa.Integer(), nullable=False),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('original_filename', sa.String(length=255), nullable=False),
        sa.Column('file_path', sa.String(length=500), nullable=False),
        sa.Column('mime_type', sa.String(length=100), nullable=False),
        sa.Column('file_size_bytes', sa.Integer(), nullable=False),
        sa.Column('sha256_hash', sa.String(length=64), nullable=False),
        sa.Column('caption', sa.String(length=255), nullable=True),
        sa.Column('uploaded_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('uploaded_by_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['incident_id'], ['incident_reports.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['uploaded_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_incident_attachments_id'), 'incident_attachments', ['id'], unique=False)
    op.create_index(op.f('ix_incident_attachments_incident_id'), 'incident_attachments', ['incident_id'], unique=False)

    # 3. Create incident_review_logs table
    op.create_table(
        'incident_review_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('incident_id', sa.Integer(), nullable=False),
        sa.Column('reviewer_id', sa.Integer(), nullable=True),
        sa.Column('reviewer_name', sa.String(length=100), nullable=False),
        sa.Column('reviewer_role', sa.String(length=50), nullable=False),
        sa.Column('from_status', sa.String(length=30), nullable=False),
        sa.Column('to_status', sa.String(length=30), nullable=False),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('notes', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['incident_id'], ['incident_reports.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['reviewer_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_incident_review_logs_id'), 'incident_review_logs', ['id'], unique=False)
    op.create_index(op.f('ix_incident_review_logs_incident_id'), 'incident_review_logs', ['incident_id'], unique=False)

    # 4. Create cap_messages table
    op.create_table(
        'cap_messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('identifier', sa.String(length=100), nullable=False),
        sa.Column('alert_id', sa.Integer(), nullable=True),
        sa.Column('risk_assessment_id', sa.Integer(), nullable=True),
        sa.Column('incident_id', sa.Integer(), nullable=True),
        sa.Column('sender', sa.String(length=100), nullable=False),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('msg_type', sa.String(length=20), nullable=False),
        sa.Column('scope', sa.String(length=20), nullable=False),
        sa.Column('note', sa.String(length=255), nullable=True),
        sa.Column('category', sa.String(length=30), nullable=False),
        sa.Column('event', sa.String(length=100), nullable=False),
        sa.Column('urgency', sa.String(length=30), nullable=False),
        sa.Column('severity', sa.String(length=30), nullable=False),
        sa.Column('certainty', sa.String(length=30), nullable=False),
        sa.Column('headline', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('instruction', sa.Text(), nullable=True),
        sa.Column('contact', sa.String(length=100), nullable=True),
        sa.Column('area_description', sa.String(length=255), nullable=False),
        sa.Column('circle_lat', sa.Float(), nullable=True),
        sa.Column('circle_lon', sa.Float(), nullable=True),
        sa.Column('circle_radius_km', sa.Float(), nullable=True),
        sa.Column('effective_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('dispatch_status', sa.String(length=30), nullable=False),
        sa.Column('xml_payload', sa.Text(), nullable=True),
        sa.Column('validation_outcome', sa.Text(), nullable=True),
        sa.Column('created_by_id', sa.Integer(), nullable=True),
        sa.Column('approved_by_id', sa.Integer(), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('exported_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('export_count', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('is_simulation', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('cancellation_reason', sa.Text(), nullable=True),
        sa.Column('supersedes_identifier', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['alert_id'], ['alerts.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['approved_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['incident_id'], ['incident_reports.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['risk_assessment_id'], ['risk_assessments.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_cap_messages_alert_id'), 'cap_messages', ['alert_id'], unique=False)
    op.create_index(op.f('ix_cap_messages_dispatch_status'), 'cap_messages', ['dispatch_status'], unique=False)
    op.create_index(op.f('ix_cap_messages_id'), 'cap_messages', ['id'], unique=False)
    op.create_index(op.f('ix_cap_messages_identifier'), 'cap_messages', ['identifier'], unique=True)
    op.create_index(op.f('ix_cap_messages_incident_id'), 'cap_messages', ['incident_id'], unique=False)
    op.create_index(op.f('ix_cap_messages_risk_assessment_id'), 'cap_messages', ['risk_assessment_id'], unique=False)

    # 5. Create cap_audit_logs table
    op.create_table(
        'cap_audit_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('cap_message_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('user_name', sa.String(length=100), nullable=False),
        sa.Column('user_role', sa.String(length=50), nullable=False),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('notes', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['cap_message_id'], ['cap_messages.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_cap_audit_logs_cap_message_id'), 'cap_audit_logs', ['cap_message_id'], unique=False)
    op.create_index(op.f('ix_cap_audit_logs_id'), 'cap_audit_logs', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_cap_audit_logs_id'), table_name='cap_audit_logs')
    op.drop_index(op.f('ix_cap_audit_logs_cap_message_id'), table_name='cap_audit_logs')
    op.drop_table('cap_audit_logs')

    op.drop_index(op.f('ix_cap_messages_risk_assessment_id'), table_name='cap_messages')
    op.drop_index(op.f('ix_cap_messages_incident_id'), table_name='cap_messages')
    op.drop_index(op.f('ix_cap_messages_identifier'), table_name='cap_messages')
    op.drop_index(op.f('ix_cap_messages_id'), table_name='cap_messages')
    op.drop_index(op.f('ix_cap_messages_dispatch_status'), table_name='cap_messages')
    op.drop_index(op.f('ix_cap_messages_alert_id'), table_name='cap_messages')
    op.drop_table('cap_messages')

    op.drop_index(op.f('ix_incident_review_logs_incident_id'), table_name='incident_review_logs')
    op.drop_index(op.f('ix_incident_review_logs_id'), table_name='incident_review_logs')
    op.drop_table('incident_review_logs')

    op.drop_index(op.f('ix_incident_attachments_incident_id'), table_name='incident_attachments')
    op.drop_index(op.f('ix_incident_attachments_id'), table_name='incident_attachments')
    op.drop_table('incident_attachments')

    op.drop_constraint('fk_incident_reports_verified_by_id', 'incident_reports', type_='foreignkey')
    op.drop_constraint('fk_incident_reports_reporter_user_id', 'incident_reports', type_='foreignkey')
    op.drop_index(op.f('ix_incident_reports_verified_by_id'), table_name='incident_reports')
    op.drop_index(op.f('ix_incident_reports_reporter_user_id'), table_name='incident_reports')
    op.drop_index(op.f('ix_incident_reports_is_community_report'), table_name='incident_reports')

    op.drop_column('incident_reports', 'review_notes')
    op.drop_column('incident_reports', 'verified_by_id')
    op.drop_column('incident_reports', 'verified_at')
    op.drop_column('incident_reports', 'is_community_report')
    op.drop_column('incident_reports', 'consent_given')
    op.drop_column('incident_reports', 'reporter_user_id')
    op.drop_column('incident_reports', 'reporter_contact')
    op.drop_column('incident_reports', 'reporter_name')
    op.drop_column('incident_reports', 'location_description')
