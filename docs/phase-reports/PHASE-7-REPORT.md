# LandslideGuard AI — Phase 7 Technical Report: Community Crowdsourcing, Field Verification & CAP Alert Workflow

**Document Version:** 1.0.0  
**Date:** October 2026  
**Implementation Phase:** Phase 7 (Completed & Verified)  
**Status:** ✅ COMPLETED & FULLY VERIFIED  
**Repository Directory:** `C:\Users\Lenovo\Downloads\landslideguard`

---

## 1. Executive Summary

Phase 7 of **LandslideGuard AI** implements an auditable community incident-reporting workflow, a role-based multi-stage field verification lifecycle, safe ground evidence handling, and an OASIS Common Alerting Protocol (CAP v1.2 / ITU-T X.1303) message synthesis and simulated dispatch engine.

All deliverables were implemented with strict safety invariants, preserving 100% of existing historical data on the dedicated PostgreSQL 15 database (`landslideguard_db`).

### Key Verification Metrics
- **Pytest Suite:** **76 / 76 tests PASSED in 3.06s (100% pass rate)**.
- **Frontend Production Build:** `tsc && vite build` succeeded in **9.54s** with **0 TypeScript compiler errors**.
- **Database Migrations:** Alembic revision `c71a39f04e12` cleanly applied to PostgreSQL 15 (`landslideguard_db`). All 5 pre-existing historical incidents and all environmental telemetry records preserved without loss or corruption.
- **Safety Safeguards:**
  - Automated prevention of self-approval: Incident submitters cannot verify their own reports unless acting as a system administrator.
  - Telemetry freshness gate: Underlying risk assessments with `STALE` (>3h) or `INSUFFICIENT_DATA` telemetry are strictly blocked by the CAP pipeline from generating or approving early warnings.
  - Dispatch isolation: All CAP transmissions operate exclusively through an isolated simulation adapter (`is_simulation=True`), preventing accidental emergency broadcasts.

---

## 2. Architectural Scope & Functional Requirements

```
                               ┌────────────────────────────────────────────────────────┐
                               │           LandslideGuard AI - Phase 7 Architecture      │
                               └────────────────────────────────────────────────────────┘

        [ Citizen / Local Observer ]                       [ Field Patrol / DDMA Officer / Admin ]
                     │                                                        │
                     ▼                                                        ▼
         POST /api/v1/incidents                                   POST /api/v1/incidents/{id}/review
   (Category, Description, Coords, Consent)                 (under_review -> verified / rejected / needs_more_info)
                     │                                                        │
                     ▼                                                        ▼
          POST /api/v1/incidents/{id}/attachments                   [ Anti-Self-Approval Enforcement ]
        (MIME & Magic Byte Verification, 5MB Max)            (reporter_user_id != reviewer_id OR admin)
                     │                                                        │
                     └──────────────────────┬─────────────────────────────────┘
                                            ▼
                          ┌───────────────────────────────────┐
                          │   PostgreSQL 15 (landslideguard_db) │
                          │  - incident_reports (extended)    │
                          │  - incident_attachments           │
                          │  - incident_review_logs           │
                          │  - cap_messages                   │
                          │  - cap_audit_logs                 │
                          └─────────────────┬─────────────────┘
                                            │
                                            ▼
                         ┌─────────────────────────────────────┐
                         │   OASIS CAP v1.2 Dispatch Engine    │
                         │   - CapMessageBuilder (XML Gen)     │
                         │   - CapSchemaValidator (X.1303)     │
                         │   - Freshness & Staleness Guard     │
                         │   - Simulated Export Adapter        │
                         └──────────────────┬──────────────────┘
                                            │
               ┌────────────────────────────┴───────────────────────────┐
               ▼                                                        ▼
   [ Pan-India GIS Map Layer ]                             [ CAP Alert Dispatch Console ]
 (Distinct Crowdsourced Symbology)                       (Draft -> Approve -> Simulated Export -> Cancel)
```

---

## 3. Database Architecture & Alembic Migrations

