# Stockwise — Sales & Inventory Operations Platform

Stockwise is a full-stack web app for small businesses that need a simple way to manage inventory, sales activity, suppliers, customer inquiries, and sales follow-ups in one place.

The project started as an inventory management system for tracking products, sales, restocks, suppliers, and low-stock alerts. It was later upgraded into a sales and inventory operations platform by adding a Customer Orders workspace, CRM-style customer profiles, lead pipeline tracking, product-based quoting, follow-up tasks, and pipeline KPI reporting.

The goal is not to replace a full ERP system or enterprise CRM. Stockwise is designed as a practical operations dashboard for a small business team that wants to understand:

- what is currently in stock,
- what needs to be reordered,
- which products are selling,
- which customer opportunities are active,
- what follow-ups are due, and
- which quoted deals were won or lost.

---

## Live Deployment

- **Live app:** https://main.d28ujyj8pewvmb.amplifyapp.com
- **Backend API:** https://stockwise-crm-backend.onrender.com
- **Repository:** https://github.com/Kawsar-Dilmurat/Stockwise-CRM

### Deployment stack

- **Frontend:** AWS Amplify Hosting
- **Backend:** Render Web Service
- **Database:** Neon PostgreSQL
- **CORS:** Restricted to the deployed Amplify frontend domain
- **CI/CD:** GitHub Actions, Amplify auto-deploy, Render auto-deploy

> Note: The backend is hosted on Render Free. If the service has been inactive, the first request may take around 20–50 seconds while the instance wakes up. After that, the app usually responds normally.

---

## What problem it solves

Small shops and side-business operators often manage inventory, sales notes, customer interest, and supplier information in separate spreadsheets or scattered notes. That creates several problems:

- inventory counts are easy to lose track of,
- sales and restocks are not always tied to stock movement,
- low-stock items are noticed too late,
- customer inquiries are not connected to actual products,
- quoted opportunities are not tracked before they become real sales, and
- follow-up tasks can be forgotten.

Stockwise gives that workflow a more structured path.

### Inventory operations

- Sales are recorded as outbound stock movements.
- Restocks are recorded as inbound stock movements.
- Suppliers can be linked to restock history.
- Low-stock items are flagged using explainable rules.
- Inventory recommendations are written in plain language.

### Customer sales pipeline

- Customer inquiries are captured before they affect inventory.
- Each inquiry moves through a sales pipeline:
  - New
  - Contacted
  - Qualified
  - Proposal
  - Won
  - Lost
- Product-based quotes calculate estimated deal value from unit price, quantity, discount, and delivery fee.
- Follow-up tasks keep the pipeline moving without a separate task tool.
- Pipeline KPI cards show open value, won value, lost value, and upcoming follow-ups.

---

## Core Features

## 1. Inventory Operations

### Products

Users can create, view, update, and delete products with:

- product name
- SKU
- category
- stock quantity
- reorder threshold
- unit price

The product unit price is also used by the Customer Orders quote form, allowing the CRM side of the app to connect directly to the inventory catalog.

### Sales tracking

Recording a sale automatically decreases product stock. The backend prevents sales when stock is insufficient, helping avoid negative inventory counts.

### Restock tracking

Recording a restock automatically increases product stock. Restocks can also be linked to a supplier and include notes.

### Supplier tracking

The supplier module acts as a lightweight supplier directory. Restock history can be linked to suppliers, and the dashboard can show top suppliers based on restock quantities.

### Rule-based inventory insights

The backend calculates inventory signals such as:

- 7-day sales
- average daily sales
- estimated days left
- reorder flag
- suggested reorder quantity
- urgency tier

This keeps the inventory recommendation logic explainable rather than relying on a black-box forecasting model.

### AI-style restock narration

Stockwise includes an `AIProvider` layer that turns structured inventory metrics into short, readable restock notes.

The default provider is deterministic and does not require an external LLM key. The architecture allows a real LLM provider to be added later without changing the frontend workflow.

---

