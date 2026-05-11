# Stockwise Deployment Runbook

## Overview

Stockwise is a cloud-deployed inventory management web application for small business inventory workflows.

The application is deployed across three managed runtime services, with GitHub used for source control and CI:

- Frontend: AWS Amplify Hosting
- Backend: Render Web Service
- Database: Neon PostgreSQL
- Source control and CI: GitHub + GitHub Actions

## Production URLs

Frontend:

```text
https://main.d15p1084l9644y.amplifyapp.com
```

Backend:

```text
https://stockwise-backend-p774.onrender.com
```

Health check:

```text
https://stockwise-backend-p774.onrender.com/api/health
```

Expected health check response:

```json
{
  "status": "ok",
  "database": true
}
```

## Deployment Architecture

```text
User Browser
    |
    v
AWS Amplify Hosting
React Frontend
    |
    | REST API requests
    v
Render Web Service
FastAPI Backend
    |
    | SQLAlchemy / asyncpg
    v
Neon PostgreSQL
Managed Database
```

## Environment Variables

### Amplify Frontend

```text
REACT_APP_BACKEND_URL=https://stockwise-backend-p774.onrender.com
```

This value is used by the React frontend to call the Render-hosted FastAPI backend.

### Render Backend

```text
DATABASE_URL=postgresql+asyncpg://...
CORS_ORIGINS=https://main.d15p1084l9644y.amplifyapp.com
```

`DATABASE_URL` connects the FastAPI backend to Neon PostgreSQL.

`CORS_ORIGINS` restricts browser-based API access to the deployed Amplify frontend.

## CI and Smoke Test Workflows

GitHub Actions CI workflow:

```text
.github/workflows/ci.yml
```

The CI workflow runs on:

- Push to `main`
- Pull request to `main`
- Manual trigger using `workflow_dispatch`

Current CI checks:

- Frontend dependency installation
- Frontend production build
- Backend dependency installation
- FastAPI backend import check

Production smoke test workflow:

```text
.github/workflows/smoke-test.yml
```

The smoke test workflow is manually triggered with `workflow_dispatch`.

Current smoke test checks:

- `/api/health`
- `/api/products`

The smoke test is used after deployment or before sharing the live project link to confirm that the deployed backend is reachable and the core product API is responding.

## Production Validation Checklist

After deployment, validate the following:

- Open the frontend URL
- Confirm Dashboard loads inventory metrics
- Confirm Products page lists products
- Confirm Record Sale can submit a sale
- Confirm Record Restock can submit a restock
- Confirm Suppliers page loads supplier records
- Confirm AI Insights page loads low-stock recommendations
- Confirm `/api/health` returns `status: ok` and `database: true`
- Run the manual `Production Smoke Test` workflow in GitHub Actions
- Confirm the smoke test passes for `/api/health` and `/api/products`

## Known Limitation

The backend is hosted on Render Free.

Render Free instances can sleep after inactivity, so the first request may take around 20-50 seconds to respond. After the service wakes up, the application usually responds normally.

## Rollback Notes

If a frontend deployment fails:

1. Check AWS Amplify deployment logs.
2. Verify frontend environment variables.
3. Revert the latest frontend commit if needed.
4. Redeploy the last known working version in Amplify.

If the backend fails:

1. Check Render logs.
2. Verify `DATABASE_URL`.
3. Verify `CORS_ORIGINS`.
4. Open `/api/health`.
5. Revert the latest backend change if needed.

If frontend data does not load:

1. Open browser DevTools Console.
2. Check for CORS errors.
3. Check the Network tab for failed API requests.
4. Verify the Render backend is awake.
5. Confirm `/api/health` is working.
6. Run the manual `Production Smoke Test` workflow to check deployed backend endpoints.

## Current Stable Deployment

The current stable deployment uses:

- AWS Amplify for React frontend hosting
- Render for FastAPI backend hosting
- Neon PostgreSQL for persistent database storage
- GitHub Actions for CI build and dependency checks
- Manual production smoke test workflow for post-deployment API validation
- Environment-based configuration for frontend API routing and backend database connectivity
- Restricted CORS access from the Amplify frontend to the Render backend