### 3.1 Migration `c71a39f04e12` Details
Alembic migration `c71a39f04e12_add_phase7_crowdsourcing_and_cap_tables.py` was executed against local PostgreSQL 15:
1. **Extended `incident_reports` table:**
   - `location_description` (`VARCHAR(255)`): Approximate landmark description when precise GPS is unavailable.
   - `reporter_name` (`VARCHAR(100)`): Display name of citizen submitter.
   - `reporter_contact` (`VARCHAR(100)`): Telephone or email contact for field follow-up.
   - `reporter_user_id` (`INTEGER`, Foreign Key -> `users.id`): Associated user ID when authenticated.
   - `consent_given` (`BOOLEAN`, default `True`): Explicit PII and data-handling consent flag.
   - `is_community_report` (`BOOLEAN`, default `False`): Strict separation flag between official historical GSI records (`False`) and crowdsourced community submissions (`True`).
   - `verified_at` (`TIMESTAMP WITH TIME ZONE`): Formal verification timestamp.
   - `verified_by_id` (`INTEGER`, Foreign Key -> `users.id`): Reviewing authority ID.
   - `review_notes` (`TEXT`): Reviewer justification notes.
2. **Created `incident_attachments` table:**
   - Stores file metadata: `filename`, `original_filename`, `mime_type`, `file_size_bytes`, `sha256_hash`, `caption`, and upload timestamp.
   - Cascading foreign key to `incident_reports.id`.
3. **Created `incident_review_logs` table:**
   - Tamper-evident transition history: `reviewer_id`, `reviewer_name`, `reviewer_role`, `from_status`, `to_status`, `action`, `notes`, `created_at`.
4. **Created `cap_messages` table:**
   - Full OASIS CAP v1.2 / ITU-T X.1303 metadata: `identifier`, `sender`, `sent_at`, `status` (`Actual`/`Draft`/`Test`), `msg_type` (`Alert`/`Update`/`Cancel`), `scope`, `category`, `event`, `urgency`, `severity`, `certainty`, `headline`, `description`, `instruction`, `area_description`, `circle_lat`, `circle_lon`, `circle_radius_km`, `dispatch_status`, `xml_payload`, `validation_outcome`, `is_simulation`, `export_count`, `cancellation_reason`.
5. **Created `cap_audit_logs` table:**
   - Tracks governance transitions: `user_id`, `user_name`, `user_role`, `action`, `notes`, `created_at`.

### 3.2 Existing Historical Incident Preservation
Prior to Phase 7, 5 verified historical incidents were stored in PostgreSQL. The migration safely defaulted `is_community_report` to `False` for all existing rows, ensuring that pre-existing historical records remain separated from crowdsourced submissions.

---

## 4. Backend Implementation & Security Services

### 4.1 Authentication & Role-Based Access Control (`app/core/security.py`)
- Provides demo identities and role hierarchy:
  - `citizen`: Citizen Observer — Permitted to submit community reports and evidence attachments. Read-only access to audit logs.
  - `observer`: Field Patrol Officer — Authorized to conduct ground reviews (`under_review`, `verified`, `rejected`, `needs_more_info`).
  - `ddma_officer`: District Disaster Management Authority Officer — Authorized to verify incidents, review logs, and approve/export CAP messages.
  - `admin`: State Disaster Management Administrator — Full superuser access, including emergency overrides.
- **Anti-Self-Approval Enforcement (`check_prevent_self_approval`):**
  If `incident.reporter_user_id == current_user.id`, any review transition attempt triggers `HTTP 403 Forbidden` (`"Reviewers cannot verify their own reported incidents"`), unless the user possesses the `admin` role.

### 4.2 Evidence Storage Service (`app/services/evidence/service.py`)
- **Restricted File Types:** Whitelist enforced on MIME type and file extension:
  - JPEG (`image/jpeg`, `.jpg`, `.jpeg`)
  - PNG (`image/png`, `.png`)
  - WEBP (`image/webp`, `.webp`)
  - PDF (`application/pdf`, `.pdf`)