## 2. Customer Orders & Sales Pipeline

The Customer Orders workspace is the main CRM-style upgrade in this version of Stockwise.

It helps a small business track customer interest before it becomes an actual inventory movement.

### Customer profiles

Customer profiles store customer and company information. They are connected to leads and follow-up activities so the team can see customer context, active opportunities, and order history-like pipeline value in one place.

### Lead pipeline

Each customer inquiry is represented as a lead or sales opportunity.

Supported stages:

| Stage | Meaning |
|---|---|
| New | A new customer inquiry has been received, but no meaningful follow-up has happened yet. |
| Contacted | The customer has been contacted and interest has been confirmed. |
| Qualified | The opportunity looks realistic based on budget, product need, quantity, or timeline. |
| Proposal | A quote or proposal has been sent and the customer is deciding. |
| Won | The customer agreed to purchase. The next step is to record the actual sale so inventory is updated. |
| Lost | The opportunity did not convert. No inventory movement is needed. |

### Product-based quote form

The Customer Orders page includes a quote builder that connects sales opportunities to actual inventory products.

Quote formula:

```text
unit price × quantity - discount + delivery fee
```

The form supports:

- selecting an existing product,
- pulling the unit price from the product catalog,
- entering quantity,
- applying a discount,
- adding a delivery fee,
- auto-calculating estimated value,
- manually overriding the final quote for special cases, and
- automatically adding quote details into the lead notes.

This makes the CRM pipeline more realistic because opportunity value is connected to product pricing instead of being a random manually typed number.

### Follow-up activities

Activities can be attached to customers and leads. They support follow-up tasks, notes, and interactions. Follow-up tasks can be marked complete directly from the Customer Orders workspace.

### Pipeline KPI cards

The Customer Orders page shows key sales pipeline metrics:

- open opportunities
- pending order value
- upcoming follow-ups
- won order value
- lost order value
- total customers

Important design choice:

> Pending Order Value uses the full estimated value of open opportunities. It does not multiply deal value by win probability. Win chance is used as a stage maturity signal, not as the actual dollar value of a potential order.

### Pipeline analytics

The Customer Orders workspace includes visual summary cards for:

- order outcome breakdown
- value by stage
- stage breakdown
- follow-up status
- best-selling products

The Best-Selling Products card uses a rolling 7-day sales window so it matches the Dashboard’s “Sales · last 7 days” metric.

---

## Screenshots

### Customer Orders & Sales Pipeline

| Customer Orders Overview | Customer Orders Workspace |
|---|---|
| ![Customer Orders overview with CRM pipeline KPIs and analytics](docs/screenshots/Customer%20Order_1.png) | ![Customer Orders workspace with opportunities, follow-ups, and customer profiles](docs/screenshots/Customer%20Order_2.png) |

### Inventory Operations

| Record Sale | AI Insights |
|---|---|
| ![Record Sale workflow with product selection and stock-out tracking](docs/screenshots/Record%20Sale.png) | ![AI Insights page with per-product inventory recommendations](docs/screenshots/insights.png) |

---

## Tech Stack

### Frontend

- React 19
- Tailwind CSS
- shadcn/ui
- axios
- React Router

### Backend

- Python 3.11
- FastAPI
- SQLAlchemy 2.0 async
- asyncpg
- Pydantic v2

### Database

- PostgreSQL locally
- Neon PostgreSQL in deployment

### Cloud & DevOps

- AWS Amplify Hosting
- Render Web Service
- Neon PostgreSQL
- Docker
- docker-compose
- GitHub Actions
- Amplify auto-deploy
- Render auto-deploy

---

## Cloud Deployment

Stockwise is deployed as a full-stack cloud application:

```text
User Browser
    |
    v
AWS Amplify Hosting
React Frontend
    |
    | REST API calls
    v
Render Web Service
FastAPI Backend
    |
    | SQLAlchemy / asyncpg
    v
Neon PostgreSQL
Managed Database
```

Production configuration is handled through environment variables.

