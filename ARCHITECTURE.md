# Stockwise — Architecture Overview

---

## 1. System deployment architecture

```text
User Browser
    |
    | HTTPS
    v
┌─────────────────────────────────┐
│   AWS Amplify Hosting           │
│   React 19 SPA                  │
│   Build: npm run build          │
│   Auto-deploy from GitHub main  │
└─────────────────────────────────┘
    |
    | HTTPS REST API calls
    | CORS restricted to Amplify domain
    v
┌─────────────────────────────────┐
│   Render Web Service            │
│   FastAPI + Uvicorn             │
│   Python 3.11                   │
│   Auto-deploy from GitHub main  │
└─────────────────────────────────┘
    |
    | SQLAlchemy 2.0 async / asyncpg
    | postgresql+asyncpg://...
    v
┌─────────────────────────────────┐
│   Neon PostgreSQL               │
│   Managed cloud database        │
│   Separate branches:            │
│     production (live data)      │
│     dev-local  (local dev)      │
└─────────────────────────────────┘
```

CI/CD:

```text
GitHub push → main
    ├── GitHub Actions   (build check, smoke test)
    ├── Amplify          (frontend auto-deploy)
    └── Render           (backend auto-deploy)
```

---

## 2. Backend route structure

All endpoints are prefixed with `/api`.

```text
FastAPI Backend (server.py)
    |
    ├── /api/health              Health check and database connectivity
    |
    ├── Inventory
    │   ├── /api/products        Product CRUD (name, SKU, category, stock, price)
    │   ├── /api/sales           Record sale → stock decreases
    │   ├── /api/restocks        Record restock → stock increases
    │   ├── /api/suppliers       Supplier directory, linked to restocks
    │   └── /api/insights        Rule-based inventory metrics + AI narration
    |
    └── CRM
        ├── /api/customers       Customer profile CRUD (cascade delete)
        ├── /api/leads           Lead / opportunity CRUD + stage update
        ├── /api/activities      Follow-up tasks, mark complete
        └── /api/crm/dashboard   Pipeline KPI aggregation
```

---

## 3. Backend layer structure

```text
Request
    |
    v
routes/          FastAPI route handlers
    |             validates request, calls service or ORM directly
    v
services/        Business logic layer
    |             inventory_service.py — rule-based metrics
    |             ai_service.py        — AIProvider interface
    v
models/          SQLAlchemy ORM models
    |             defines tables and relationships
    v
PostgreSQL
```

The AI layer is separated from the business logic layer:

```text
inventory_service.py
    └── compute_product_insight()
            |
            v
        ProductInsight (structured metrics)
            |
            v
ai_service.py
    └── AIProvider.restock_recommendation(insight)
            |
            ├── MockAIProvider   (default, deterministic, no API key)
            └── [RealLLMProvider can be added here]
```

---

## 4. Data model

### Inventory side

```text
Product
├── id, name, SKU, category, stock_qty, reorder_threshold, unit_price
│
├── Sale (stock-out)
│   └── product_id, quantity_sold, sale_date
│
└── Restock (stock-in)
    ├── product_id, quantity_added, restock_date, notes
    └── supplier_id (optional)
            |
            v
        Supplier
        └── id, name, contact_info
```

### CRM side

```text
Customer
├── id, name, company, email, phone, notes
│
├── Lead (opportunity)
│   ├── id, customer_id, title, stage, source, owner
│   ├── next_follow_up_date, notes
│   ├── Quote fields:
│   │   ├── product_id → Product
│   │   ├── quantity
│   │   ├── discount
│   │   ├── delivery_fee
│   │   └── estimated_value (auto-calculated or manual override)
│   │
│   └── Activity (follow-up tasks)
│       └── id, lead_id, customer_id, type, notes, due_date, completed
│
└── Activity (customer-level)
    └── id, customer_id, type, notes, due_date, completed
```

### Cross-side connection

```text
Product ──────────────────────► Lead
(inventory catalog)              (CRM opportunity)
unit_price, category             product_id, quantity,
                                 discount, delivery_fee,
                                 estimated_value

Quote formula:
estimated_value = (unit_price × quantity − discount) × (1 + tax_rate) + delivery_fee

Tax rates:
  Furniture   → 7.75%
  Appliances  → 8.00%
  Default     → 7.75%

Won lead ──► Mark Won ──► Record Sale ──► stock decreases
```

---

## 5. Frontend structure

```text
frontend/src/
│
├── pages/
│   ├── Dashboard.jsx          Inventory KPIs, low-stock, recent sales
│   ├── Products.jsx           Product catalog CRUD
│   ├── RecordSale.jsx         Sale workflow, stock decrement
│   │                          Accepts prefill from Won opportunity (route state)
│   ├── RecordRestock.jsx      Restock workflow, stock increment
│   ├── Suppliers.jsx          Supplier directory
│   ├── AIInsights.jsx         Rule-based insights + AI narration
│   └── CustomerOrders.jsx     CRM workspace (main page)
│                               ├── Dashboard tab   KPI cards + analytics
│                               ├── Opportunities   Lead pipeline
│                               └── Customers       Customer profiles
│
├── components/
│   ├── CustomerEditModal.jsx  Edit/delete customer profile
│   └── LeadEditModal.jsx      Edit opportunity with full quote builder
│
└── lib/
    └── api.js                 Axios client, all API calls
```