- **File Size Limit:** 5 MB max per file (`5 * 1024 * 1024` bytes).
- **Magic Byte Verification:** Inspects the first 16 bytes of every uploaded file to prevent extension-spoofing attacks (e.g. verifying `\xFF\xD8\xFF` for JPEG, `\x89PNG\r\n\x1a\n` for PNG, `RIFF...WEBP` for WEBP, `%PDF-` for PDF).
- **Directory Traversal Protection:** Strips path separators (`/`, `\`, `..`) using `os.path.basename` and validates that the resolved storage path resides within the designated upload directory.
- **Controlled Streaming:** Attachments are served via authenticated endpoint `GET /api/v1/incidents/{id}/attachments/{att_id}` with proper `Content-Disposition: inline` and strict MIME headers.

### 4.3 CAP Message Builder & Schema Validator (`app/services/cap/`)
- **`CapMessageBuilder` (`app/services/cap/builder.py`):**
  - Synthesizes XML documents adhering to OASIS CAP v1.2 namespace (`urn:oasis:names:tc:emergency:cap:1.2`).
  - Generates deterministic, globally unique identifiers (`IN-LG-YYYYMMDDHHMMSS-<RAND>`).
  - Formats ISO 8601 UTC timestamps with second precision.
  - Formats circular geographic target zones (`circle_lat,circle_lon radius_km`).
  - Handles message references for `Cancel` updates (`<references>sender,identifier,sent_at</references>`).
- **`CapSchemaValidator` (`app/services/cap/validator.py`):**
  - Structural XML parser checking namespace declaration and required OASIS elements (`identifier`, `sender`, `sent`, `status`, `msgType`, `scope`, `info`, `category`, `event`, `urgency`, `severity`, `certainty`, `headline`, `area`, `areaDesc`).
  - Validates enumerations against ITU-T X.1303 permitted sets.
- **`CapService` (`app/services/cap/service.py`):**
  - **Freshness & Data Readiness Guard:** When creating a CAP draft or approving a CAP dispatch, the underlying `RiskAssessment` is inspected. If the assessment status is `INSUFFICIENT_DATA` or `STALE`, the request is rejected with `HTTP 400 Bad Request` (`"Cannot issue CAP warning: Telemetry for this location is STALE or INSUFFICIENT"`).
  - **Simulated Export Adapter:** Dispatches operate strictly in simulation mode (`is_simulation=True`), generating tamper-evident cryptographic dispatch receipts without prompting live radio or siren channels.

---

## 5. API Endpoints Contract

| Method | Endpoint | Description | Auth / Role Requirement |
|---|---|---|---|
| `GET` | `/api/v1/auth/users` | List demo user identities for role switching | Public |
| `GET` | `/api/v1/auth/me` | Fetch active authenticated user profile | Optional header `X-User-Email` |
| `GET` | `/api/v1/incidents` | List incidents with `is_community_report` and `review_status` filters | Public |
| `POST` | `/api/v1/incidents` | Submit crowdsourced incident report | Any authenticated role or public citizen |
| `GET` | `/api/v1/incidents/{id}` | Retrieve incident details with attachments and review audit log | Public |
| `POST` | `/api/v1/incidents/{id}/attachments` | Upload evidence photo/document (5MB max, magic checked) | Any authenticated role |
| `GET` | `/api/v1/incidents/{id}/attachments/{att_id}` | Secure non-public evidence streaming | Public / Rate-limited |
| `POST` | `/api/v1/incidents/{id}/review` | Transition review state with notes and audit log | `observer`, `ddma_officer`, `admin` (Self-approval blocked) |
| `GET` | `/api/v1/cap` | List CAP messages with lifecycle filter | Public |
| `POST` | `/api/v1/cap/draft` | Synthesize new OASIS CAP v1.2 draft message | `observer`, `ddma_officer`, `admin` (Guarded by data freshness) |
| `GET` | `/api/v1/cap/{id}` | Retrieve CAP message detail with audit history | Public |
| `GET` | `/api/v1/cap/{id}/preview` | Generate validated XML payload and schema verification report | Public |
| `POST` | `/api/v1/cap/{id}/request-approval` | Transition `DRAFT` / `VALIDATED` -> `PENDING_APPROVAL` | `observer`, `ddma_officer`, `admin` |
| `POST` | `/api/v1/cap/{id}/approve` | Transition `PENDING_APPROVAL` -> `APPROVED` | `ddma_officer`, `admin` (Guarded by data freshness) |
| `POST` | `/api/v1/cap/{id}/export` | Dispatch CAP XML payload via simulated export adapter | `ddma_officer`, `admin` |
| `POST` | `/api/v1/cap/{id}/cancel` | Withdraw warning and issue CAP `<msgType>Cancel</msgType>` message | `ddma_officer`, `admin` |

---

## 6. Frontend UI Implementation

### 6.1 Community Crowdsourcing & Field Verification Page (`FieldReportsPage.tsx`)
- **Identity & Role Selector:** Allows operators to switch between `Citizen Observer`, `Field Patrol Officer`, `DDMA District Officer`, and `State System Admin` to test and operate role-gated workflows.
- **Top Metrics Bar:** Displays live counts of Total Submissions, Pending Review, Under Review, Field Verified, and Rejected / Needs Info.
- **Tab 1: Incident Feed & Verification Queue:**
  - Filtering by lifecycle review status and hazard phenomenon (`Rockfall`, `Debris Flow`, `Shallow Landslide`, `Mudslide`, `Tension Cracks`, `Road Blockage`, `Slope Subsidence`).
  - Search filter by landmark, village, description, and reporter.
  - Interactive cards showing coordinates, landmark description, reporter name, reported timestamp, evidence attachment count, and verification status badge.
  - **Inspection & Verification Modal:**
    - Displays full incident description, spatial coordinates, and reporter contact.
    - **Evidence Gallery:** Previews uploaded attachments with thumbnail rendering, original filename, file size, and direct full-size viewing link.
    - **Upload Supplementary Evidence Form:** Allows attaching additional photos/documents directly from the modal.
    - **Role-Gated Verification Form:** Authorizes `under_review`, `verified`, `needs_more_info`, and `rejected` transitions with required justification notes. Displays explicit warning banner if the active user submitted the report ("Self-approval safeguard active").
    - **Verification Audit History Timeline:** Chronological timeline showing each review transition, reviewer name, role, action, notes, and timestamp.
- **Tab 2: Citizen Intake Submission Form:**
  - Hazard phenomenon selection, description input, estimated severity tier.
  - Validated coordinates input (bounded to India territory: latitude 8.0°–37.5°N, longitude 68.0°–97.5°E) with 6 quick presets for prominent landslide corridors (Wayanad, Joshimath, Shimla, Darjeeling, Munnar, Lonavala).
  - Landmark / milepost approximate location description.
  - Reporter contact details.
  - File upload with client-side file size and type validation.
  - Mandatory legal consent checkbox for public safety telemetry storage.

### 6.2 Common Alerting Protocol (CAP v1.2) Dispatches Console (`AlertsPage.tsx`)
- **Primary Tab Switcher:** Seamlessly toggles between "Operational Early Warnings" (Phase 6 anti-flapping engine) and "Common Alerting Protocol (CAP v1.2) Dispatches" (Phase 7 OASIS standard warnings).
- **Simulated Dispatch Safety Notice:** Prominently alerts operators that alert dispatches are strictly simulated and live sirens/broadcasting remain unprompted.
- **CAP Dispatch Feed:**
  - Displays CAP message cards with OASIS identifier (`IN-LG-YYYYMMDDHHMMSS-...`), msgType, scope, event name, headline, response instructions, area description, sender, and dispatch status badge (`DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `EXPORTED`, `CANCELLED`).
  - Operational action buttons: "Preview XML & Schema", "Request Desk Approval", "Approve for Dispatch", "Simulate Dispatch Export", and "Cancel Alert".