### Amplify environment variable

```text
REACT_APP_BACKEND_URL=https://stockwise-crm-backend.onrender.com
```

### Render environment variables

```text
DATABASE_URL=postgresql+asyncpg://...
CORS_ORIGINS=https://main.d28ujyj8pewvmb.amplifyapp.com
PYTHON_VERSION=3.11.11
```

The CORS configuration is restricted to the deployed Amplify frontend domain.

---

## Online Smoke Test

The deployed app has been smoke-tested online across:

- Dashboard inventory metrics
- Products page, including unit price display
- Customer Orders page
- Customer Orders KPI cards
- Product-based quote form
- Active opportunities
- Follow-up tasks
- Customer profiles
- Record Sale workflow
- Record Restock workflow
- Suppliers page
- AI Insights page
- Backend health check
- Frontend/backend/database connectivity
- CORS access from Amplify frontend to Render backend

Key backend API checks:

```text
GET /api/health
GET /api/products
GET /api/leads
GET /api/crm/dashboard
```

Expected CRM demo dashboard values after reset:

```text
total_customers = 6
total_leads = 7
open_leads = 4
won_leads = 2
lost_leads = 1
upcoming_follow_ups = 4
overdue_follow_ups = 0
open_estimated_value = 11900
open_weighted_value = 5740
won_value = 6000
lost_value = 650
```

---

## CI/CD and Deployment Checks

This project includes GitHub Actions workflows for basic deployment confidence.

The CI workflow checks:

- frontend dependency installation,
- frontend production build,
- backend dependency installation,
- FastAPI backend import,
- Docker Compose configuration validation,
- backend Docker image build,
- frontend Docker image build.

The smoke test checks deployed backend endpoints such as:

- `/api/health`
- `/api/products`

The goal is to catch obvious build or deployment problems without overcomplicating the project.

---

## Architecture Summary

```text
Frontend (React + shadcn/ui)
        |
        | JSON over HTTPS
        v
FastAPI Backend
        |
        +-- /api/products       Product CRUD with unit_price
        +-- /api/sales          Stock-out workflow
        +-- /api/restocks       Stock-in workflow
        +-- /api/suppliers      Supplier directory and top-supplier aggregation
        +-- /api/insights/...   Rule-based metrics and AI-style narration
        +-- /api/customers      Customer profile management
        +-- /api/leads          Lead pipeline and quote fields
        +-- /api/activities     Follow-up task management
        +-- /api/crm/dashboard  CRM KPI aggregation
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

---

## Data Model Overview

### Inventory side

```text
Product
  ├── Sale
  └── Restock
          └── Supplier
```

Inventory movement logic:

- Sale decreases product stock.
- Restock increases product stock.
- Supplier links to restock history.

### CRM side

```text
Customer
  ├── Lead
  │     └── Activity
  └── Activity
```

CRM logic:

- A customer can have multiple leads.
- A lead represents a potential order or sales opportunity.
- Activities represent notes, interactions, and follow-up tasks.
- Won leads can later become actual sales through the Record Sale workflow.
- Lost leads do not change inventory.

### Product quote connection

```text
Product
  └── Lead
        ├── product_id
        ├── quantity
        ├── discount
        ├── delivery_fee
        └── estimated_value