---

## 6. Opportunity lifecycle

```text
Customer inquiry received
    |
    v
Lead created (NEW stage)
    |
    | Stage progression (one step at a time, guided buttons)
    v
NEW ──► CONTACTED ──► QUALIFIED ──► PROPOSAL
                                        |
                              ┌─────────┴──────────┐
                              v                    v
                            WON                  LOST
                              |                    |
                              |              no inventory
                              v                movement
                        Mark Won clicked
                              |
                              | navigate("/sales", { state: { prefill } })
                              v
                       Record Sale page
                       product + quantity pre-filled
                       from opportunity
                              |
                              v
                       User confirms and submits
                              |
                              v
                       POST /api/sales
                       stock_qty decreases
```

---

## 7. Environment configuration

```text
Production

  Frontend (Amplify):
    REACT_APP_BACKEND_URL = https://stockwise-crm-backend.onrender.com

  Backend (Render):
    DATABASE_URL  = postgresql+asyncpg://<neon-production-connection>
    CORS_ORIGINS  = https://main.d28ujyj8pewvmb.amplifyapp.com
    PYTHON_VERSION = 3.11.11

Local development

  Frontend:
    REACT_APP_BACKEND_URL = http://localhost:8001

  Backend:
    DATABASE_URL  = postgresql+asyncpg://<neon-dev-local-connection>
    CORS_ORIGINS  = http://localhost:3000
    PYTHON_VERSION = 3.11.11
```

Local dev uses a separate Neon `dev-local` branch so development activity does not touch production data.

---

## 8. Business logic architecture

### Inventory logic

```text
User action: Record Sale
    |
    ├── Frontend validates: product selected, quantity > 0
    ├── POST /api/sales { product_id, quantity_sold }
    │       |
    │       ├── Backend checks: stock_qty >= quantity_sold
    │       │       └── if not → 400 error, no change
    │       |
    │       └── stock_qty -= quantity_sold
    │           sale record created
    v
User action: Record Restock
    |
    ├── POST /api/restocks { product_id, quantity_added, supplier_id? }
    └── stock_qty += quantity_added
        restock record created, linked to supplier if provided

Inventory insight calculation (per product):
    |
    ├── recent_7_day_sales   = SUM(quantity_sold) WHERE sale_date >= now - 7 days
    ├── avg_daily_sales      = recent_7_day_sales / 7
    ├── estimated_days_left  = stock_qty / avg_daily_sales
    ├── reorder_flag         = stock_qty <= reorder_threshold
    │                          OR estimated_days_left <= 5
    ├── suggested_reorder    = (14 × avg_daily_sales) - stock_qty
    └── urgency_tier         = HEALTHY / WATCH / LOW / MODERATE / HIGH / CRITICAL

AI narration layer:
    ProductInsight (structured) ──► AIProvider.restock_recommendation()
                                         └── readable text for dashboard
```

### CRM logic

```text
Quote calculation (frontend, runs on every field change):
    |
    ├── unit_price       pulled from product catalog
    ├── subtotal         = unit_price × quantity
    ├── taxable          = max(0, subtotal - discount)
    ├── tax_rate         = category match:
    │                        furniture   → 7.75%
    │                        appliances  → 8.00%
    │                        default     → 7.75%
    ├── tax_amount       = taxable × tax_rate
    ├── estimated_value  = taxable + tax_amount + delivery_fee
    └── manual override  → user can type a custom value, auto-calc stops

Stage progression rules:
    |
    ├── Each stage advances one step at a time (no skipping)
    ├── NEW → CONTACTED → QUALIFIED → PROPOSAL → WON / LOST
    ├── Advance button visible on each opportunity row
    └── WON and LOST are terminal stages

Pipeline KPI aggregation (/api/crm/dashboard):
    |
    ├── open_leads           = leads WHERE stage NOT IN (WON, LOST)
    ├── open_estimated_value = SUM(estimated_value) of open leads
    ├── won_value            = SUM(estimated_value) WHERE stage = WON
    ├── lost_value           = SUM(estimated_value) WHERE stage = LOST
    ├── upcoming_follow_ups  = activities WHERE due_date >= today, NOT completed
    └── overdue_follow_ups   = activities WHERE due_date < today, NOT completed

Pending Order Value design decision:
    full estimated value of open opportunities
    (not weighted by win probability — win chance is a stage signal, not a dollar discount)
```

### Inventory and CRM connection points

```text
Product catalog
    │
    ├── used by Record Sale        (stock-out workflow)
    ├── used by Record Restock     (stock-in workflow)
    └── used by Lead quote builder (unit_price, category → tax rate)

Won opportunity
    │
    └── Mark Won
            ├── PUT /api/leads/{id} { stage: "WON" }
            └── navigate to Record Sale
                    prefill: { product_id, quantity }
                        │
                        └── user submits → POST /api/sales
                                → stock_qty decreases

The CRM pipeline and inventory stock are kept separate until
a Won opportunity is explicitly converted into a sale.
A lost or open opportunity never affects stock.
```