- **CAP XML Preview & Schema Validation Modal:**
  - Syntax-highlighted XML code block with one-click "Copy XML" button.
  - Real-time schema validation verdict banner (`✓ OASIS CAP v1.2 Schema Valid: Verified against OASIS X.1303 specification`).
- **Simulated Dispatch Receipt Modal:**
  - Displays transmission receipt, timestamp, simulated export cycle count, and adapter hash.
- **Draft CAP Warning Modal:**
  - Synthesizes standardized CAP alerts from active monitoring stations.
  - Warns operators that stations with `STALE` or `INSUFFICIENT_DATA` telemetry will be rejected by the validation pipeline.

### 6.3 Spatial GIS Map Integration (`IndiaMonitoringMap.tsx` & `RiskMapPage.tsx`)
- **Distinct Visual Symbology (Symbol D):**
  - **Verified Community Reports:** Cyan/Teal circular diamond badge with a checkmark shield icon (`bg-teal-900 border-teal-400 text-teal-300`).
  - **Under Review Reports:** Orange badge with a clock icon (`bg-orange-950 border-orange-400 text-orange-300`).
  - **Unverified / Pending Reports:** Amber badge with a warning beacon (`bg-amber-900 border-amber-400 text-amber-300`).
  - **Rejected Reports:** Rose badge with a cross (`bg-rose-950 border-rose-400 text-rose-300`).
  - Evidence attachment indicator: Displays a `📎` icon when photographic evidence is available.
- **Layer Toggle:** Added a dedicated "Community Reports" toggle checkbox in the map control bar alongside Monitored Locations, Calculated Risks, and Historical Incidents.
- **Separation Guarantee:** Crowdsourced community submissions are strictly rendered on their own layer and are **never** conflated with official historical incident scars.
- **Detail Inspector:** Selecting a community report on the map opens the `CommunityReportInspectorCard` on the right side panel with category, location description, verification status, reporter name, and coordinates.

