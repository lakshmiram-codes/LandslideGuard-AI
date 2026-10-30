"""Seed script for Phase 7 Community Reports and CAP Demonstration Data.

Non-destructive: skips if community reports already exist.
"""

from datetime import datetime, timezone, timedelta
from app.core.database import SessionLocal
from app.models.incident import IncidentReport, IncidentReviewLog
from app.models.cap_message import CapMessage, CapAuditLog
from app.models.user import User
from app.models.location import MonitoredLocation
from app.models.risk_assessment import RiskAssessment
from app.services.cap.builder import CapMessageBuilder


def seed_phase7_demo():
    db = SessionLocal()
    try:
        citizen = db.query(User).filter_by(email="citizen@landslideguard.local").first()
        observer = db.query(User).filter_by(email="observer@landslideguard.local").first()
        ddma = db.query(User).filter_by(email="ddma.officer@landslideguard.local").first()
        admin = db.query(User).filter_by(email="admin@landslideguard.local").first()

        # Check existing community reports
        existing_comm_count = (
            db.query(IncidentReport)
            .filter(IncidentReport.is_community_report == True)
            .count()
        )

        if existing_comm_count == 0:
            print(">>> Seeding Phase 7 Demonstration Community Reports...")
            # Report 1: Wayanad Tension Cracks
            rep1 = IncidentReport(
                category="tension_cracks",
                description="[DEMO] Active ground fissures (approx 5-10cm wide) noticed along upper hillside slope behind tea plantation workers quarters.",
                latitude=11.5300,
                longitude=76.1100,
                location_description="Upper slope near Meppadi-Chooralmala road, 300m above settlement",
                source_type="community_crowdsource",
                review_status="under_review",
                reported_at=datetime.now(timezone.utc) - timedelta(hours=4),
                reporter_name="P. Ramesh (Citizen Observer)",
                reporter_contact="pramesh.wayanad@demo.local",
                reporter_user_id=citizen.id if citizen else None,
                consent_given=True,
                is_community_report=True,
            )
            db.add(rep1)
            db.flush()

            # Add review log for rep1
            log1 = IncidentReviewLog(
                incident_id=rep1.id,
                reviewer_id=observer.id if observer else 2,
                reviewer_name=observer.display_name if observer else "Field Patrol Officer",
                reviewer_role=observer.role if observer else "observer",
                from_status="pending_review",
                to_status="under_review",
                action="field_dispatch",
                notes="Field patrol dispatched to measure fissure extension and notify local revenue inspector.",
            )
            db.add(log1)

            # Report 2: Joshimath Debris Flow
            rep2 = IncidentReport(
                category="debris_flow",
                description="[DEMO] Torrential mud and rock accumulation spilling over retaining wall near NH-58 km 44.",
                latitude=30.5580,
                longitude=79.5685,
                location_description="Near Alaknanda viewpoint culvert #14, Joshimath sector",
                source_type="community_crowdsource",
                review_status="pending_review",
                reported_at=datetime.now(timezone.utc) - timedelta(minutes=45),
                reporter_name="Local Transport Driver Association",
                reporter_contact="transport.chamoli@demo.local",
                reporter_user_id=citizen.id if citizen else None,
                consent_given=True,
                is_community_report=True,
            )
            db.add(rep2)
            db.commit()
            print("  + Seeded 2 demonstration community reports with audit logs.")
        else:
            print(">>> Community reports already present; skipping report seed.")

        # Check existing CAP messages
        existing_cap_count = db.query(CapMessage).count()
        if existing_cap_count == 0:
            print(">>> Seeding Phase 7 Demonstration CAP Message...")
            # Find a location
            loc = (
                db.query(MonitoredLocation)
                .filter(MonitoredLocation.name.contains("Joshimath"))
                .first()
            )
            if not loc:
                loc = db.query(MonitoredLocation).first()

            if loc:
                assessment = (
                    db.query(RiskAssessment)
                    .filter(RiskAssessment.location_id == loc.id)
                    .order_by(RiskAssessment.assessed_at.desc())
                    .first()
                )

                identifier = CapMessageBuilder.generate_identifier()
                now_utc = datetime.now(timezone.utc)

                cap = CapMessage(
                    identifier=identifier,
                    risk_assessment_id=assessment.id if assessment else None,
                    sender="landslideguard-warning-engine@ndma.gov.in (SIMULATED)",
                    sent_at=now_utc,
                    status="Actual",
                    msg_type="Alert",
                    scope="Public",
                    category="Geo",
                    event="Landslide Hazard Warning",
                    urgency="Expected",
                    severity="Severe",
                    certainty="Observed",
                    headline=f"CAP Landslide Early Warning for {loc.name}",
                    description="[DEMO CAP ALERT] Significant rainfall saturation in hill slope strata. Ground movement risks heightened across arterial transport corridors.",
                    instruction="Avoid hillside road cuts and river valley bottoms. Monitor district disaster management directives.",
                    area_description=f"{loc.name}, {loc.district}, {loc.state}",
                    circle_lat=loc.latitude,
                    circle_lon=loc.longitude,
                    circle_radius_km=10.0,
                    dispatch_status="PENDING_APPROVAL",
                    validation_outcome="VALID",
                    is_simulation=True,
                    export_count=0,
                )
                db.add(cap)
                db.flush()

                audit = CapAuditLog(
                    cap_message_id=cap.id,
                    user_id=observer.id if observer else None,
                    user_name=observer.display_name if observer else "Field Patrol Officer",
                    user_role=observer.role if observer else "observer",
                    action="REQUEST_APPROVAL",
                    notes="Draft validated against OASIS schema and submitted for DDMA approval.",
                )
                db.add(audit)
                db.commit()
                print(f"  + Seeded demonstration CAP message ({identifier}) in PENDING_APPROVAL status.")
        else:
            print(">>> CAP messages already present; skipping CAP seed.")

    finally:
        db.close()


if __name__ == "__main__":
    seed_phase7_demo()
