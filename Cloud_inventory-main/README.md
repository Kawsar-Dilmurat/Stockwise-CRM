# Stockwise — Inventory Management with AI Restock Insights

Stockwise is a lightweight inventory management web app for small businesses. It tracks products, sales, restocks, and suppliers in one place, then highlights items that may need attention using simple inventory rules and readable AI-style restock notes.

![Stockwise dashboard — KPIs, AI restock summary, low-stock list](docs/screenshots/dashboard.png)

## What problem it solves

Small shops and side-business operators often manage inventory through spreadsheets, memory, or scattered notes. Stockwise gives that workflow a more structured path:

- sales are recorded as outbound stock movements,
- restocks are recorded as inbound stock movements,
- suppliers can be linked to restock history,
- low-stock items are flagged using explainable rules, and
- restock recommendations are written in plain language so the numbers are easier to act on.

The goal is not to replace a full ERP system. It is a practical inventory dashboard for a small operator who wants to understand what is in stock, what is running low, and what should be reordered next.

## Core features

- **Products** — create, view, update, and delete products with name, SKU, category, stock quantity, and reorder threshold.
- **Sales tracking** — recording a sale automatically decreases stock and prevents sales when stock is insufficient.
- **Restock tracking** — recording a restock automatically increases stock, with optional supplier and note fields.
- **Suppliers** — lightweight supplier directory with top-supplier aggregation based on restock history.
- **Rule-based inventory insights** — the backend calculates 7-day sales, average daily sales, estimated days left, reorder flags, suggested reorder quantity, and urgency tier.
- **AI-style restock narration** — structured inventory metrics are converted into short, readable recommendations through a swappable `AIProvider` layer.
- **Health check** — `/api/health` verifies backend availability and database connectivity.
- **Seed data** — the app includes demo products, sales, restocks, and suppliers so the dashboard is useful immediately after setup.

> **Note on AI:** Stockwise uses rule-based inventory metrics first. The AI layer only turns those structured numbers into readable restock notes. This keeps the recommendation logic easier to inspect and explain.

## Screenshots

| AI Insights | Record Restock |
|---|---|
| ![AI Insights — per-product cards with urgency tier and natural-language recommendations](docs/screenshots/insights.png) | ![Record Restock — supplier-aware stock-in form with filterable history](docs/screenshots/restock.png) |

## Tech stack

- **Frontend:** React 19, Tailwind CSS, shadcn/ui, axios, React Router
- **Backend:** Python 3.11, FastAPI, SQLAlchemy 2.0 async, asyncpg, Pydantic v2
- **Database:** PostgreSQL locally, Neon PostgreSQL in production
- **Cloud deployment:** AWS Amplify Hosting, Render Web Service, Neon PostgreSQL
- **CI/CD:** GitHub Actions, Amplify auto-deploy, Render auto-deploy
- **Containerization:** Docker and docker-compose for local development

## Cloud deployment

Stockwise is deployed as a full-stack cloud application:

```text
User Browser
    |
    v
AWS Amplify Hosting
React Frontend
    |
    | REST API
    v
Render Web Service
FastAPI Backend
    |
    | SQLAlchemy / asyncpg
    v
Neon PostgreSQL
Managed Database
```

The frontend is hosted on AWS Amplify. The backend is hosted as a Render Web Service. The backend connects to a managed Neon PostgreSQL database.

Production configuration is handled through environment variables:

- `REACT_APP_BACKEND_URL` on Amplify points the frontend to the Render backend.
- `DATABASE_URL` on Render connects the backend to Neon PostgreSQL.
- `CORS_ORIGINS` on Render restricts browser API access to the deployed Amplify frontend.

## CI/CD and deployment checks

This project includes GitHub Actions workflows for basic deployment confidence:

- `Stockwise CI` runs frontend build checks and backend dependency/import checks.
- `Production Smoke Test` can be triggered manually to verify deployed API availability.

The CI workflow checks:

- frontend dependency installation,
- frontend production build,
- backend dependency installation,
- FastAPI backend import.

The smoke test checks the deployed backend endpoints:

- `/api/health`
- `/api/products`

This is intentionally lightweight. The goal is to catch obvious build or deployment problems without adding expensive infrastructure or overcomplicating the project.

## Production notes

The backend is currently hosted on Render Free. If the service has been inactive, the first request can take around 20-50 seconds while the instance wakes up. After that, the app usually responds normally.

The production deployment has been validated across:

- Dashboard inventory metrics
- Products page
- Record Sale workflow
- Record Restock workflow
- Suppliers page
- AI Insights page
- Backend health check
- Frontend/backend/database connectivity

A deployment runbook is available at:

```text
../docs/deployment-runbook.md
```

## Architecture summary