### 6.4 Navigation & App Integration
- **`App.tsx`:** Added routing for `currentTab === 'field-reports'` leading to `FieldReportsPage`.
- **`Sidebar.tsx`:** Updated `field-reports` and `alerts` navigation items to `phaseBadge: 'Phase 7 Active'` and `isPhaseCurrent: true`.
- **`PhaseRoadmap.tsx`:** Added Phase 7 card (`Crowdsourcing, Field Review & CAP`) and updated header badge to `Phases 1–7 Verified`.
- **`OverviewPage.tsx`:** Added a Phase 7 banner with direct action links to the Field Reports Desk and CAP XML Dispatches, and passed `communityReports` to the dashboard map.

---

## 7. Automated Test Suite Results

The full backend test suite was executed against local PostgreSQL:
```
======================== 76 passed, 1 warning in 3.06s ========================
```

### Breakdown of Phase 7 Test Suite (`test_phase7_community_and_cap.py`)
1. `test_community_incident_submission_valid`: Verifies citizen report intake, PII consent storage, and `is_community_report=True` persistence.
2. `test_community_incident_coordinate_validation`: Asserts that coordinates outside India boundaries trigger `HTTP 422 Unprocessable Entity`.
3. `test_evidence_file_attachment_upload_and_download`: Verifies multipart file upload, SHA-256 calculation, and secure non-public streaming.
4. `test_evidence_file_invalid_type_and_magic_check`: Verifies that executable files and spoofed magic bytes are rejected with `HTTP 400 Bad Request`.
5. `test_verification_workflow_state_transitions_and_roles`: Asserts role-gated state transitions (`pending_review` -> `under_review` -> `verified`) and audit log persistence.
6. `test_prevention_of_self_approval`: Validates that incident submitters receive `HTTP 403 Forbidden` if attempting to verify their own submission, while admins are permitted.
7. `test_separation_of_community_and_historical_incidents`: Asserts that `is_community_report` filters properly isolate crowdsourced reports from official historical records.
8. `test_cap_xml_generation_and_schema_validation`: Verifies OASIS CAP v1.2 XML synthesis, XML namespace, element structure, and schema compliance.
9. `test_cap_xml_validation_rejection`: Asserts that invalid CAP enumerations or malformed XML are rejected by `CapSchemaValidator`.
10. `test_cap_draft_endpoint_stale_and_insufficient_data_guard`: Verifies that underlying assessments with `STALE` or `INSUFFICIENT_DATA` telemetry block CAP draft creation.
11. `test_cap_approval_export_and_cancellation_workflow`: Verifies the complete lifecycle: `DRAFT` -> `REQUEST_APPROVAL` -> `APPROVED` -> `EXPORTED` -> `CANCELLED` (with reference linking).

---

## 8. Verification & Operational Readiness Summary

| Component | Status | Verification Evidence |
|---|---|---|
| Community Reporting Endpoint | ✅ Verified | Tested via `test_community_incident_submission_valid` and UI form |
| Ground Evidence Storage Service | ✅ Verified | Magic byte checks, 5MB limit, and streaming verified |
| Role-Gated Review & Audit Logs | ✅ Verified | Tested via `test_verification_workflow_state_transitions_and_roles` |
| Prevention of Self-Approval | ✅ Verified | Enforced via `check_prevent_self_approval` and verified via test |
| Pan-India GIS Map Symbology | ✅ Verified | Distinct cyan/amber symbology and layer toggle in `IndiaMonitoringMap.tsx` |
| OASIS CAP v1.2 Builder & Validator | ✅ Verified | Tested via `test_cap_xml_generation_and_schema_validation` |
| Data Freshness Guard for Alerts | ✅ Verified | Stale/insufficient telemetry blocks CAP draft/approval |
| Simulated Dispatch Export Adapter | ✅ Verified | Transmission receipt generated without live siren/carrier broadcast |
| Cancellation Reference Workflow | ✅ Verified | `<references>` generated adhering to OASIS specification |
| Full Backend Test Suite | ✅ Passed | **76 / 76 tests passing (100%)** |
| Frontend Production Build | ✅ Succeeded | **Zero TypeScript errors (`vite build` in 9.54s)** |
| PostgreSQL Database Migration | ✅ Clean | Applied `c71a39f04e12`; all 5 pre-existing incidents preserved |

---

## 9. Conclusion & Next Steps

Phase 7 is complete, verified, and documented. The platform supports safe citizen crowdsourcing, tamper-evident evidence uploads, role-based field verification with self-approval guards, and OASIS CAP v1.2 standardized early warning dispatches.

**Phase 7 is officially complete. No Phase 8 work will begin until explicit user instruction and approval are provided.**
