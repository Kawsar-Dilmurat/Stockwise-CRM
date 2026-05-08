# Stockwise — Inventory Management with AI Restock Insights

Stockwise is a lightweight inventory management web app for small businesses. It tracks products, sales and restocks, flags items that need reordering using transparent rule-based metrics, and translates those metrics into natural-language restock recommendations through a pluggable AI layer.

![Stockwise dashboard — KPIs, AI restock summary, low-stock list](docs/screenshots/dashboard.png)

## What problem it solves

Small shops and side-business operators often juggle inventory in spreadsheets or by memory. Stockwise replaces that with a simple, structured workflow:

- every **outbound** movement (sale) is logged and decreases stock,
- every **inbound** movement (restock) is logged, optionally linked to a supplier, and increases stock,
- the system continuously computes reorder signals (days-of-cover, urgency tier, suggested quantity), and
- the AI layer turns those signals into short, readable restock advice — the AI layer turns those signals into short, readable restock advice.

No forecasting black boxes, no procurement workflows — just a clean, explainable loop.

## Core features

- **Products** — CRUD with name, SKU (unique), category, stock quantity, reorder threshold.
- **Sales (stock-out)** — recording a sale automatically decrements stock and rejects the request when stock is insufficient.
- **Restocks (stock-in)** — recording a restock automatically increments stock, with an optional note and an optional supplier link; filter the history by supplier.
- **Suppliers** — minimal directory (name + optional contact) so you can tag each restock with who supplied it. Includes a `top suppliers` aggregation used on the dashboard.
- **Rule-based insights** — for every product the backend computes: 7-day sales, average daily sales, estimated days of stock left, reorder flag, suggested reorder qty (~14 days of cover) and a structured `urgency` tier (`HEALTHY` / `WATCH` / `LOW` / `MODERATE` / `HIGH` / `CRITICAL`).
- **AI restock narration** — per-product recommendations and a daily briefing, produced by an `AIProvider` interface (mock implementation ships by default; swap in any LLM by adding one subclass).
- **Health endpoint** — `GET /api/health` verifies database connectivity.
- **Demo data** — 8 products, a week of randomised sales and a few seeded restocks + 3 sample suppliers so the dashboard is useful on first run.

> **Note on AI:** Stockwise uses *rule-based metrics + AI narration*, not ML forecasting. All numeric decisions happen in `inventory_service.py`; the AI layer only turns those structured numbers into readable text. This keeps recommendations explainable and safe.

## Screenshots

| AI Insights | Record Restock |
|---|---|
| ![AI Insights — per-product cards with urgency tier and natural-language recommendations](docs/screenshots/insights.png) | ![Record Restock — supplier-aware stock-in form with filterable history](docs/screenshots/restock.png) |

## Tech stack

- **Backend:** Python 3.11, FastAPI, SQLAlchemy 2.0 (async), asyncpg, Pydantic v2
- **Database:** PostgreSQL 15
- **Frontend:** React 19, Tailwind CSS, shadcn/ui, axios, React Router
- **Containerisation:** Docker + docker-compose

## Architecture summary

```
  Frontend (React + shadcn/ui)
          │  JSON over HTTPS
          ▼
  FastAPI  ──►  /api/products       (CRUD)
                /api/sales          (stock-out)
                /api/restocks       (stock-in, optional supplier)
                /api/suppliers      (directory + top-suppliers aggregation)
                /api/insights/...   (rule-based metrics + AI narration)
                /api/health
          │
          ▼
  inventory_service.py   → calculates days-of-cover, urgency tier, reorder qty
  ai_service.py          → AIProvider interface + MockAIProvider (swappable)
          │
          ▼
  PostgreSQL
    products   1──N  sales
    products   1──N  restocks   N──1  suppliers
```

Layered cleanly: routes → services → models. Numbers live in services, narration lives in the AI layer, persistence lives in models.

## Project structure