```

The lead’s `estimated_value` is the final quoted value used by the CRM dashboard aggregation.

---

## Project Structure

```text
.
├── backend/
│   ├── app/
│   │   ├── db/session.py              # async engine + session factory
│   │   ├── models/
│   │   │   ├── product.py             # Product with unit_price
│   │   │   ├── sale.py                # Stock-out records
│   │   │   ├── restock.py             # Stock-in records
│   │   │   ├── supplier.py            # Supplier directory
│   │   │   ├── customer.py            # Customer profile
│   │   │   ├── lead.py                # Lead / opportunity with quote fields
│   │   │   └── activity.py            # Follow-up tasks and notes
│   │   ├── schemas/
│   │   │   └── crm_dashboard.py       # Pipeline KPI schema
│   │   ├── routes/
│   │   │   ├── products.py
│   │   │   ├── sales.py
│   │   │   ├── restocks.py
│   │   │   ├── suppliers.py
│   │   │   ├── customers.py
│   │   │   ├── leads.py
│   │   │   ├── activities.py
│   │   │   ├── crm_dashboard.py
│   │   │   └── insights.py
│   │   ├── services/
│   │   │   ├── inventory_service.py   # rule-based inventory metrics
│   │   │   └── ai_service.py          # AIProvider interface + MockAIProvider
│   │   └── utils/seed.py              # demo data seeder
│   ├── scripts/
│   │   ├── reset_demo_data.py         # inventory demo reset
│   │   └── reset_crm_demo_data.py     # CRM demo reset
│   ├── server.py                      # FastAPI entrypoint
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── lib/
│   │   │   └── api.js                 # frontend API client
│   │   └── pages/
│   │       ├── Dashboard.jsx
│   │       ├── Products.jsx
│   │       ├── RecordSale.jsx
│   │       ├── RecordRestock.jsx
│   │       ├── Suppliers.jsx
│   │       ├── AIInsights.jsx
│   │       └── CustomerOrders.jsx
│   └── package.json
├── docs/
│   └── screenshots/
├── docker-compose.yml
└── README.md
```

---

## API Summary

All endpoints are prefixed with `/api`.

### Health

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check and database connectivity |

### Inventory

| Method | Path | Description |
|---|---|---|
| GET | `/api/products` | List all products |
| POST | `/api/products` | Create a product |
| GET | `/api/products/{id}` | Get one product |
| PUT | `/api/products/{id}` | Update a product |
| DELETE | `/api/products/{id}` | Delete a product |
| GET | `/api/sales` | List recent sales |
| POST | `/api/sales` | Record a sale and decrement stock |
| GET | `/api/sales/product/{id}` | Sales for one product |
| GET | `/api/restocks?supplier_id=N` | List restocks, optional supplier filter |
| POST | `/api/restocks` | Record a restock and increment stock |
| GET | `/api/restocks/product/{id}` | Restocks for one product |
| GET | `/api/suppliers` | List suppliers |
| POST | `/api/suppliers` | Create a supplier |
| GET | `/api/suppliers/{id}` | Get one supplier |
| PUT | `/api/suppliers/{id}` | Update a supplier |
| DELETE | `/api/suppliers/{id}` | Delete a supplier |
| GET | `/api/suppliers/top?limit=N` | Top suppliers by total units supplied |

### Inventory insights

| Method | Path | Description |
|---|---|---|
| GET | `/api/insights/all` | Insights for every product |
| GET | `/api/insights/low-stock` | Items flagged for reorder |
| GET | `/api/insights/product/{id}` | Insight for one product |
| POST | `/api/insights/product/{id}/ai-summary` | AI-style restock note for one product |
| POST | `/api/insights/daily-ai-summary` | Daily low-stock summary |

### CRM / Customer Orders

| Method | Path | Description |
|---|---|---|
| GET | `/api/customers` | List all customers |
| POST | `/api/customers` | Create a customer |
| GET | `/api/customers/{id}` | Get one customer |
| PUT | `/api/customers/{id}` | Update a customer |
| DELETE | `/api/customers/{id}` | Delete a customer |
| GET | `/api/leads` | List all leads |
| POST | `/api/leads` | Create a lead with optional quote fields |
| GET | `/api/leads/{id}` | Get one lead |
| PUT | `/api/leads/{id}` | Update a lead or advance stage |
| DELETE | `/api/leads/{id}` | Delete a lead |
| GET | `/api/leads/customer/{id}` | Leads for one customer |
| GET | `/api/activities` | List all activities |
| POST | `/api/activities` | Create an activity or follow-up task |
| PUT | `/api/activities/{id}/complete` | Mark an activity complete |
| GET | `/api/crm/dashboard` | Pipeline KPI aggregation |

---

## How the Inventory Insight Feature Works

1. **Rule-based metrics first**

   `inventory_service.compute_product_insight()` calculates:

   - recent 7-day sales,
   - average daily sales,
   - estimated days left,
   - reorder flag,
   - suggested reorder quantity, and
   - urgency tier.

2. **Narration second**

   The structured `ProductInsight` is passed to an `AIProvider`:

   ```python
   provider = get_ai_provider()
   text = provider.restock_recommendation(insight)
   ```

   The default `MockAIProvider` returns deterministic text and does not call an external model.

3. **Swappable provider design**

   A real LLM can be added by subclassing `AIProvider` in `app/services/ai_service.py`, registering it in `get_ai_provider()`, and setting the provider through environment configuration.

---

## Demo Data & Reset Scripts

Two scripts in `backend/scripts/` reset demo data on a safe Neon dev branch or local database. They default to dry-run behavior and require explicit guard variables before writing.

### Inventory demo reset

`reset_demo_data.py` resets inventory tables only:

- products
- sales
- restocks
- suppliers

CRM tables are not touched.

```bash
# Dry run
cd backend
python scripts/reset_demo_data.py

