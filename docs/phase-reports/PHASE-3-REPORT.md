# Phase 3 Report: Database and Backend Foundation

## 1. Phase Summary
Phase 3 established the official database and backend persistence architecture for **LandslideGuard AI** — an AI-Based Early Warning and Landslide Risk Monitoring System for India's North Eastern Region (NER). In accordance with strict Phase 3 rules, this phase implemented a centralized SQLAlchemy 2.x engine and session factory, Alembic database migration management, robust relational models with coordinate and enum validation, transactional request-scoped dependencies, and 12 database-backed REST API endpoints under `/api/v1` — while preserving 100% of Phase 1 and Phase 2 endpoints, tests, and frontend compatibility without fabricating real-world observations or emergency alerts.

---

## 2. Existing Code Inspected
Prior to code implementation, the following files were inspected:
- `docs/phase-reports/PHASE-1-REPORT.md`: Baseline FastAPI endpoints, test suites, and environment structure.
- `docs/phase-reports/PHASE-2-REPORT.md`: UI design tokens, navigation routes, and frontend integration state.
- `docs/PROJECT-PROGRESS.md`: Current project phase roadmap.
- `README.md`: System overview and architecture guide.
- `backend/app/main.py`: Preserved existing root and `/api/v1` routers; added startup lifespan handler for table creation.
- `backend/app/core/config.py`: Inspected settings and added database configuration parameters.
- `backend/requirements.txt`: Evaluated existing dependencies and added SQLAlchemy 2.x, Alembic, and PostgreSQL drivers.

---

## 3. Database Configuration
Database connectivity is managed centrally through environment variables in `backend/app/core/config.py` and `backend/app/core/database.py`:
- **`DATABASE_URL`**: Supports PostgreSQL (`postgresql+psycopg2://user:password@host:port/dbname`) as the primary production/development target, with an automatic, safe local fallback to SQLite (`sqlite:///./landslideguard.db`) for isolated test environments.
- **`DATABASE_ECHO`**: Configurable SQL logging (defaults to `False`).
- **`DB_POOL_PRE_PING`**: Enabled (`True`) to ensure stale or disconnected pooled connections are proactively detected and recycled.
- **Request-Scoped Session**: Implemented via FastAPI dependency `get_db()` with guaranteed `finally: db.close()` cleanup.
- **Database Health Diagnostic**: Implemented via `check_db_health()`, executing an active `SELECT 1` ping and reporting dialect, status (`connected` or `unavailable`), and availability.
- **Security**: Centralized in `.env.example`; no credentials or secrets committed.

---

## 4. Models Created
Seven modular SQLAlchemy models were implemented in `backend/app/models/`:

1. **`MonitoredLocation` (`monitored_locations`)**:
   - Primary key: `id` (Integer)
   - Fields: `name` (indexed), `state` (indexed), `district` (indexed), `latitude` (Float), `longitude` (Float), `elevation` (Float, optional), `slope_angle` (Float, optional), `is_active` (Boolean), `created_at` (DateTime UTC), `updated_at` (DateTime UTC).
   - Relationships: `observations` (cascade delete-orphan), `incident_reports`, `risk_assessments`, `alerts`.
2. **`EnvironmentalObservation` (`environmental_observations`)**:
   - Foreign key: `location_id` referencing `monitored_locations.id` (CASCADE).
   - Fields: `observation_type` (indexed enum: `rainfall`, `soil_moisture`, `pore_water_pressure`, `ground_vibration`, `slope_displacement`), `value` (Float), `unit` (String), `observed_at` (DateTime UTC, indexed), `source` (String), `provenance_metadata` (String, optional), `created_at` (DateTime UTC).
   - Composite Index: `ix_obs_loc_type_time` on `(location_id, observation_type, observed_at)`.
3. **`IncidentReport` (`incident_reports`)**:
   - Foreign key: `location_id` referencing `monitored_locations.id` (SET NULL, optional).
   - Fields: `category` (enum: `slope_cracks`, `suspected_landslide`, `road_blockage`, `debris_flow`, `rockfall`, `other`), `description` (Text), `latitude` (Float), `longitude` (Float), `reported_at` (DateTime UTC), `source_type` (enum: `citizen`, `field_observer`, `official_ddma`, `patrol`), `review_status` (enum: `pending_review`, `under_review`, `verified`, `rejected`), `created_at`, `updated_at`.
