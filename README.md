# LandslideGuard AI

> **AI-Powered Pan-India Landslide Risk Monitoring, Explainable Susceptibility, and Real-Time Early Warning Platform**

[![Backend Tests](https://img.shields.io/badge/Pytest-84%20Passed%20(100%25)-emerald?style=flat-square&logo=pytest)](docs/phase-reports/PHASE-8-REPORT.md)
[![Operational Status](https://img.shields.io/badge/Readiness-Deployment%20Candidate-teal?style=flat-square)](docs/phase-reports/PHASE-8-REPORT.md)
[![Database](https://img.shields.io/badge/Database-PostgreSQL%2015-blue?style=flat-square&logo=postgresql)](docs/phase-reports/PHASE-3-REPORT.md)
[![Frontend](https://img.shields.io/badge/Frontend-React%2018%20%2B%20TypeScript-cyan?style=flat-square&logo=react)](docs/phase-reports/PHASE-2-REPORT.md)
[![AI Engine](https://img.shields.io/badge/AI%20Engine-Explainable%20Geomorphic%20v1.0.0-indigo?style=flat-square)](docs/phase-reports/PHASE-6-REPORT.md)
[![CAP Protocol](https://img.shields.io/badge/Early%20Warning-OASIS%20CAP%20v1.2%20(Simulated)-purple?style=flat-square)](docs/phase-reports/PHASE-7-REPORT.md)
[![Weather Integration](https://img.shields.io/badge/Weather%20Telemetry-Open--Meteo%20(ECMWF%2FGFS)-orange?style=flat-square)](docs/phase-reports/PHASE-5-REPORT.md)
[![License](https://img.shields.io/badge/License-MIT-slate?style=flat-square)](LICENSE)

---

## 📌 Executive Overview

**LandslideGuard AI** is a full-stack geohazard risk monitoring and meteorological early-warning platform designed for vulnerable hill tracts across India. Spanning from the high Himalayas in the north (Ladakh, Jammu & Kashmir, Himachal Pradesh, Uttarakhand) and the North Eastern Region (NER) to the Western Ghats (Maharashtra, Karnataka, Kerala), the Nilgiri Hills, and down to Kanyakumari, the platform synthesizes geospatial terrain attributes with verified in-situ hydrometeorological telemetry.

The platform is engineered around a core safety invariant: **a hazard-monitoring system must communicate uncertainty rather than invent confidence.** Incomplete telemetry, network outages, and missing sensor readings are explicitly reported as `"No data available"`, preventing silent failures and catastrophic false-negative risk assessments.

---

## ⚠️ Important Disclaimer

> [!WARNING]
> **DEVELOPMENT & RESEARCH PLATFORM ONLY**
> 
> LandslideGuard AI is an academic and engineering prototype currently under active development. It is **not** an officially accredited civil-protection warning service. Operational disaster evacuations, road closures, and emergency actions must rely strictly on authorized advisories from designated statutory agencies, including the **National Disaster Management Authority (NDMA)**, the **Geological Survey of India (GSI)**, the **India Meteorological Department (IMD)**, and respective State Disaster Management Authorities (SDMAs).

---

## 🌟 Key Features

### 1. Pan-India Interactive GIS Workstation
- **Full-Extent Coverage:** A Leaflet-powered GIS workstation configured to encompass the entire geographical boundary of India (`[7.2° N, 67.5° E]` to `[37.8° N, 97.8° E]`).
- **Regional Focus Presets:** Instant viewport transitions for major geohazard corridors:
  - 🇮🇳 **All India** (National overview)
  - 🏔️ **Himalayas / North** (Ladakh, J&K, HP, Uttarakhand)
  - 🌿 **Northeast India / NER** (Assam, Meghalaya, Sikkim, Nagaland, Mizoram, Arunachal Pradesh)
  - 🌊 **Western Ghats** (Maharashtra, Karnataka, Kerala)
  - ⛰️ **Nilgiris & Kanyakumari** (Tamil Nadu hill tracts down to the southern cape)
- **Multi-Basemap Switching:** Seamless toggling between CartoDB Dark (Navy disaster theme), OpenStreetMap (standard road network), and OpenTopoMap (topographical contours and elevation relief).

### 2. Multi-Class Geohazard Symbol Layers
Distinct, non-conflicting visual symbology on the spatial map:
- 🔵 **Monitored Ground Stations:** Circular radar beacons with live telemetry freshness pips indicating data quality in real time.
- 🔶 **Calculated Risk Assessments:** Color-coded diamond badges representing evaluated susceptibility tiers:
  - 🔴 **Critical** (High pore-pressure & extreme antecedent precipitation)
  - 🟠 **High** (Elevated failure probability)
  - 🟡 **Moderate** (Heightened moisture baseline)
  - 🟢 **Low** (Stable slope threshold)
- 🔺 **Verified Historical Incident Scars:** Crimson hazard triangles mapping ground-truth historical landslide detachments and debris flows.

### 3. Verified Weather Telemetry Ingestion
- **External Provider Integration:** Integrated with the **Open-Meteo Weather API** using high-resolution ECMWF and GFS global atmospheric reanalysis.
- **Physical Sanity Validation Engine:**
  - Precipitation rate: $0.0 \text{ to } 500.0 \text{ mm/h}$
  - Soil moisture saturation: $0.0 \text{ to } 100.0\%$
  - Surface ambient temperature: $-80.0 \text{ to } 65.0^\circ\text{C}$
  - Relative humidity: $0.0 \text{ to } 100.0\%$
- **Temporal Clock-Skew Guard:** Discards future-dated readings exceeding a 15-minute clock-skew boundary.
- **Resilient Network Handling:** Configured with 8.0-second timeouts, bounded exponential backoff retries (3 attempts), HTTP 429 rate-limit backoff, and idempotent database upserts.

### 4. Deterministic Data-Quality Lifecycle
Every observation ingested by the platform is assigned an explicit, traceable quality status:

| Status Badge | Classification Criteria | System Behavior |
|---|---|---|
| `CURRENT` | Verified observation $\le 3.0 \text{ hours}$ old | Rendered with green indicator; used in live telemetry calculations |
| `STALE` | Verified observation $> 3.0 \text{ hours}$ old | Rendered with amber warning badge; flags latency in sensor updates |
| `MISSING` | No sensor or provider reading received | Rendered strictly as `"No data available"`; zero rainfall is **never** fabricated |
| `DEMO` | Seeded demonstration or baseline calibration data | Explicitly marked `DEMO BASELINE` to avoid confusing demonstration data with live readings |
| `FORECAST` | Forward-looking numerical weather model projection | Segregated into forecast storage; never mixed into historical ground-truth observations |
| `INVALID` | Fails physical bounds, corrupt units, or `NaN` | Rejected by validation engine; logged to audit table |

### 5. Interactive Telemetry Inspector
- **4-Metric Telemetry Grid:** Real-time display of Precipitation, Soil Moisture Saturation, Surface Temperature, and Relative Humidity.
- **On-Demand Synchronization:** Station-level `"Fetch Live Weather"` button and pan-India `"Sync All Live"` batch trigger directly from the UI.
- **Auditable Provenance:** Every metric displays source attribution, observation timestamp, and local retrieval timestamp.

### 6. Explainable AI Susceptibility Engine (GeomorphicBaseline v1.0.0)
- **Physics-Grounded Separation:** Decouples static terrain predisposition ($S = 0.75 f_{slope} + 0.25 f_{elev}$) from dynamic hydrometeorological triggers ($T = 0.55 f_{rain} + 0.45 f_{moist}$).
- **Combined Dynamic Risk Score:** Evaluates $R = 0.5 \cdot S + 0.5 \cdot T$ across four operational risk tiers (`LOW`, `MODERATE`, `HIGH`, `CRITICAL`).
- **Explainable Factor Attribution:** Provides complete percentage contributions, normalized scores, and plain-language physical narratives for every evaluated metric.
- **Strict Data-Gating:** Stations lacking terrain parameters return `INSUFFICIENT_DATA`. Missing weather telemetry evaluates static terrain without assuming $0.0\text{ mm}$ rainfall. Stale readings (>3h) are flagged `DATA_STALE`.

### 7. Anti-Flapping Early Warning Safeguards Console
- **Deduplication Event Fingerprinting:** Computes deterministic hashes (`loc_{id}_sev_{severity}_{date}`) to prevent repeated redundant alerts.
- **6-Hour Rate-Limiting Cooldown Window:** Suppresses re-issuance of identical alerts within a 6-hour window, eliminating control center alert fatigue.
- **Life-Safety Escalation Overrides:** Rapid condition deterioration (e.g. escalating from `HIGH` to `CRITICAL`) bypasses active cooldowns immediately.
- **Operational Warning Lifecycle:** Endpoints and UI controls support official workflow state transitions (`issued` &rarr; `acknowledged` &rarr; `resolved`).

### 8. Repository ML Data Readiness Audit
- **Defensive Science Stance:** Programmatically audits the database before training black-box ML models (`GET /api/v1/risk-assessments/data-readiness`).
- **Defensible Audit Verdict:** Formally returns **`INSUFFICIENT DATA FOR DEFENSIVE MACHINE LEARNING MODEL TRAINING`** due to lack of ground-truth absence/negative samples, positive reporting bias, and absent high-resolution GIS layers (lithology, fault proximity, TWI, curvature, InSAR creep).

### 9. Community Crowdsourcing & Ground Evidence Upload
- **Citizen Hazard Intake:** Citizen observers submit suspected slope movement, tension cracks, debris flows, and road blockages with landmark descriptions and India-bounded coordinates.
- **Secure File Ingestion:** Strict whitelist (JPEG, PNG, WEBP, PDF) enforced by both MIME validation and initial-byte magic signature inspection. Max 5 MB per file.
- **Tamper-Evident Storage:** Path-traversal sanitized filenames, SHA-256 cryptographic checksums, and non-public streaming via authenticated endpoints.
- **Mandatory Consent:** PII consent flag enforced to guarantee compliance with public data-retention guidelines.

### 10. Multi-Stage Field Verification & Anti-Self-Approval
- **Role-Gated Review Transitions:** Role hierarchy (`citizen` < `observer` < `ddma_officer` < `admin`) governs transitions (`submitted` / `pending_review` &rarr; `under_review` &rarr; `verified` / `rejected` / `needs_more_info`).
- **Anti-Self-Approval Safeguard:** Submitters cannot verify or approve their own incident reports (`HTTP 403 Forbidden`). An independent field officer or administrator must audit the observation.
- **Immutable Review Audit Log:** Every status transition logs the reviewing authority, role, prior/new status, action label, and justification notes.
- **Dedicated GIS Map Symbology:** Unverified community submissions are rendered with amber beacons and verified community reports with teal shields, strictly separated from official historical GSI records.

### 11. OASIS Common Alerting Protocol (CAP v1.2 / ITU-T X.1303) Simulated Dispatches
- **Standardized XML Synthesis:** `CapMessageBuilder` structures OASIS CAP v1.2 compliant alert payloads with deterministic identifiers, ISO 8601 UTC timestamps, and circular spatial zones.
- **Schema & Syntax Validator:** `CapSchemaValidator` enforces XML namespace and ITU-T X.1303 enumerations (`urgency`, `severity`, `certainty`, `status`, `msgType`, `scope`).
- **Data Freshness Safeguard:** Blocks CAP alert draft generation or approval whenever target station telemetry is `STALE` (>3h) or `INSUFFICIENT_DATA`.
- **Simulated Export Adapter:** Isolated transmission adapter (`is_simulation=True`) issues tamper-evident dispatch receipts without triggering public sirens or carrier broadcasts.
- **Official Message Cancellation:** Emits `<msgType>Cancel</msgType>` updates with `<references>` linking to the original message identifier.

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    subgraph Client["Frontend Client (React 18 + Vite + TypeScript)"]
        UI["Application Shell (AppLayout)"]
        MapComp["IndiaMonitoringMap (Leaflet GIS)"]
        RiskPage["RiskMapPage (GIS Telemetry Workstation)"]
        AiPage["AiPredictionPage (Factor Attribution & ML Readiness)"]
        FieldPage["FieldReportsPage (Crowdsourcing & Verification Desk)"]
        AlertsPage["AlertsPage (CAP v1.2 & Early Warning Dispatches)"]
        OverviewPage["OverviewPage (System Health & StatCards)"]
        ApiClient["REST API Client (fetchWithTimeout)"]
        
        UI --> MapComp
        UI --> RiskPage
        UI --> AiPage
        UI --> FieldPage
        UI --> AlertsPage
        UI --> OverviewPage
        MapComp --> ApiClient
        RiskPage --> ApiClient
        AiPage --> ApiClient
        FieldPage --> ApiClient
        AlertsPage --> ApiClient
        OverviewPage --> ApiClient
    end

    subgraph Gateway["FastAPI Backend (Python 3.11)"]
        Router["API v1 Router (/api/v1)"]
        HealthEp["Health Endpoints (/health, /health/db)"]
        SpatialEp["Spatial Endpoints (/locations, /roads, /incidents)"]
        WeatherEp["Weather Endpoints (/weather/status, /weather/refresh)"]
        RiskEp["AI Susceptibility (/risk-assessments/explain, /evaluate, /data-readiness)"]
        AlertEp["Warning Safeguards (/alerts/evaluate-triggers, /acknowledge, /resolve)"]
        CapEp["CAP Protocol Endpoints (/cap/draft, /preview, /approve, /export, /cancel)"]
        AuthEp["User Directory & Roles (/auth/users, /auth/me)"]
        
        Router --> HealthEp
        Router --> SpatialEp
        Router --> WeatherEp
        Router --> RiskEp
        Router --> AlertEp
        Router --> CapEp
        Router --> AuthEp
    end

    subgraph AIAndSafeguards["AI Susceptibility, Verification & Warning Safeguards"]
        SusService["SusceptibilityService (GeomorphicBaselineModel v1.0.0)"]
        WarningEngine["AlertWarningEngine & AlertSafeguards (Anti-Flapping, 6h Cooldown)"]
        EvidenceService["EvidenceStorageService (Magic Byte Check, 5MB Max)"]
        CapService["CapService & CapMessageBuilder (OASIS CAP v1.2 / ITU-T X.1303)"]
        CapValidator["CapSchemaValidator (XML Schema & Enums)"]
        
        RiskEp --> SusService
        AlertEp --> WarningEngine
        SpatialEp --> EvidenceService
        CapEp --> CapService
        CapService --> CapValidator
        SusService --> CapService
    end

    subgraph Storage["Persistence & External Services"]
        PG[("PostgreSQL 15 (landslideguard_db)")]
        ExtAPI["Open-Meteo Weather API (CC BY 4.0)"]
        EvidenceDisk[("Isolated Evidence Storage (/data/evidence)")]
    end

    ApiClient -->|"HTTPS / JSON"| Router
    HealthEp -->|"SELECT 1 Ping"| PG
    SpatialEp -->|"SQLAlchemy ORM"| PG
    SusService -->|"SQLAlchemy ORM"| PG
    WarningEngine -->|"SQLAlchemy ORM"| PG
    CapService -->|"SQLAlchemy ORM"| PG
    EvidenceService -->|"Safe Filesystem I/O"| EvidenceDisk
    WeatherEp -->|"Bounded Retries / HTTPS"| ExtAPI
```

---

## 💻 Technology Stack

| Domain | Technology | Version | Purpose |
|---|---|---|---|
| **Frontend Framework** | React | `18.2.0` | Declarative component UI engine |
| **Build Tooling** | Vite | `5.1.4` | Fast HMR dev server & optimized production bundling |
| **Language (UI)** | TypeScript | `5.3.3` | Type safety and strict interface definitions |
| **Styling** | Tailwind CSS | `3.4.1` | Responsive utility-first design system (`#0B1E36` disaster theme) |
| **Mapping Engine** | Leaflet | `1.9.4` | Interactive Pan-India GIS vector canvas |
| **Iconography** | Lucide React | `0.359.0` | Accessible disaster-management UI symbols |
| **Backend Framework** | FastAPI | `0.110.0+` | High-performance asynchronous REST API framework |
| **Language (Server)** | Python | `3.11.9` | Strongly typed backend services |
| **ORM / Data Access** | SQLAlchemy | `2.0.28+` | Relational domain models & connection pooling |
| **Database Migrations**| Alembic | `1.13.1+` | Schema versioning and automated DDL migrations |
| **Database Engine** | PostgreSQL | `15.x` | Dedicated production database (`landslideguard_db`) |
| **PostgreSQL Driver** | psycopg2-binary | `2.9.9+` | Native PostgreSQL communication protocol |
| **Validation** | Pydantic v2 | `2.6.0+` | Typed request/response schemas and config parsing |
| **External Weather** | Open-Meteo API | CC BY 4.0 | Real-time global atmospheric reanalysis (ECMWF/GFS) |
| **Testing** | Pytest + HTTPX | `8.0.0+` / `0.27.0+` | Automated endpoint and unit testing suites |

---

## 📂 Repository Structure

```text
landslideguard/
├── .env.example                         # Environment template with documented settings
├── .gitignore                           # Git exclusion rules (ignores .env, venvs, dist)
├── README.md                            # Main project technical documentation
├── backend/
│   ├── alembic/                         # Database migration tracking
│   │   ├── env.py                       # Alembic database environment connection
│   │   └── versions/
│   │       ├── a2e2406c1fcf_initial_schema.py                      # Phase 3: 7 relational tables
│   │       ├── eb997b8d5b17_add_weather_quality_and_forecast_fields.py # Phase 5: Telemetry quality
│   │       ├── fd7dfdff3263_add_phase6_susceptibility_and_alert_.py   # Phase 6: Susceptibility & safeguards
│   │       └── c71a39f04e12_add_phase7_crowdsourcing_and_cap_tables.py # Phase 7: Crowdsourcing & CAP
│   ├── alembic.ini                      # Alembic CLI configuration
│   ├── pytest.ini                       # Pytest execution configuration
│   ├── requirements.txt                 # Backend Python package requirements
│   ├── app/
│   │   ├── main.py                      # FastAPI root application entry point & CORS
│   │   ├── api/v1/
│   │   │   ├── router.py                # Aggregation router for v1 namespaces
│   │   │   └── endpoints/
│   │   │       ├── health.py            # /api/v1/health & /api/v1/health/db
│   │   │       ├── info.py              # /api/v1/info system metadata
│   │   │       ├── auth.py              # User directory & active profile
│   │   │       ├── locations.py         # Monitored locations CRUD
│   │   │       ├── observations.py      # Hydrometeorological observations CRUD
│   │   │       ├── incidents.py         # Community & historical incident reporting & evidence
│   │   │       ├── roads.py             # Road vulnerability corridors CRUD
│   │   │       ├── risk_assessments.py  # Explainable susceptibility & readiness audit
│   │   │       ├── alerts.py            # Safeguarded early warning alert triggers & lifecycle
│   │   │       ├── cap.py               # OASIS CAP v1.2 XML drafting, approval & simulated export
│   │   │       └── weather.py           # Real-time weather sync & status
│   │   ├── core/
│   │   │   ├── config.py                # Pydantic BaseSettings & env resolution
│   │   │   ├── database.py              # SQLAlchemy engine, SessionLocal, get_db
│   │   │   └── security.py              # RBAC roles, user context & anti-self-approval enforcement
│   │   ├── models/                      # SQLAlchemy 2.0 ORM domain entities
│   │   │   ├── base.py                  # Declarative base with common timestamps
│   │   │   ├── user.py                  # Operational user identities & RBAC roles
│   │   │   ├── location.py              # Monitored locations (coordinates, slope, elevation)
│   │   │   ├── observation.py           # In-situ readings, quality status & forecasts
│   │   │   ├── incident.py              # Historical scars, crowdsourced reports & attachments
│   │   │   ├── road.py                  # Critical transit corridors & blockage tracking
│   │   │   ├── risk_assessment.py       # Susceptibility scores, factor JSON & limitations
│   │   │   ├── alert.py                 # Anti-flapping fingerprints & cooldown windows
│   │   │   └── cap_message.py           # OASIS CAP v1.2 structured dispatches & audit logs
│   │   ├── schemas/                     # Pydantic request / response schemas
│   │   │   ├── health.py
│   │   │   ├── info.py
│   │   │   ├── location.py
│   │   │   ├── observation.py
│   │   │   ├── incident.py
│   │   │   ├── road.py
│   │   │   ├── risk_assessment.py
│   │   │   ├── alert.py
│   │   │   └── cap.py
│   │   └── services/
│   │       ├── weather/                 # Weather telemetry provider subsystem
│   │       │   ├── __init__.py          # Subsystem module exports
│   │       │   ├── base.py              # Abstract BaseWeatherProvider & dataclasses
│   │       │   ├── validator.py         # WeatherValidator (physical bounds & skew)
│   │       │   ├── open_meteo.py        # OpenMeteoProvider (ECMWF/GFS client)
│   │       │   └── service.py           # WeatherService (batch persistence & idempotency)
│   │       ├── susceptibility/          # AI susceptibility & readiness subsystem
│   │       │   ├── __init__.py
│   │       │   ├── base.py              # BaseSusceptibilityModel & data contracts
│   │       │   ├── baseline.py          # GeomorphicBaselineModel & readiness audit
│   │       │   └── service.py           # SusceptibilityService orchestrator
│   │       ├── alerts/                  # Warning safeguards & deduplication subsystem
│   │       │   ├── __init__.py
│   │       │   ├── safeguards.py        # Anti-flapping fingerprints, 6h cooldowns & escalation
│   │       │   └── engine.py            # AlertWarningEngine & lifecycle transitions
│   │       ├── evidence/                # Tamper-evident ground evidence handling
│   │       │   ├── __init__.py
│   │       │   └── service.py           # Magic bytes validation, 5MB limit, SHA-256 & streaming
│   │       └── cap/                     # OASIS CAP v1.2 message & schema subsystem
│   │           ├── __init__.py
│   │           ├── builder.py           # CapMessageBuilder (ITU-T X.1303 XML synthesis)
│   │           ├── validator.py         # CapSchemaValidator (XML syntax & enum verification)
│   │           └── service.py           # CapService (data-freshness guard, simulated export adapter)
│   ├── scripts/
│   │   ├── seed_demo_data.py            # Seeds 17 Pan-India stations & historical scars
│   │   └── seed_phase7_demo.py          # Seeds demonstration community reports & CAP message
│   └── tests/                           # 76 automated unit & integration tests
│       ├── conftest.py                  # Pytest fixtures & SQLite/PostgreSQL test engines
│       ├── test_health.py               # Operational heartbeat tests
│       ├── test_database_health.py      # Database diagnostic & fault-tolerance tests
│       ├── test_locations.py            # Coordinate validation & CRUD tests
│       ├── test_observations.py         # Foreign-key protection & pagination tests
│       ├── test_incidents.py            # Incident status filtering tests
│       ├── test_roads.py                # Corridor retrieval tests
│       ├── test_risk_assessments_and_alerts.py # Risk tier schema tests
│       ├── test_weather_service.py      # Range validation, skew, rate limits, idempotency
│       ├── test_weather_endpoints.py    # Weather status & refresh API tests
│       ├── test_susceptibility_service.py # Normalization, missing data gating & readiness audit
│       ├── test_alert_safeguards.py     # Deduplication, cooldown suppression & escalation
│       ├── test_phase6_endpoints.py     # Explain, readiness, evaluate & trigger endpoints
│       └── test_phase7_community_and_cap.py # Crowdsourcing, magic bytes, self-approval & CAP tests
├── frontend/
│   ├── index.html                       # HTML entry shell
│   ├── package.json                     # Frontend npm dependencies
│   ├── vite.config.ts                   # Vite bundler configuration
│   ├── tsconfig.json                    # TypeScript compiler options
│   ├── tailwind.config.js               # Custom disaster theme color tokens
│   └── src/
│       ├── main.tsx                     # React DOM bootstrap
│       ├── App.tsx                      # Primary tab router & health polling
│       ├── index.css                    # Tailwind imports & Leaflet marker animations
│       ├── types/
│       │   └── index.ts                 # Full TypeScript contract interfaces
│       ├── services/
│       │   └── api.ts                   # Fetch client with timeout & composite mapper
│       ├── components/
│       │   ├── Header.tsx               # Application header with live status badge
│       │   ├── Sidebar.tsx              # 9-section disaster management sidebar (Phases 1-7 Active)
│       │   ├── StatusPanel.tsx          # Real-time backend connectivity diagnostics
│       │   ├── WelcomeSection.tsx       # Mission statement & telemetry status banner
│       │   ├── PhaseRoadmap.tsx         # Multi-phase roadmap component (Phases 1-7 Verified)
│       │   ├── RiskLegend.tsx           # Geohazard susceptibility classification legend
│       │   ├── common/                  # Reusable UI component library
│       │   │   ├── PageHeader.tsx
│       │   │   ├── StatCard.tsx
│       │   │   ├── StatusBadge.tsx
│       │   │   ├── EmptyState.tsx
│       │   │   ├── LoadingState.tsx
│       │   │   └── ErrorState.tsx
│       │   ├── layout/
│       │   │   └── AppLayout.tsx        # Responsive desktop/mobile application frame
│       │   └── map/
│       │       └── IndiaMonitoringMap.tsx # Pan-India Leaflet GIS workstation (Distinct Symbology)
│       └── pages/
│           ├── OverviewPage.tsx         # Executive metrics dashboard & Phase 7 banner
│           ├── RiskMapPage.tsx          # Interactive GIS hazard mapping workstation
│           ├── AiPredictionPage.tsx     # AI Susceptibility & ML Data Readiness Workstation
│           ├── FieldReportsPage.tsx     # Crowdsourced Reporting & Field Verification Console
│           ├── AlertsPage.tsx           # Dual-tab Early Warning & OASIS CAP v1.2 Dispatch Console
│           └── PlaceholderPage.tsx      # Structured preview pages for future phases
└── docs/
    ├── PROJECT-PROGRESS.md              # Project status tracking across all 7 phases
    └── phase-reports/
        ├── PHASE-1-REPORT.md            # Phase 1 signoff: Foundation & health API
        ├── PHASE-2-REPORT.md            # Phase 2 signoff: UI design system & shell
        ├── PHASE-3-REPORT.md            # Phase 3 signoff: PostgreSQL database & models
        ├── PHASE-4-REPORT.md            # Phase 4 signoff: Pan-India spatial GIS map
        ├── PHASE-5-REPORT.md            # Phase 5 signoff: Verified weather integration
        ├── PHASE-6-REPORT.md            # Phase 6 signoff: Explainable AI & warning engine
        └── PHASE-7-REPORT.md            # Phase 7 signoff: Crowdsourcing, Verification & CAP
```

---

## 🚀 Quickstart & Setup Guide (Windows)

### 1. Prerequisites
Ensure the following runtimes are installed on your system:
- **Python**: `3.11.x` ([python.org](https://www.python.org/))
- **Node.js**: `v18.x` or `v20.x` ([nodejs.org](https://nodejs.org/))
- **PostgreSQL**: `15.x` ([postgresql.org](https://www.postgresql.org/))
- **Git**: Latest release ([git-scm.com](https://git-scm.com/))

---

### 2. Environment Configuration
Clone the repository and copy the environment template:

```powershell
# In PowerShell:
cd C:\Users\Lenovo\Downloads\landslideguard
Copy-Item .env.example .env
```

Open `.env` and configure your local PostgreSQL database credentials:
```ini
# Database Connection (Dedicated PostgreSQL 15 database)
DATABASE_URL="postgresql+psycopg2://landslideguard_app:YOUR_SECURE_PASSWORD@localhost:5432/landslideguard_db"

# Weather Provider Configuration
WEATHER_PROVIDER="open-meteo"
OPEN_METEO_API_URL="https://api.open-meteo.com/v1/forecast"
WEATHER_REQUEST_TIMEOUT_SECONDS=8.0
WEATHER_MAX_RETRIES=3
WEATHER_FRESHNESS_HOURS_CURRENT=3.0
WEATHER_FRESHNESS_HOURS_STALE=24.0
WEATHER_CLOCK_SKEW_TOLERANCE_MINUTES=15.0

# Server & Client Configuration
BACKEND_HOST="127.0.0.1"
BACKEND_PORT=8000
CORS_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
VITE_API_BASE_URL="http://127.0.0.1:8000"
```

> [!NOTE]
> `.env` is registered in `.gitignore` and must **never** be committed to version control.

---

### 3. Database Initialization & Migrations

Create the database and role in PostgreSQL:

```sql
-- In psql or pgAdmin:
CREATE ROLE landslideguard_app WITH LOGIN PASSWORD 'YOUR_SECURE_PASSWORD';
CREATE DATABASE landslideguard_db OWNER landslideguard_app;
GRANT ALL PRIVILEGES ON DATABASE landslideguard_db TO landslideguard_app;
```

Apply the Alembic migrations and seed baseline demonstration locations:

```powershell
# Navigate to backend directory
cd backend

# Create and activate Python virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install backend dependencies
pip install -r requirements.txt

# Run Alembic migrations against PostgreSQL
alembic upgrade head

# Seed initial Pan-India stations and historical scars
python scripts/seed_demo_data.py
```

---

### 4. Running the Platform

#### Terminal A: Start FastAPI Backend Server
```powershell
cd C:\Users\Lenovo\Downloads\landslideguard\backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
The REST API and interactive documentation are available at:
- **Interactive Swagger Docs:** `http://127.0.0.1:8000/docs`
- **Alternative ReDoc UI:** `http://127.0.0.1:8000/redoc`

#### Terminal B: Start React Frontend Dev Server
```powershell
cd C:\Users\Lenovo\Downloads\landslideguard\frontend
npm install
npm run dev
```
Open your browser to: `http://localhost:5173`.

---

## 📡 API Reference & Verified Examples

### 1. System Health Check
`GET /api/v1/health`
```json
{
  "status": "healthy",
  "application": "LandslideGuard AI",
  "version": "1.0.0",
  "timestamp": "2026-10-29T15:00:00.000Z"
}
```

### 2. PostgreSQL Connection Diagnostic
`GET /api/v1/health/db`
```json
{
  "status": "healthy",
  "database": "connected",
  "dialect": "postgresql",
  "timestamp": "2026-10-29T15:00:00.000Z"
}
```

### 3. Pan-India Weather Telemetry Summary
`GET /api/v1/weather/status`
```json
{
  "provider_name": "Open-Meteo Weather API",
  "provider_status": "operational",
  "provider_docs_url": "https://open-meteo.com/en/docs",
  "attribution": "Weather data by Open-Meteo.com (ECMWF/GFS Analysis, CC BY 4.0)",
  "last_sync_utc": "2026-10-29T09:30:00Z",
  "total_monitored_locations": 17,
  "locations_current": 1,
  "locations_stale": 0,
  "locations_missing": 16,
  "locations_invalid_or_error": 0,
  "monitored_regions": [
    "Himalayas / North",
    "Northeast India (NER)",
    "Western Ghats",
    "Nilgiris & Kanyakumari"
  ]
}
```

### 4. Trigger Weather Synchronization
`POST /api/v1/weather/refresh?location_id=3` (or omit `location_id` for full pan-India batch sync):
```json
{
  "status": "success",
  "provider": "open_meteo",
  "refreshed_count": 1,
  "failed_count": 0,
  "skipped_count": 0,
  "timestamp_utc": "2026-10-29T09:32:00.123456Z",
  "details": [
    {
      "location_id": 3,
      "location_name": "Joshimath Landslide Sector, Chamoli",
      "rainfall_mm": 0.0,
      "soil_moisture_pct": 29.8,
      "temperature_c": 19.3,
      "humidity_pct": 40.0,
      "quality_status": "CURRENT",
      "is_forecast": false
    }
  ]
}
```

### 5. Explainable AI Susceptibility Breakdown
`GET /api/v1/risk-assessments/explain/3`
```json
{
  "location_id": 3,
  "location_name": "Joshimath Landslide Sector, Chamoli",
  "assessment_type": "dynamic_risk",
  "risk_category": "moderate",
  "risk_score": 0.42,
  "susceptibility_score": 0.65,
  "trigger_score": 0.19,
  "data_quality_status": "CURRENT",
  "is_sufficient_data": true,
  "is_demo": false,
  "assessed_at": "2026-10-29T10:00:00Z",
  "model_version": "v1.0.0",
  "model_name": "GeomorphicBaselineModel",
  "contributing_factors": [
    {
      "factor_name": "Slope Incline",
      "raw_value": 34.0,
      "unit": "degrees",
      "normalized_score": 0.54,
      "weight": 0.375,
      "contribution_score": 0.20,
      "percentage_of_total": 47.6,
      "narrative": "Slope angle of 34.0° exceeds the 25° critical threshold for translational shear failure."
    }
  ],
  "limitations": [
    "Baseline geomorphic model operates on simplified DEM slope; does not model complex sub-surface shear zones."
  ],
  "analytical_rationale": "Moderate combined hazard driven by steep structural terrain (S=65.0%) with baseline dry hydrometeorological triggers (T=19.0%)."
}
```

### 6. Repository ML Data Readiness Audit
`GET /api/v1/risk-assessments/data-readiness`
```json
{
  "total_locations": 17,
  "locations_with_terrain": 17,
  "locations_with_live_telemetry": 17,
  "historical_incident_count": 5,
  "verified_incident_count": 4,
  "synthetic_demo_count": 1,
  "ml_readiness_verdict": "INSUFFICIENT DATA FOR DEFENSIVE MACHINE LEARNING MODEL TRAINING",
  "sampling_bias_assessment": "Severe reporting and positive-only sampling bias. Zero verified negative (non-failure) absence samples in database.",
  "prerequisites_for_ml_deployment": [
    "Ingestion of GSI National Landslide Susceptibility Mapping (NLSM) polygons.",
    "Balanced negative absence sampling.",
    "DEM derivatives (plan/profile curvature, TWI, aspect).",
    "GSI Bhukosh lithological rock groups."
  ]
}
```

### 7. Trigger Safeguarded Warning Evaluation
`POST /api/v1/alerts/evaluate-triggers`
```json
{
  "evaluated_locations": 17,
  "alerts_issued": 0,
  "alerts_suppressed": 17,
  "suppression_reasons": [
    "Station #3: Combined risk score (0.42) below warning threshold (0.50)"
  ],
  "dispatched_alerts": [],
  "evaluated_at": "2026-10-29T10:05:00Z"
}
```

---

## 🧪 Testing and Verification Suite

### Automated Backend Tests (Pytest)
The test suite validates data validation, edge cases, fault-tolerance, geomorphic mechanics, deduplication safeguards, and live schemas:

```powershell
# Run the complete test suite:
.\backend\.venv\Scripts\pytest .\backend -v
```

**Actual Verified Outcome:**
```text
======================== 84 passed, 2 warnings in 6.73s ========================
```
- **100% Pass Rate** across 84 test cases:
  - 3 health & diagnostics tests
  - 5 monitored location tests (coordinate bounds, uniqueness, pagination)
  - 4 observation tests (foreign keys, cascading delete protection)
  - 4 incident report tests (status filtering, category constraints)
  - 3 road corridor tests (vulnerability scoring, 404 handling)
  - 2 risk assessment & alert schema tests
  - 13 weather service unit tests (physical range clamping, clock-skew, rate limits, timeouts, idempotency)
  - 6 weather REST API integration tests
  - 9 susceptibility service unit tests (slope/elevation/rain/moisture normalization, data-gating, staleness, readiness audit)
  - 7 alert safeguards tests (deduplication fingerprints, 6h cooldown suppression, life-safety escalation, lifecycle transitions)
  - 6 Phase 6 REST API integration tests (`/explain`, `/data-readiness`, `/evaluate`, `/evaluate-triggers`, `/acknowledge`, `/resolve`)
  - 11 Phase 7 community crowdsourcing, verification, and OASIS CAP v1.2 tests
  - 8 Phase 8 end-to-end integration, security boundary, query optimization, and deployment readiness tests

### Frontend Production Build Check
```powershell
npm run build --prefix frontend
```
**Actual Verified Outcome:**
```text
vite v5.4.21 building for production...
✓ 1504 modules transformed.
dist/index.html                   0.58 kB │ gzip:   0.37 kB
dist/assets/index-Div_CnM8.css   64.73 kB │ gzip:  15.00 kB
dist/assets/index-D79p59II.js   538.26 kB │ gzip: 140.38 kB
✓ built in 11.16s
```
- Zero TypeScript compilation errors.
- Zero bundling errors or missing dependencies.

---

## 📸 User Interface & Screenshots

> [!NOTE]
> **Capturing UI Screenshots for Documentation:**
> 1. Launch the platform locally using `npm run dev` and `uvicorn app.main:app`.
> 2. Navigate to `http://localhost:5173` to capture the **Overview Dashboard**.
> 3. Switch to the **Risk Map** tab to capture the **Pan-India GIS Workstation** and **Telemetry Inspector Drawer**.
> 4. Switch to the **AI Susceptibility** tab to capture the **Factor Attribution Breakdown** and **ML Data Readiness Audit**.
> 5. Switch to the **Early Warnings** tab to capture the **Safeguarded Warning Dispatch Console**.
> 6. Save screen captures to `docs/assets/screenshots/` and update references below.

| View | Description | Suggested Path |
|---|---|---|
| **Pan-India GIS Map** | Full-extent national map showing stations, risk diamonds, and historical scars | `docs/assets/screenshots/gis-map-pan-india.png` |
| **Telemetry Inspector** | Side drawer showing 4-metric readings, quality badge, and live sync action | `docs/assets/screenshots/telemetry-inspector.png` |
| **AI Susceptibility** | 3-score gauge tiles, factor attribution bars, analytical geomorphic synthesis | `docs/assets/screenshots/ai-susceptibility-inspector.png` |
| **ML Data Readiness** | Defensive audit banner, feature layer gaps, sampling bias & leakage analysis | `docs/assets/screenshots/ml-data-readiness-audit.png` |
| **Early Warnings** | Anti-flapping safeguard status bar, filterable alert feed, acknowledge/resolve | `docs/assets/screenshots/early-warning-console.png` |
| **System Overview** | Health diagnostic panel, weather integration bar, Phase 6 banner, and stat cards | `docs/assets/screenshots/overview-dashboard.png` |

---

## 🗺️ Engineering Phase Roadmap

Progress across the planned engineering phases:

- [x] **[Phase 1: Project Foundation & Health Handshake](docs/phase-reports/PHASE-1-REPORT.md)** — FastAPI server, React+Vite client, CORS, basic diagnostics.
- [x] **[Phase 2: UI Design System & Application Shell](docs/phase-reports/PHASE-2-REPORT.md)** — Disaster theme tokens (`#0B1E36`), 9-item responsive navigation shell, accessibility compliance.
- [x] **[Phase 3: Database & Backend Foundation](docs/phase-reports/PHASE-3-REPORT.md)** — PostgreSQL 15 connection, 7 relational SQLAlchemy models, Alembic migrations, 12 CRUD endpoints.
- [x] **[Phase 4: Pan-India Spatial GIS Map](docs/phase-reports/PHASE-4-REPORT.md)** — Leaflet canvas covering Kashmir to Kanyakumari, 5 regional presets, separate symbol classifications.
- [x] **[Phase 5: Verified Real-Time Weather Integration](docs/phase-reports/PHASE-5-REPORT.md)** — Open-Meteo external provider, range & clock-skew validation, data quality tags (`CURRENT`/`STALE`/`MISSING`/`DEMO`), batch sync.
- [x] **[Phase 6: AI Susceptibility Assessment & Explainable Warning Engine](docs/phase-reports/PHASE-6-REPORT.md)** — Grounded geomorphic physics baseline (`GeomorphicBaselineModel` v1.0.0), static vs trigger score decoupling ($R = 0.5 S + 0.5 T$), factor attribution sensitivity breakdown, anti-flapping deduplication & 6h cooldown safeguards, life-safety escalation overrides, repository ML data readiness audit, Alembic migration `fd7dfdff3263`, `AiPredictionPage`, `AlertsPage`, 22 new tests (65/65 passing).
- [x] **[Phase 7: Community Crowdsourcing, Field Verification & CAP Alert Workflow](docs/phase-reports/PHASE-7-REPORT.md)** — Audited citizen reporting, safe photographic evidence upload with magic byte checks and directory traversal defense, role-gated field review (`citizen`, `observer`, `ddma_officer`, `admin`) with anti-self-approval enforcement, distinct GIS map symbology, OASIS CAP v1.2 / ITU-T X.1303 message builder and schema validation, data freshness safeguards, simulated dispatch adapter, Alembic migration `c71a39f04e12` on PostgreSQL 15, `FieldReportsPage`, enhanced `AlertsPage`, 11 new tests (76/76 passing).
- [x] **[Phase 8: Final Integration, Security Audit & Deployment Readiness](docs/phase-reports/PHASE-8-REPORT.md)** — Comprehensive integration verification across all subsystems, security audits (secret leakage prevention, path traversal defense, MIME magic verification, RBAC & self-approval guard), query optimization (N+1 elimination with `selectinload`), empirical latency benchmarks, deployment candidate operational classification, and production `.env.example`, 8 new tests (84/84 passing).

Detailed phase sign-off logs are tracked in the **[Project Progress Tracker](docs/PROJECT-PROGRESS.md)**.

---

## 🔍 Known Limitations & Data-Coverage Caveats

1. **Station Density:** While the Leaflet GIS canvas encompasses the whole of India, active monitored station records are currently configured for 17 high-priority hill stations across 14 states/UTs.
2. **Atmospheric Model Resolution:** External weather readings derive from Open-Meteo's ECMWF IFS and GFS global atmospheric analysis. Microclimate variations and slope-specific rain shadow effects require ground Automatic Weather Stations (AWS) or borehole piezometers for official operational sign-off.
3. **Susceptibility Modeling:** As of Phase 6, the platform operates a transparent, physics-grounded geomorphic baseline (`GeomorphicBaselineModel` v1.0.0). As audited by the built-in ML Data Readiness pipeline, training supervised black-box ML models (Random Forest / XGBoost) is responsibly gated until balanced non-failure absence samples and high-resolution spatial GIS layers (lithology, fault vectors, TWI, curvature) are ingested.

---

## 📄 License

This project is licensed under the terms of the **MIT License**. Meteorological data is supplied under Open-Meteo's **CC BY 4.0** non-commercial evaluation tier. Map data is &copy; **OpenStreetMap**, **CARTO**, and **OpenTopoMap** contributors.
