import json
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.cap_message import CapMessage, CapAuditLog
from app.models.alert import Alert
from app.models.risk_assessment import RiskAssessment
from app.models.user import User
from app.services.cap.builder import CapMessageBuilder
from app.services.cap.validator import CapSchemaValidator, CapValidationResult


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class CapService:
    """Orchestrates CAP message preparation, XML validation, approval workflows, and simulated export."""

    @staticmethod
    def map_risk_level_to_cap(risk_category: str) -> Dict[str, str]:
        """Maps internal risk tiers to standard CAP urgency, severity, certainty enumerations."""
        rc = (risk_category or "").lower()
        if rc == "critical":
            return {
                "urgency": "Immediate",
                "severity": "Extreme",
                "certainty": "Observed",
            }
        elif rc == "high":
            return {
                "urgency": "Expected",
                "severity": "Severe",
                "certainty": "Likely",
            }
        elif rc == "moderate":
            return {
                "urgency": "Future",
                "severity": "Moderate",
                "certainty": "Possible",
            }
        else:
            return {
                "urgency": "Future",
                "severity": "Minor",
                "certainty": "Unlikely",
            }

    @classmethod
    def create_cap_draft(
        cls,
        db: Session,
        sender_user: User,
        headline: str,
        description: str,
        area_description: str,
        alert_id: Optional[int] = None,
        risk_assessment_id: Optional[int] = None,
        incident_id: Optional[int] = None,
        urgency: Optional[str] = None,
        severity: Optional[str] = None,
        certainty: Optional[str] = None,
        instruction: Optional[str] = None,
        circle_lat: Optional[float] = None,
        circle_lon: Optional[float] = None,
        circle_radius_km: Optional[float] = 10.0,
        scope: str = "Private",  # Private or Restricted in prototype
        is_simulation: bool = True,
    ) -> CapMessage:
        """
        Creates a new CAP alert message in DRAFT state.
        Validates that underlying assessment does not suffer from insufficient or stale telemetry.
        """
        parameters: Dict[str, Any] = {
            "PlatformEngine": "LandslideGuard AI",
            "Environment": "Development-Prototype",
        }

        # Validate underlying risk assessment data quality
        if risk_assessment_id:
            assessment = db.query(RiskAssessment).filter(RiskAssessment.id == risk_assessment_id).first()
            if not assessment:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Risk assessment ID {risk_assessment_id} not found.",
                )

            # Safety Gate: Missing or stale telemetry blocks CAP generation
            if assessment.data_quality_status in ("INSUFFICIENT_DATA", "MISSING"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Cannot draft CAP message: Associated risk assessment #{risk_assessment_id} "
                        "has INSUFFICIENT_DATA. Missing inputs cannot trigger emergency warning alerts."
                    ),
                )

            if assessment.data_quality_status in ("STALE", "DATA_STALE"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Cannot draft CAP message: Associated risk assessment #{risk_assessment_id} "
                        "relies on STALE telemetry (> 3 hours old). Live verified observation required."
                    ),
                )

            parameters["RiskCategory"] = assessment.risk_category
            if assessment.risk_score is not None:
                parameters["CombinedRiskScore"] = f"{assessment.risk_score * 100:.1f}%"
            if assessment.susceptibility_score is not None:
                parameters["TerrainSusceptibilityScore"] = f"{assessment.susceptibility_score * 100:.1f}%"
            if assessment.trigger_score is not None:
                parameters["DynamicTriggerScore"] = f"{assessment.trigger_score * 100:.1f}%"

            # Derive CAP enumerations if not explicitly overridden
            mapped = cls.map_risk_level_to_cap(assessment.risk_category)
            urgency = urgency or mapped["urgency"]
            severity = severity or mapped["severity"]
            certainty = certainty or mapped["certainty"]

        elif alert_id:
            alert = db.query(Alert).filter(Alert.id == alert_id).first()
            if not alert:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Alert ID {alert_id} not found.",
                )
            mapped = cls.map_risk_level_to_cap(alert.severity)
            urgency = urgency or mapped["urgency"]
            severity = severity or mapped["severity"]
            certainty = certainty or mapped["certainty"]
            parameters["SourceAlertSeverity"] = alert.severity

        # Fallback defaults
        urgency = urgency or "Expected"
        severity = severity or "Moderate"
        certainty = certainty or "Likely"

        identifier = CapMessageBuilder.generate_identifier()
        sender_email = sender_user.email
        sent_at = utc_now()
        effective_at = sent_at
        expires_at = sent_at + timedelta(hours=12)

        # Build initial XML payload
        xml_payload = CapMessageBuilder.build_cap_xml(
            identifier=identifier,
            sender=sender_email,
            sent_at=sent_at,
            status="Draft",
            msg_type="Alert",
            scope=scope,
            headline=headline,
            description=description,
            area_description=area_description,
            urgency=urgency,
            severity=severity,
            certainty=certainty,
            instruction=instruction,
            circle_lat=circle_lat,
            circle_lon=circle_lon,
            circle_radius_km=circle_radius_km,
            effective_at=effective_at,
            expires_at=expires_at,
            parameters=parameters,
            sender_name=sender_user.display_name,
        )

        validation = CapSchemaValidator.validate_xml(xml_payload)
        validation_json = json.dumps({
            "is_valid": validation.is_valid,
            "errors": validation.errors,
            "warnings": validation.warnings,
        })

        initial_status = "VALIDATED" if validation.is_valid else "DRAFT"

        cap_msg = CapMessage(
            identifier=identifier,
            alert_id=alert_id,
            risk_assessment_id=risk_assessment_id,
            incident_id=incident_id,
            sender=sender_email,
            sent_at=sent_at,
            status="Draft",
            msg_type="Alert",
            scope=scope,
            category="Geo",
            event="Landslide Susceptibility Warning",
            urgency=urgency,
            severity=severity,
            certainty=certainty,
            headline=headline.strip(),
            description=description.strip(),
            instruction=instruction.strip() if instruction else None,
            area_description=area_description.strip(),
            circle_lat=circle_lat,
            circle_lon=circle_lon,
            circle_radius_km=circle_radius_km,
            effective_at=effective_at,
            expires_at=expires_at,
            dispatch_status=initial_status,
            xml_payload=xml_payload,
            validation_outcome=validation_json,
            created_by_id=sender_user.id,
            is_simulation=is_simulation,
        )

        db.add(cap_msg)
        db.flush()

        # Audit log entry
        audit = CapAuditLog(
            cap_message_id=cap_msg.id,
            user_id=sender_user.id,
            user_name=sender_user.display_name,
            user_role=sender_user.role,
            action="CREATE",
            notes=f"CAP draft created with identifier {identifier}. Initial status: {initial_status}.",
        )
        db.add(audit)
        db.commit()
        db.refresh(cap_msg)
        return cap_msg

    @classmethod
    def request_approval(cls, db: Session, cap_msg: CapMessage, user: User) -> CapMessage:
        """Transitions VALIDATED draft to PENDING_APPROVAL state."""
        if cap_msg.dispatch_status not in ("DRAFT", "VALIDATED"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot request approval from current status '{cap_msg.dispatch_status}'.",
            )

        # Validate XML before submitting for approval
        validation = CapSchemaValidator.validate_xml(cap_msg.xml_payload or "")
        if not validation.is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot submit invalid CAP message for approval: {'; '.join(validation.errors)}",
            )

        cap_msg.dispatch_status = "PENDING_APPROVAL"
        audit = CapAuditLog(
            cap_message_id=cap_msg.id,
            user_id=user.id,
            user_name=user.display_name,
            user_role=user.role,
            action="REQUEST_APPROVAL",
            notes="Submitted CAP message for authorized DDMA / administrative review.",
        )
        db.add(audit)
        db.commit()
        db.refresh(cap_msg)
        return cap_msg

    @classmethod
    def approve_cap_message(
        cls, db: Session, cap_msg: CapMessage, approver: User, notes: Optional[str] = None
    ) -> CapMessage:
        """
        Approves a CAP message. Restricted to official_ddma and admin roles.
        Guards against approving stale inputs or self-approval conflicts.
        """
        if cap_msg.dispatch_status == "APPROVED":
            return cap_msg

        if cap_msg.dispatch_status not in ("PENDING_APPROVAL", "VALIDATED"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot approve message in '{cap_msg.dispatch_status}' status.",
            )

        # Ensure no self-approval if creator is known
        if (
            cap_msg.created_by_id is not None
            and cap_msg.created_by_id == approver.id
            and approver.role != "admin"
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Conflict of interest: You cannot approve a CAP message that you created. Another official must review.",
            )

        # Re-check risk assessment data freshness before approving
        if cap_msg.risk_assessment_id:
            assessment = db.query(RiskAssessment).filter(RiskAssessment.id == cap_msg.risk_assessment_id).first()
            if assessment and assessment.data_quality_status in ("INSUFFICIENT_DATA", "MISSING", "STALE", "DATA_STALE"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Approval blocked: Underlying risk assessment is {assessment.data_quality_status}.",
                )

        cap_msg.dispatch_status = "APPROVED"
        cap_msg.approved_by_id = approver.id
        cap_msg.approved_at = utc_now()

        approval_notes = notes or f"Approved by {approver.display_name} ({approver.role}). Ready for simulated export."
        audit = CapAuditLog(
            cap_message_id=cap_msg.id,
            user_id=approver.id,
            user_name=approver.display_name,
            user_role=approver.role,
            action="APPROVE",
            notes=approval_notes,
        )
        db.add(audit)
        db.commit()
        db.refresh(cap_msg)
        return cap_msg

    @classmethod
    def export_cap_message(cls, db: Session, cap_msg: CapMessage, exporter: User) -> Dict[str, Any]:
        """
        Exports an APPROVED CAP message into a downloadable/deliverable payload.
        Increments export_count and enforces strict safety simulation barriers.
        """
        if cap_msg.dispatch_status not in ("APPROVED", "EXPORTED"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot export CAP message with status '{cap_msg.dispatch_status}'. Message must be APPROVED first.",
            )

        cap_msg.dispatch_status = "EXPORTED"
        cap_msg.exported_at = utc_now()
        cap_msg.export_count += 1

        audit = CapAuditLog(
            cap_message_id=cap_msg.id,
            user_id=exporter.id,
            user_name=exporter.display_name,
            user_role=exporter.role,
            action="EXPORT",
            notes=f"Export #{cap_msg.export_count} triggered by {exporter.display_name}. Simulation mode active.",
        )
        db.add(audit)
        db.commit()
        db.refresh(cap_msg)

        return {
            "identifier": cap_msg.identifier,
            "dispatch_status": cap_msg.dispatch_status,
            "export_count": cap_msg.export_count,
            "exported_at": cap_msg.exported_at,
            "is_simulation": cap_msg.is_simulation,
            "xml_payload": cap_msg.xml_payload,
            "dispatch_receipt": (
                f"[SIMULATION ONLY] CAP XML payload generated for {cap_msg.identifier}. "
                "No live emergency alert broadcast to external government/civil channels."
            ),
        }

    @classmethod
    def cancel_cap_message(
        cls, db: Session, cap_msg: CapMessage, user: User, reason: str
    ) -> CapMessage:
        """Cancels an active CAP message, generating a cancellation payload."""
        if not reason or not reason.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A valid reason is required to cancel a CAP message.",
            )

        if cap_msg.dispatch_status == "CANCELLED":
            return cap_msg

        cancel_identifier = f"{cap_msg.identifier}-CNL"
        sent_at = utc_now()

        cancel_xml = CapMessageBuilder.build_cap_xml(
            identifier=cancel_identifier,
            sender=user.email,
            sent_at=sent_at,
            status=cap_msg.status,
            msg_type="Cancel",
            scope=cap_msg.scope,
            headline=f"CANCELLED: {cap_msg.headline}",
            description=f"This alert has been cancelled. Reason: {reason.strip()}",
            area_description=cap_msg.area_description,
            urgency="Past",
            severity="Minor",
            certainty="Unlikely",
            note=f"Cancellation of earlier alert {cap_msg.identifier}.",
            references=f"{cap_msg.sender},{cap_msg.identifier},{CapMessageBuilder.format_cap_timestamp(cap_msg.sent_at)}",
        )

        cap_msg.dispatch_status = "CANCELLED"
        cap_msg.cancellation_reason = reason.strip()
        cap_msg.xml_payload = cancel_xml

        audit = CapAuditLog(
            cap_message_id=cap_msg.id,
            user_id=user.id,
            user_name=user.display_name,
            user_role=user.role,
            action="CANCEL",
            notes=f"Alert cancelled: {reason.strip()}",
        )
        db.add(audit)
        db.commit()
        db.refresh(cap_msg)
        return cap_msg


cap_service = CapService()