```text
Frontend (React + shadcn/ui)
        |
        | JSON over HTTPS
        v
FastAPI Backend
        |
        +-- /api/products       Product CRUD
        +-- /api/sales          Stock-out workflow
        +-- /api/restocks       Stock-in workflow
        +-- /api/suppliers      Supplier directory and top-supplier aggregation
        +-- /api/insights/...   Rule-based metrics and AI-style narration
        +-- /api/health         Health and database check
        |
        v
PostgreSQL
```

The backend follows a simple layered structure:

```text
routes → services → models
```

Inventory calculations live in the service layer. AI narration lives behind the `AIProvider` interface. Persistence is handled through SQLAlchemy models.

## Project structure

```text
.
├── backend/
│   ├── app/
│   │   ├── db/session.py            # async engine + session factory
│   │   ├── models/                  # SQLAlchemy models
│   │   ├── schemas/                 # Pydantic schemas
│   │   ├── routes/                  # FastAPI route modules
│   │   ├── services/
│   │   │   ├── inventory_service.py # rule-based inventory metrics
│   │   │   └── ai_service.py        # AIProvider interface + MockAIProvider
│   │   └── utils/seed.py            # demo data seeder
│   ├── server.py                    # FastAPI entrypoint
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
├── frontend/                        # React app
├── docs/screenshots/                # screenshots used in README
├── docker-compose.yml               # local PostgreSQL + backend
└── README.md
```

## API summary

All endpoints are prefixed with `/api`.

| Method | Path                                    | Description                              |
|--------|-----------------------------------------|------------------------------------------|
| GET    | `/api/health`                           | Health + database check                  |
| GET    | `/api/products`                         | List all products                        |
| POST   | `/api/products`                         | Create a product                         |
| GET    | `/api/products/{id}`                    | Get one product                          |
| PUT    | `/api/products/{id}`                    | Update a product                         |
| DELETE | `/api/products/{id}`                    | Delete a product                         |
| GET    | `/api/sales`                            | List recent sales                        |
| POST   | `/api/sales`                            | Record a sale and decrement stock        |
| GET    | `/api/sales/product/{id}`               | Sales for one product                    |
| GET    | `/api/restocks?supplier_id=N`           | List restocks, optional supplier filter  |
| POST   | `/api/restocks`                         | Record a restock and increment stock     |
| GET    | `/api/restocks/product/{id}`            | Restocks for one product                 |
| GET    | `/api/suppliers`                        | List suppliers                           |
| POST   | `/api/suppliers`                        | Create a supplier                        |
| GET    | `/api/suppliers/{id}`                   | Get one supplier                         |
| PUT    | `/api/suppliers/{id}`                   | Update a supplier                        |
| DELETE | `/api/suppliers/{id}`                   | Delete a supplier                        |
| GET    | `/api/suppliers/top?limit=N`            | Top suppliers by total units supplied    |
| GET    | `/api/insights/all`                     | Insights for every product               |
| GET    | `/api/insights/low-stock`               | Items flagged for reorder                |
| GET    | `/api/insights/product/{id}`            | Insight for one product                  |
| POST   | `/api/insights/product/{id}/ai-summary` | AI-style restock note for one product    |
| POST   | `/api/insights/daily-ai-summary`        | Daily low-stock summary                  |

## How the insight feature works

1. **Rule-based metrics first.** `inventory_service.compute_product_insight()` calculates:
   - `recent_7_day_sales`
   - `avg_daily_sales`
   - `estimated_days_left`
   - `reorder_flag`
   - `suggested_reorder_qty`
   - `urgency`

2. **Narration second.** The structured `ProductInsight` is passed to an `AIProvider`:

   ```python
   provider = get_ai_provider()
   text = provider.restock_recommendation(insight)
   ```

   The default `MockAIProvider` returns deterministic text and does not call an external model.

3. **Swappable provider design.** A real LLM can be added by subclassing `AIProvider` in `app/services/ai_service.py`, registering it in `get_ai_provider()`, and setting the provider through environment configuration.

## Run locally

### Option A — Docker Compose

```bash
docker compose up --build
```

- Backend: http://localhost:8001
- PostgreSQL: localhost:5432
- Tables are created automatically on startup.
- Demo data is seeded when the database is empty.

### Option B — Local development without Docker

Prerequisites:

- Python 3.11
- Node 18+
- PostgreSQL 15

```bash
# 1. Database
createdb inventory_db
createuser inventory_user --pwprompt
psql inventory_db -c "GRANT ALL ON SCHEMA public TO inventory_user;"

# 2. Backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn server:app --reload --port 8001

# 3. Frontend
cd ../frontend
npm install
cp .env.example .env
npm start
```

Open http://localhost:3000 in your browser.

## Environment variables

See:

```text
backend/.env.example
frontend/.env.example
```

Real `.env` files should not be committed.

## License

MIT