4. **`RoadSegment` (`road_segments`)**:
   - Fields: `road_name` (indexed), `state`, `district`, `connectivity_status` (indexed enum: `open`, `restricted`, `blocked`, `unknown`), `status_description` (String), `latitude` (Float, optional), `longitude` (Float, optional), `last_updated`, `created_at`.
5. **`RiskAssessment` (`risk_assessments`)**:
   - Foreign key: `location_id` referencing `monitored_locations.id` (CASCADE).
   - Fields: `risk_category` (indexed enum: `low`, `moderate`, `high`, `critical`), `risk_score` (Float, 0.0 to 1.0), `assessed_at` (DateTime UTC), `assessment_source` (String), `model_version` (String, optional), `explanation` (Text), `created_at`.
6. **`Alert` (`alerts`)**:
   - Foreign key: `location_id` referencing `monitored_locations.id` (SET NULL, optional).
   - Fields: `severity` (indexed enum: `low`, `moderate`, `high`, `critical`), `title` (String), `description` (Text), `status` (indexed enum: `draft`, `issued`, `acknowledged`, `resolved`, `cancelled`), `created_at`, `acknowledged_at`, `source`.
7. **`User` (`users`)**:
   - Prepared for Phase 4 authentication.
   - Fields: `display_name`, `email` (unique, indexed), `role` (enum: `operator`, `analyst`, `admin`, `field_agent`), `is_active`, `created_at`, `updated_at`.

---

## 5. Migration Implementation
- **Framework:** Alembic 1.20.1.
- **Configuration:** `backend/alembic.ini` and `backend/alembic/env.py`.
- **Dynamic Connection:** `env.py` reads `settings.DATABASE_URL` dynamically; no database URLs are hardcoded in ini files.
- **Model Registration:** `target_metadata = Base.metadata` binds all 7 model definitions.
- **SQLite Batch Mode:** Configured with `render_as_batch=True` for seamless migrations in SQLite development mode.
- **Initial Migration:** `a2e2406c1fcf_initial_schema.py` generated and applied with `alembic upgrade head`.

---

## 6. Endpoints Implemented

### Preserved Phase 1 & 2 Endpoints
- `GET /`: Root application status and metadata.
- `GET /api/v1/health`: Operational heartbeat (preserves existing contract).
- `GET /api/v1/info`: Public metadata and target region details.

### New Database & Diagnostic Endpoints (Phase 3)
1. **Database Health**:
   - `GET /api/v1/health/db`: Actively verifies database engine connection via `SELECT 1`; returns HTTP 200 with `connected` status or HTTP 503 with `unavailable` status if disconnected.
2. **Monitored Locations**:
   - `POST /api/v1/locations`: Registers a new location with coordinate bounds validation and duplicate conflict detection (HTTP 201).
   - `GET /api/v1/locations`: Lists locations with pagination (`page`, `size`), filtering by `state`, `district`, `is_active`.
   - `GET /api/v1/locations/{location_id}`: Returns single location details (HTTP 200 or 404).
   - `PATCH /api/v1/locations/{location_id}`: Partial attribute updates (HTTP 200 or 404).
   - `DELETE /api/v1/locations/{location_id}`: Deletes location (HTTP 204); enforces foreign-key referential integrity (returns HTTP 409 Conflict if dependent observations exist).
3. **Environmental Observations**:
   - `POST /api/v1/observations`: Records observation, validates foreign key `location_id`, enforces UTC timestamp (HTTP 201).
   - `GET /api/v1/observations`: Lists observations with pagination, filterable by `location_id`, `observation_type`, `start_time`, `end_time`.
   - `GET /api/v1/observations/{observation_id}`: Returns single observation details (HTTP 200 or 404).
4. **Field Incident Reports**:
   - `POST /api/v1/incidents`: Ingests field incident report, validates coordinates and category, sets default status `pending_review` (HTTP 201).
   - `GET /api/v1/incidents`: Lists incidents with pagination, filterable by `review_status`, `category`, `location_id`.
   - `GET /api/v1/incidents/{incident_id}`: Returns single incident details (HTTP 200 or 404).
   - `PATCH /api/v1/incidents/{incident_id}`: Updates `review_status` (`pending_review`, `under_review`, `verified`, `rejected`) and narrative details (HTTP 200 or 404).
