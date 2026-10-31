# LandslideGuard AI — Cloud Deployment Guide
**Target Platforms:** Render (FastAPI Backend + PostgreSQL Database) & Vercel (React Frontend)  
**Source Repository:** `https://github.com/lakshmiram-codes/LandslideGuard-AI.git`  
**Application Version:** `1.0.0` (Phases 1–8 Production Ready)

---

## 1. Architecture Overview

```
                      +-----------------------------+
                      |   Vercel Edge Network       |
                      |   React 18 + Vite Frontend  |
                      |   https://<app>.vercel.app  |
                      +--------------+--------------+
                                     |
                         HTTPS API   |  CORS Origin
                         Requests    |  Validation
                                     v
                      +-----------------------------+
                      |   Render Web Service        |
                      |   FastAPI + Uvicorn         |
                      |   https://<app>.onrender.com|
                      +--------------+--------------+
                                     |
                       Internal VPC  |  SQLAlchemy 2.0
                       Connection    |  psycopg2-binary
                                     v
                      +-----------------------------+
                      |   Render PostgreSQL 15+     |
                      |   Database: landslideguard  |
                      +-----------------------------+
```

---

## 2. Prerequisites & Accounts

1. **GitHub Repository:** Code pushed to `https://github.com/lakshmiram-codes/LandslideGuard-AI.git` (branch: `main`).
2. **Render Account:** [https://render.com](https://render.com) (free or paid tier).
3. **Vercel Account:** [https://vercel.com](https://vercel.com) (hobby or pro tier).

---

## 3. Step 1: Deploy PostgreSQL on Render

1. Log in to the **Render Dashboard** and click **New +** -> **PostgreSQL**.
2. Configure database fields:
   - **Name:** `landslideguard-db`
   - **Database:** `landslideguard_db`
   - **User:** `landslideguard_app`
   - **Region:** Select a region (e.g. `Singapore`, `Frankfurt`, or `Oregon`). *Note: Keep the same region for both Database and Web Service to eliminate inter-region latency.*
   - **PostgreSQL Version:** `15` or `16`
   - **Plan:** `Free`
3. Click **Create Database**.
4. Once provisioned (status becomes `Available`), scroll to the **Connections** panel and copy the **Internal Database URL** (e.g. `postgres://landslideguard_app:password@dpg-...:5432/landslideguard_db`).

> [!NOTE]
> `backend/app/core/config.py` automatically normalizes `postgres://` connection strings to `postgresql+psycopg2://` for SQLAlchemy 2.0 compatibility.

---

## 4. Step 2: Deploy FastAPI Backend on Render

1. In Render Dashboard, click **New +** -> **Web Service**.
2. Connect your GitHub repository: `https://github.com/lakshmiram-codes/LandslideGuard-AI`.
3. Configure the service settings:
   - **Name:** `landslideguard-backend`
   - **Region:** Same region as your PostgreSQL instance (e.g., `Singapore`).
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Plan:** `Free`
4. Expand **Advanced** -> **Health Check Path** and set:
   - `/api/v1/health`
5. Under **Environment Variables**, add:
   | Key | Value | Description |
   |---|---|---|
   | `PYTHON_VERSION` | `3.11.9` | Locks Python version |
   | `ENVIRONMENT` | `production` | Production mode |
   | `DEBUG` | `false` | Disables verbose debug stack traces |
   | `DATABASE_URL` | `<Internal Database URL>` | Pasted from Step 1 |
   | `CORS_ORIGINS` | `http://localhost:5173` | Temporary until Vercel URL is known |
6. Click **Create Web Service**.
7. Wait for the build and deployment logs to display:
   - `Running migrations... done`
   - `Application startup complete.`
   - Health check returning HTTP 200 on `/api/v1/health`.
8. Copy your backend URL: e.g. `https://landslideguard-backend.onrender.com`.

---

## 5. Step 3: Deploy React Frontend on Vercel

1. Log in to the **Vercel Dashboard** and click **Add New...** -> **Project**.
2. Import the Git repository: `LandslideGuard-AI`.
3. In the configuration screen:
   - **Framework Preset:** `Vite`
   - **Root Directory:** Click **Edit** and select `frontend` (Click Save).
   - **Build Command:** `npm run build` (Default)
   - **Output Directory:** `dist` (Default)
   - **Install Command:** `npm install` (Default)
4. Under **Environment Variables**, add:
   | Key | Value | Description |
   |---|---|---|
   | `VITE_API_BASE_URL` | `https://landslideguard-backend.onrender.com` | Render backend URL (no trailing slash) |
5. Click **Deploy**.
6. Vercel will install dependencies, run TypeScript verification (`tsc`), bundle with Vite, and assign a production URL:
   - e.g. `https://landslideguard-ai.vercel.app`

---

## 6. Step 4: Link CORS & Verify Cross-Origin Communication

1. Return to the **Render Dashboard** -> `landslideguard-backend` -> **Environment**.
2. Update the `CORS_ORIGINS` environment variable to include your Vercel production domain:
   ```env
   CORS_ORIGINS=https://landslideguard-ai.vercel.app,http://localhost:5173
   ```
3. Click **Save Changes**. Render will automatically redeploy the backend with the new CORS policy.

---

## 7. Step 5: Post-Deployment Smoke Test Checklist

| Checkpoint | Target Endpoint / Action | Expected Result |
|---|---|---|
| Backend Root | `GET https://<render-url>/` | HTTP 200 with JSON: `{"status": "running", "version": "1.0.0"}` |
| Health Check | `GET https://<render-url>/api/v1/health` | HTTP 200 with status `"healthy"` and database `"connected"` |
| Interactive Docs | `GET https://<render-url>/docs` | Swagger UI renders all 30+ endpoints |
| Frontend Status Bar | Open `https://<vercel-url>/` in browser | Top-right status pill displays green `"Online"` with database latency |
| GIS Map View | Navigate to **Risk Map** tab | 12 monitored locations and 6 historical markers render with active telemetry |
| Explainable Risk | Click any location (e.g. Wayanad) | Susceptibility factors, rainfall triggers, and safety guard verification displayed |
| Community Reports | Open **Field Reports** tab | Submit an incident report; verify validation, status transitions, and audit records |

---

## 8. Troubleshooting Guide

- **Render Cold Start:** Free-tier instances sleep after 15 minutes of inactivity. Initial request may take 30–50 seconds to spin up.
- **CORS Error in Browser Console:** Ensure `CORS_ORIGINS` on Render contains the exact Vercel URL without a trailing slash (e.g., `https://landslideguard-ai.vercel.app`).
- **Database Connection Failure:** Confirm that `DATABASE_URL` in the Render Web Service uses the **Internal Database URL** provided by the Render PostgreSQL dashboard, not the external one.
- **Frontend 404 on Direct Tab URLs:** `frontend/vercel.json` rewrite routes all non-asset requests to `/index.html`.