# Execute
ALLOW_DEMO_RESET=true python scripts/reset_demo_data.py --execute
```

PowerShell:

```powershell
$env:ALLOW_DEMO_RESET="true"
python scripts/reset_demo_data.py --execute
```

### CRM demo reset

`reset_crm_demo_data.py` resets CRM tables only:

- customers
- leads
- activities

Inventory tables are not touched.

Demo leads are aligned with the current product price model so quote fields produce realistic estimated values.

```bash
# Dry run
cd backend
python scripts/reset_crm_demo_data.py

# Execute
ALLOW_CRM_DEMO_RESET=true python scripts/reset_crm_demo_data.py --execute
```

PowerShell:

```powershell
$env:ALLOW_CRM_DEMO_RESET="true"
python scripts/reset_crm_demo_data.py --execute
```

> Safety note: Neither script should be run against a real production database. The guard variables are intentionally separate so an inventory reset cannot accidentally trigger a CRM reset.

---

## Run Locally

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

Open:

```text
http://localhost:3000
```

---

## Environment Variables

See:

```text
backend/.env.example
frontend/.env.example
```

Real `.env` files should not be committed.

### Backend

```text
DATABASE_URL=postgresql+asyncpg://...
CORS_ORIGINS=http://localhost:3000
PYTHON_VERSION=3.11.11
```

### Frontend

```text
REACT_APP_BACKEND_URL=http://localhost:8001
```

---

## Deployment Notes

This CRM upgrade was deployed as a separate independent version of Stockwise.

Original Stockwise production resources were not modified during this upgrade. The CRM version uses:

- a separate GitHub repository,
- a separate Render backend service,
- a separate AWS Amplify frontend app, and
- a Neon PostgreSQL database branch/project for the CRM version.

This separation made it possible to deploy and test the CRM version safely before replacing the old Stockwise link in the portfolio.

---

## What This Project Demonstrates

- Backend API design with FastAPI
- PostgreSQL data modeling with SQLAlchemy
- Inventory stock-in and stock-out workflows
- CRM-style customer, lead, and activity workflows
- Product-based quote calculation
- Rule-based inventory insight logic
- AI-style summary layer design
- React dashboard UI development
- Cloud deployment with AWS Amplify, Render, and Neon
- Environment-based frontend/backend configuration
- CORS configuration for deployed frontend/backend communication
- CI/CD and deployment safety practices

---

## Future Improvements

- Add authentication and user accounts
- Add role-based access control for sales and inventory users
- Add opportunity item tables for multi-product quotes
- Add a “Convert Won Opportunity to Sale” workflow
- Add CSV export for customer orders and inventory reports
- Add more detailed sales analytics
- Add real LLM provider support for inventory summaries
- Add custom domain for a cleaner production URL

---

## License

MIT