5. **Road Segments**:
   - `POST /api/v1/roads`: Registers transit corridor (HTTP 201).
   - `GET /api/v1/roads`: Lists roads with pagination, filterable by `connectivity_status`, `state`, `district`.
   - `GET /api/v1/roads/{road_id}`: Returns single road segment details (HTTP 200 or 404).
6. **Risk Assessments**:
   - `GET /api/v1/risk-assessments`: Lists risk evaluations with pagination, filterable by `location_id`, `risk_category`.
   - `GET /api/v1/risk-assessments/{assessment_id}`: Returns single evaluation details (HTTP 200 or 404).
7. **Early Warning Alerts**:
   - `GET /api/v1/alerts`: Lists alert warnings with pagination, filterable by `severity`, `status`, `location_id`.
   - `GET /api/v1/alerts/{alert_id}`: Returns single alert details (HTTP 200 or 404).

---

## 7. Validation and Error Handling
- **Coordinate Validation:** Latitude restricted to `[-90.0, 90.0]`, Longitude restricted to `[-180.0, 180.0]`. Out-of-bounds coordinates return HTTP 422.
- **Slope Angle Validation:** Restricted to `[0.0, 90.0]` degrees.
- **Enum Type Safety:** Validated using Python `Literal` types for `observation_type`, `category`, `review_status`, `source_type`, `connectivity_status`, `risk_category`, `severity`, `alert_status`.
- **Pagination Safety:** Defaults `page=1 (ge=1)` and `size=20 (ge=1, le=100)`. Prevents unbounded table dumps.
- **Referential Integrity Protection:** Deleting a location that has dependent observations returns HTTP 409 Conflict with an actionable advisory message.
- **Duplicate Prevention:** Case-insensitive check on location name, district, and state returns HTTP 409 Conflict.
- **Safe Error Responses:** Internal database stack traces and connection strings are masked from client responses.

---

## 8. Geospatial Support Status
- **Standard Coordinates:** All models utilize numeric float WGS84 `latitude` and `longitude` fields, ensuring complete portability across standard PostgreSQL, SQLite, and PostGIS.
- **PostGIS Extension Readiness:** When PostgreSQL with PostGIS is connected, spatial columns (e.g., `geometry(Point, 4326)`) and GiST spatial indexes can be seamlessly generated or mapped via GeoAlchemy2.
- **Portability:** The backend runs reliably without crashing or failing if PostGIS is not yet installed or configured on the host machine.

---

## 9. Files Created and Modified

### Files Created
- `backend/app/core/database.py`: Centralized SQLAlchemy engine, session factory, `get_db`, and `check_db_health`.
- `backend/app/models/__init__.py`: Models package exporter.
- `backend/app/models/location.py`: `MonitoredLocation` SQLAlchemy model.
- `backend/app/models/observation.py`: `EnvironmentalObservation` SQLAlchemy model.
- `backend/app/models/incident.py`: `IncidentReport` SQLAlchemy model.
- `backend/app/models/road.py`: `RoadSegment` SQLAlchemy model.
- `backend/app/models/risk_assessment.py`: `RiskAssessment` SQLAlchemy model.
- `backend/app/models/alert.py`: `Alert` SQLAlchemy model.
- `backend/app/models/user.py`: `User` SQLAlchemy model.
- `backend/app/schemas/common.py`: `PaginatedResponse` and `DatabaseHealthResponse` schemas.
- `backend/app/schemas/location.py`: Location Pydantic schemas.
- `backend/app/schemas/observation.py`: Observation Pydantic schemas.
- `backend/app/schemas/incident.py`: Incident Pydantic schemas.
- `backend/app/schemas/road.py`: Road Pydantic schemas.
- `backend/app/schemas/risk_assessment.py`: Risk assessment Pydantic schemas.
- `backend/app/schemas/alert.py`: Alert Pydantic schemas.
- `backend/app/api/v1/endpoints/locations.py`: Location CRUD endpoints.
- `backend/app/api/v1/endpoints/observations.py`: Observation endpoints.
- `backend/app/api/v1/endpoints/incidents.py`: Incident endpoints.
- `backend/app/api/v1/endpoints/roads.py`: Road corridor endpoints.
- `backend/app/api/v1/endpoints/risk_assessments.py`: Risk assessment endpoints.
- `backend/app/api/v1/endpoints/alerts.py`: Alert endpoints.
- `backend/scripts/__init__.py` & `backend/scripts/seed_demo_data.py`: Explicit, labeled demonstration seed script.
- `backend/alembic.ini`: Alembic migration configuration.
- `backend/alembic/env.py`: Dynamic Alembic migration environment script.
- `backend/alembic/script.py.mako`: Migration template.
- `backend/alembic/versions/a2e2406c1fcf_initial_schema.py`: Initial schema migration.
- `backend/tests/test_locations.py`: Location endpoint and validation tests.
- `backend/tests/test_observations.py`: Observation endpoint and foreign-key tests.
- `backend/tests/test_incidents.py`: Incident status transition and validation tests.
- `backend/tests/test_roads.py`: Road corridor endpoint tests.
- `backend/tests/test_risk_assessments_and_alerts.py`: Assessment and alert retrieval tests.
- `backend/tests/test_database_health.py`: Database diagnostic health tests.
- `docs/phase-reports/PHASE-3-REPORT.md`: This comprehensive sign-off document.