```
.
├── backend/
│   ├── app/
│   │   ├── db/session.py            # async engine + session factory
│   │   ├── models/                  # SQLAlchemy models (Product, Sale, Restock, Supplier)
│   │   ├── schemas/                 # Pydantic schemas
│   │   ├── routes/                  # FastAPI route modules
│   │   ├── services/
│   │   │   ├── inventory_service.py # rule-based math
│   │   │   └── ai_service.py        # AIProvider interface + MockAIProvider
│   │   └── utils/seed.py            # demo data seeder
│   ├── server.py                    # FastAPI entrypoint
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
├── frontend/                        # React app (Dashboard, Products, Sale, Restock, Suppliers, AI Insights)
├── docker-compose.yml               # postgres + backend
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
| DELETE | `/api/products/{id}`                    | Delete a product (cascades sales)        |
| GET    | `/api/sales`                            | List recent sales                        |
| POST   | `/api/sales`                            | Record a sale (auto-decrements stock)    |
| GET    | `/api/sales/product/{id}`               | Sales for one product                    |
| GET    | `/api/restocks?supplier_id=N`           | List restocks, optional supplier filter  |
| POST   | `/api/restocks`                         | Record a restock (auto-increments stock) |
| GET    | `/api/restocks/product/{id}`            | Restocks for one product                 |
| GET    | `/api/suppliers`                        | List suppliers                           |
| POST   | `/api/suppliers`                        | Create a supplier                        |
| GET    | `/api/suppliers/{id}`                   | Get one supplier                         |
| PUT    | `/api/suppliers/{id}`                   | Update a supplier                        |
| DELETE | `/api/suppliers/{id}`                   | Delete a supplier (restock history kept) |
| GET    | `/api/suppliers/top?limit=N`            | Top suppliers by total units supplied    |
| GET    | `/api/insights/all`                     | Insights for every product               |
| GET    | `/api/insights/low-stock`               | Items flagged for reorder                |
| GET    | `/api/insights/product/{id}`            | Insight for one product                  |
| POST   | `/api/insights/product/{id}/ai-summary` | AI restock recommendation per product    |
| POST   | `/api/insights/daily-ai-summary`        | AI daily low-stock summary               |

## How the AI insight feature works

1. **Rule-based math first.** `inventory_service.compute_product_insight()` calculates:
   - `recent_7_day_sales` — sum of `quantity` from `sales` table over last 7 days
   - `avg_daily_sales` = `recent_7_day_sales / 7`
   - `estimated_days_left` = `stock_qty / avg_daily_sales` (None when divisor is 0)
   - `reorder_flag` = `stock_qty <= reorder_threshold` OR `estimated_days_left <= 5`
   - `suggested_reorder_qty` = `ceil(avg_daily_sales × 14) - stock_qty`, clamped at 0
   - `urgency` ∈ `HEALTHY | WATCH | LOW | MODERATE | HIGH | CRITICAL`

2. **AI narration only.** The structured `ProductInsight` is passed to an `AIProvider`:
   ```python
   provider = get_ai_provider()
   text = provider.restock_recommendation(insight)
   ```
   The provider returns a short natural-language string. The default `MockAIProvider` uses deterministic templated prose — no external calls.

3. **Swapping to a real LLM.** Subclass `AIProvider` in `app/services/ai_service.py`, register it in `get_ai_provider()`, and set `AI_PROVIDER` in `.env`. No route or frontend change required.

## Run locally

### Option A — Docker Compose (recommended)

```bash
docker compose up --build
```

- Backend on http://localhost:8001
- Postgres on `localhost:5432`
- Tables are created automatically on first boot and demo data is seeded when empty.

### Option B — Local dev (no Docker)

Prereqs: Python 3.11, Node 18+, PostgreSQL 15.

```bash
# 1. Database
createdb inventory_db
createuser inventory_user --pwprompt          # password: inventory_pass
psql inventory_db -c "GRANT ALL ON SCHEMA public TO inventory_user;"

# 2. Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                          # edit DATABASE_URL if needed
uvicorn server:app --reload --port 8001

# 3. Frontend
cd frontend
yarn install
cp .env.example .env                          # defaults to http://localhost:8001
yarn start
```

Open http://localhost:3000 in your browser.

### Environment variables

See `backend/.env.example` and `frontend/.env.example`. Both are safe to commit; real `.env` files are gitignored.

## License

MIT.