### Files Modified
- `backend/requirements.txt`: Added `sqlalchemy`, `alembic`, and `psycopg2-binary`.
- `backend/app/core/config.py`: Added `DATABASE_URL` and `CURRENT_PHASE` update.
- `backend/app/main.py`: Added lifespan table creation handler and updated CORS methods (`PATCH`, `DELETE`).
- `backend/app/schemas/__init__.py`: Exported new schemas.
- `backend/app/api/v1/endpoints/health.py`: Added `/api/v1/health/db` endpoint.
- `backend/app/api/v1/router.py`: Registered all Phase 3 endpoints under `/api/v1`.
- `backend/tests/conftest.py`: Configured isolated in-memory test database fixture.
- `.env.example`: Added safe `DATABASE_URL` placeholder.
- `.gitignore`: Added `*.db`, `*.sqlite`, `*.sqlite3` exclusion rules.
- `docs/PROJECT-PROGRESS.md`: Updated project tracking status.

---

## 10. Commands Executed

```powershell
# 1. Dependency Installation
.\backend\.venv\Scripts\pip install -r .\backend\requirements.txt

# 2. Alembic Migration Generation & Execution
cd backend
.\.venv\Scripts\alembic init alembic
.\.venv\Scripts\alembic revision --autogenerate -m "initial_schema"
.\.venv\Scripts\alembic upgrade head

# 3. Automated Test Suite Execution
cd ..
.\backend\.venv\Scripts\pytest .\backend

# 4. Frontend Regression Build
cd frontend
npm run build

# 5. Live Server Handshake Verification
cd ..\backend
.\.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/health"
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/health/db"
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/locations"
```

---

## 11. Test Results
- **Command:** `.\backend\.venv\Scripts\pytest .\backend`
- **Total Tests:** 24
- **Passed:** 24 (100% success rate)
- **Failed:** 0
- **Duration:** 3.45 seconds
- **Summary of Tests Passed:**
  - `test_root_endpoint`: **PASS** (Phase 1 preserved)
  - `test_health_endpoint`: **PASS** (Phase 1 preserved)
  - `test_info_endpoint`: **PASS** (Phase 1 preserved)
  - `test_database_health_endpoint_healthy`: **PASS**
  - `test_database_health_endpoint_unavailable`: **PASS**
  - `test_existing_health_check_preserved`: **PASS**
  - `test_create_and_get_location`: **PASS**
  - `test_duplicate_location_conflict`: **PASS**
  - `test_invalid_coordinates_validation`: **PASS**
  - `test_location_pagination_and_filter`: **PASS**
  - `test_update_and_delete_location`: **PASS**
  - `test_create_and_get_observation`: **PASS**
  - `test_observation_nonexistent_location`: **PASS**
  - `test_foreign_key_delete_protection`: **PASS**
  - `test_observation_filtering_and_pagination`: **PASS**
  - `test_create_and_update_incident`: **PASS**
  - `test_incident_invalid_location`: **PASS**
  - `test_incident_filtering_by_status`: **PASS**
  - `test_incident_invalid_category`: **PASS**
  - `test_create_and_get_road`: **PASS**
  - `test_list_roads_with_status_filter`: **PASS**
  - `test_road_not_found`: **PASS**
  - `test_risk_assessments_endpoints`: **PASS**
  - `test_alerts_endpoints`: **PASS**

---

## 12. Migration Verification
- Alembic migration `a2e2406c1fcf_initial_schema.py` was applied using `alembic upgrade head`.
- **Target Engine:** PostgreSQL 15.15 (`landslideguard_db`).
- **Migration Context:** `PostgresqlImpl` with transactional DDL.
- **Table Verification:** Verified all 8 tables present in `landslideguard_db`:
  - `alembic_version` (1 column)
  - `monitored_locations` (11 columns)
  - `environmental_observations` (9 columns)
  - `incident_reports` (11 columns)
  - `road_segments` (10 columns)
  - `risk_assessments` (9 columns)
  - `alerts` (9 columns)
  - `users` (7 columns)

---

## 13. PostgreSQL/PostGIS Verification Status
- **Service Verification:** PostgreSQL 15.15 is active and running locally on `localhost:5432` as Windows service `postgresql-x64-15`.
- **Security & Authentication:** Verified `C:\Program Files\PostgreSQL\15\data\pg_hba.conf` strictly enforces `scram-sha-256` password authentication for all local connections; zero temporary `trust` rules exist.
- **Dedicated Application Role & Database:** Configured and connected using role `landslideguard_app` against dedicated database `landslideguard_db`.
- **Credential Storage:** Stored exclusively in local `C:\Users\Lenovo\Downloads\landslideguard\.env` (verified excluded from Git tracking via `.gitignore`). Credentials are never logged, printed, or committed.
- **Dialect & Health Verification:** Verified via `GET /api/v1/health/db` responding HTTP 200 with `{"status": "healthy", "database_status": "connected", "dialect": "postgresql", "database_available": true}`.
- **Live CRUD Verification:** Executed live against PostgreSQL:
  - `POST /api/v1/locations`: Created `[VERIFICATION-TEST] Gangtok Ridge PG Verification` (HTTP 201).
  - `GET /api/v1/locations/{id}`: Retrieved and verified attributes (HTTP 200).
  - `PATCH /api/v1/locations/{id}`: Updated elevation and status (HTTP 200).
  - `DELETE /api/v1/locations/{id}`: Deleted test record safely (HTTP 204).
  - `GET /api/v1/locations/{id}`: Confirmed 404 NOT FOUND; remaining locations in database: 0.

---

## 14. Frontend Regression Checks
- **Command:** `npm run build` (in `frontend/`)
- **Outcome:** **PASS** (`✓ 1497 modules transformed. Built in 8.06s` with zero TypeScript errors).
- **Runtime Integrity:** Phase 2 application shell, navigation drawer, stat cards, and health handshake remain fully operational.

---

## 15. Known Issues
- **None**: All 24 backend tests passed, Alembic migrations applied cleanly to PostgreSQL `landslideguard_db`, live CRUD verified, and frontend builds without error.

---

## 16. Run Instructions

### Starting the Backend API
```powershell
cd C:\Users\Lenovo\Downloads\landslideguard\backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
- Root API: `http://127.0.0.1:8000/`
- Health: `http://127.0.0.1:8000/api/v1/health`
- Database Health: `http://127.0.0.1:8000/api/v1/health/db`
- Interactive OpenAPI Docs: `http://127.0.0.1:8000/docs`

### Applying Alembic Migrations
```powershell
cd C:\Users\Lenovo\Downloads\landslideguard\backend
.\.venv\Scripts\Activate.ps1
alembic upgrade head
```

### Seeding Optional Demonstration Records (Optional & Non-Destructive)
```powershell
cd C:\Users\Lenovo\Downloads\landslideguard\backend
.\.venv\Scripts\Activate.ps1
python -m scripts.seed_demo_data
```

### Starting the Frontend Client
```powershell
cd C:\Users\Lenovo\Downloads\landslideguard\frontend
npm run dev
```
- Available at: `http://127.0.0.1:5173`

---

## 17. Outstanding Dependencies
- **Phase 4 Telemetry Ingestion:** IMD API clients and automated precipitation ingest pipeline scheduled for Phase 4.

---

## 18. Final Phase Status
**COMPLETED AND VERIFIED**

All Phase 3 requirements — PostgreSQL 15 integration on `landslideguard_db`, centralized SQLAlchemy 2.x engine, session factory, 7 relational models, Alembic migrations, 12 CRUD endpoints, 24 passing unit tests, live PostgreSQL CRUD verification, and frontend regression checks — have been implemented and verified.
