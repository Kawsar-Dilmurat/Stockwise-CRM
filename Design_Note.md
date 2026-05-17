# Stockwise Design Note

**Author:** Dilimulati Kaiwusaier  
**Project:** Stockwise / Stockwise-CRM  
**Current positioning:** Sales & Inventory Operations Platform  
**Purpose of this note:** Explain the design decisions, business logic, technical choices, and upgrade path behind Stockwise from the original inventory system to the current CRM-enhanced version.

---

## 1. Why I built Stockwise

I started Stockwise because I wanted to build a project that was more than a simple CRUD app. I wanted something that looked like a real operational tool: a small business should be able to open it, understand what is happening with inventory, and take action.

The original idea was an inventory management system for a small shop or side business. Many small operators manage stock through spreadsheets, memory, or scattered notes. That creates several problems:

- product counts are easy to lose track of;
- sales and restocks are not always recorded as inventory movements;
- low-stock items are noticed too late;
- supplier information is not connected to restock history;
- business owners may see numbers but still not know what action to take next.

So the first version of Stockwise focused on a simple loop:

```text
Product catalog → Record sale → Stock decreases
Product catalog → Record restock → Stock increases
Sales/restocks → Inventory insights → Reorder decision
```

I did not want to build a fake enterprise ERP system. I wanted a practical dashboard that could make sense for a small business and still demonstrate backend, database, cloud, and workflow design.

---

## 2. Original product scope

The first version of Stockwise had four main business modules:

### Products

The product catalog stored basic product information:

- product name;
- SKU;
- category;
- stock quantity;
- reorder threshold.

This gave the rest of the system a clear inventory object to work around.

### Sales

Sales were designed as stock-out events. When a sale is recorded, product stock decreases.

This was an important business rule because I wanted inventory movement to happen through workflows, not by manually editing numbers.

### Restocks

Restocks were designed as stock-in events. When a restock is recorded, product stock increases.

Restocks also support notes and supplier connection, so the system can explain not only that inventory increased, but also where the product came from.

### Suppliers

Suppliers were added as a lightweight directory instead of a full procurement system. The goal was not to build purchasing approval workflows. The goal was to let restock history be tied to a supplier, so the dashboard could show supplier-related information and make restock records more meaningful.

---

## 3. Inventory logic design decisions

The most important design choice in the original Stockwise system was this:

> I kept the inventory recommendation logic rule-based and explainable.

I intentionally did not make the system pretend to use machine learning forecasting. For a small business inventory project, a transparent rule engine is easier to trust and easier to explain in an interview.

The backend calculates inventory signals such as:

- recent 7-day sales;
- average daily sales;
- estimated days left;
- reorder flag;
- suggested reorder quantity;
- urgency tier.

The basic logic is:

```text
recent_7_day_sales = total quantity sold in the last 7 days
avg_daily_sales = recent_7_day_sales / 7
estimated_days_left = stock_qty / avg_daily_sales
reorder_flag = stock_qty <= reorder_threshold OR estimated_days_left <= 5
suggested_reorder_qty = enough stock for roughly 14 days of cover
```

I chose this approach because the output can be explained line by line. If a product is marked low stock, I can trace the reason back to actual stock level, reorder threshold, and recent sales activity.

This is also why I used urgency tiers such as:

```text
HEALTHY / WATCH / LOW / MODERATE / HIGH / CRITICAL
```

Those labels make the dashboard easier to read. A non-technical user does not need to inspect every formula; they can quickly see what needs attention.

---

## 4. AI layer design decision

I added an AI-style restock summary, but I kept the AI layer separate from the actual business logic.

The design principle was:

> The rules calculate the numbers. The AI layer only explains the numbers.

That means the app does not rely on an LLM to decide whether stock is low or whether a product should be reordered. The rule engine makes those decisions. The AI provider layer turns structured metrics into readable text.

I used an `AIProvider` style design because it keeps the system flexible:

```text
inventory_service.py → calculates metrics
ai_service.py        → turns metrics into readable recommendations
```

The default provider can be deterministic for demo and local development. Later, a real OpenAI-compatible provider could be added without rewriting the frontend or the route structure.

This decision helped me show AI-assisted application design without making the project fragile or dependent on an API key.

---

## 5. Backend technology decisions

### Why FastAPI

I chose FastAPI because it fits the kind of project I was trying to build:

- Python is easier for me to work with and explain;
- FastAPI is clean for REST API development;
- Pydantic schemas make request/response validation clearer;
- the automatic API docs are helpful for testing and demonstration;
- it is lightweight enough for a portfolio project but still realistic.

FastAPI also helped me build the project in a structured way, with route modules for products, sales, restocks, suppliers, insights, and later CRM features.

### Why SQLAlchemy

I used SQLAlchemy because I wanted the backend to use a real relational data model rather than just JSON files or in-memory storage.

The project has relationships such as:

```text
Product → Sales
Product → Restocks
Supplier → Restocks
Customer → Leads
Customer → Activities
Lead → Activities
Product → Lead quote
```

SQLAlchemy makes those relationships explicit and gives the backend more credibility than a simple mock database.

### Why PostgreSQL

I chose PostgreSQL because it is a real production-style relational database and works well with backend-heavy projects.

The business logic in Stockwise is relational:

- products have many sales;
- products have many restocks;
- suppliers connect to restocks;
- customers connect to leads;
- leads connect to activities.

Using PostgreSQL made the project feel closer to a real operations system.

---

## 6. Frontend and dashboard decisions

For the frontend, I used React with a dashboard-style interface because the project is about operational visibility.

The design goal was not to make a flashy landing page. The goal was to create a clear workspace where a user can see:

- current inventory status;
- low-stock items;
- sales activity;
- supplier/restock history;
- AI-style inventory notes;
- customer order pipeline;
- follow-up tasks.

I used a sidebar navigation structure because it matches how business tools are usually organized:

```text
Dashboard
Products
Record Sale
Customer Orders
Record Restock
Suppliers
AI Insights
```

This makes the application easy to demo because each page maps to one business function.

---

## 7. Cloud deployment decisions

I deployed the app as a real full-stack cloud application:

```text
React frontend → AWS Amplify
FastAPI backend → Render
PostgreSQL database → Neon
```

### Why AWS Amplify for the frontend

I chose AWS Amplify because it is simple and reliable for hosting a React frontend. It connects to GitHub, builds automatically, and gives the project a real public URL.

For my current goal, I did not need to overcomplicate frontend hosting. Amplify gave me a clean cloud-hosted React deployment without needing to manage EC2 or Nginx manually.

### Why Render for the backend

I chose Render for the FastAPI backend because it was faster and lower-risk than setting up a full AWS backend stack from scratch.

This was a practical decision. My goal was to get a working deployed backend with environment variables, database connection, and public API access. Render let me focus on the backend application instead of spending too much time on infrastructure troubleshooting.

### Why Neon PostgreSQL

I chose Neon because it provides managed PostgreSQL with a simple connection string and works well for deployment. It let me use a real cloud database without managing an RDS instance or paying for heavier AWS resources.

This was also a cost-control decision. I wanted the project to demonstrate cloud deployment without creating unnecessary billing risk.

### Why environment variables

I used environment variables for deployment configuration:

```text
REACT_APP_BACKEND_URL
DATABASE_URL
CORS_ORIGINS
PYTHON_VERSION
```

This made the same codebase work across local development and production. It also made deployment configuration clearer and safer than hardcoding URLs or database credentials into the code.

---

## 7b. Architecture diagrams

### System deployment architecture

User Browser
    |
    v
AWS Amplify Hosting
React Frontend
    |
    | HTTPS REST API
    v
Render Web Service
FastAPI Backend
    |
    | SQLAlchemy / asyncpg
    v
Neon PostgreSQL
Managed Database

### Business data flow

**Inventory side**

```text
Product catalog
    |
    ├── Record Sale
    │   └── stock decreases
    │
    └── Record Restock
        └── stock increases
```

**CRM side**

```text
Customer profile
    |
    └── Lead / Opportunity
            ├── Quote (product, qty, discount, delivery fee, tax, estimated value)
            ├── Follow-up activities
            └── Stage progression
                NEW → CONTACTED → QUALIFIED → PROPOSAL → WON / LOST
```

**Connection point:**

```text
Lead (Won) ──► Record Sale ──► stock decreases
```
### Opportunity lifecycle

```text
New inquiry
    |
    v
NEW ──► CONTACTED ──► QUALIFIED ──► PROPOSAL
                                        |
                              ┌─────────┴─────────┐
                              v                   v
                             WON                LOST
                              |                   |
                              v                no inventory
                        Mark Won button          movement
                              |
                              v
                       Record Sale page
                       (product + qty pre-filled)
                              |
                              v
                       Stock decreases
```

                       
## 8. CORS and deployment safety decisions

When I deployed the frontend and backend separately, CORS became important.

At first, it is easy to use:

```text
CORS_ORIGINS=*
```

But I did not want to leave the final deployment wide open. After the frontend was deployed on Amplify and the backend was stable on Render, I restricted CORS to the exact Amplify frontend domain.

The final idea was:

```text
Only the deployed frontend should call the deployed backend from the browser.
```

This was a small but important cloud/backend deployment detail because it shows I understand that production configuration should be tighter than local development configuration.

---

## 9. CI/CD and containerization decisions

After the first deployment worked, I added more DevOps-adjacent improvements:

- GitHub Actions CI;
- frontend build check;
- backend dependency/import check;
- Docker build checks;
- docker-compose support;
- production smoke test.

The purpose was not to claim that I built enterprise-scale DevOps. The purpose was to make the project safer and more professional.

The GitHub Actions checks help catch obvious problems before deployment. The Docker checks show that the frontend and backend can be containerized and validated. The smoke test checks whether deployed backend endpoints like `/api/health` and `/api/products` are responding.

I kept the CI/CD lightweight because this is still a portfolio project. I wanted enough automation to show deployment discipline without making the project too complex.

---

## 10. Why I upgraded Stockwise into Stockwise-CRM

Later, I decided to upgrade Stockwise instead of starting a totally new project.

The reason was job positioning. I wanted Stockwise to better match roles that involve CRM, sales operations, customer workflow, backend systems, and business-facing platforms.

The original Stockwise was already a deployed inventory system. Rather than creating a separate unrelated CRM app, I extended it into a more complete business operations platform.

The upgraded positioning became:

```text
Stockwise — Sales & Inventory Operations Platform
```

This made more sense than calling it only an inventory app. A small furniture or appliance business does not only care about inventory. It also cares about customer inquiries, quoted deals, follow-ups, and whether a potential order becomes a real sale.

---

## 11. CRM business model decisions

The CRM upgrade added three core models:

```text
Customer
Lead
Activity
```

### Customer

A customer represents the person or business making an inquiry.

### Lead

A lead represents a potential order or sales opportunity.

I chose this model because not every customer inquiry should immediately change inventory. A customer may ask about a sofa, request a quote, or need follow-up before buying.

So the lead pipeline sits before actual stock movement.

### Activity

An activity represents notes, interactions, and follow-up tasks.

I added activities because a CRM workflow is not only about storing customers. It also needs to track what the sales team should do next.

The relationship became:

```text
Customer → Leads
Customer → Activities
Lead → Activities
```

This made the workflow more realistic without building a large enterprise CRM.

---

## 12. Lead stage decisions

I used six lead stages:

```text
New
Contacted
Qualified
Proposal
Won
Lost
```

The meaning is:

- **New**: the inquiry exists but no real follow-up has happened yet;
- **Contacted**: someone reached out and confirmed interest;
- **Qualified**: the opportunity looks realistic based on budget, product need, quantity, or timeline;
- **Proposal**: a quote or proposal was sent;
- **Won**: the customer agreed to buy;
- **Lost**: the opportunity did not convert.

I chose these stages because they are simple enough for a small business demo but still realistic for a sales pipeline.

The key business decision was:

> Marking a lead as Won does not automatically decrease inventory.

That is intentional. A won opportunity means the customer agreed to buy. Inventory should only decrease when the actual sale is recorded through the Record Sale workflow.

This keeps the business process clean:

```text
Customer Inquiry → Lead Pipeline → Mark Won → Record Sale → Inventory decreases
```

If a lead is Lost, inventory does not change.

---

## 13. Quote builder decision

One of the biggest CRM improvements was the product-based quote form.

Originally, a lead could have an estimated value, but that number could feel arbitrary. I wanted the opportunity value to come from the product catalog.

So I added quote fields such as:

```text
product_id
quantity
discount
delivery_fee
estimated_value
```

The basic formula is:

```text
(unit price × quantity) * tax rate - discount + delivery fee
```

This helped connect CRM and inventory:

```text
Product catalog → Unit price → Quote form → Lead estimated value → CRM dashboard
```

I also kept manual override support because real business quotes are not always simple. A business may add delivery, installation, bundle pricing, or a special discount.

The final design was:

- auto-calculate the quote when possible;
- allow override when the business case needs it;
- keep final `estimated_value` as the value used by the dashboard.

That made the system both practical and explainable.

---

## 14. Pipeline value decision

At one point, I considered weighted expected value:

```text
estimated_value × win_probability
```

But I decided not to use weighted value as the main business value because it felt unnatural for this type of small business workflow.

If a customer asks for a $10,000 sofa order, the actual pending order value is $10,000. It does not feel right to show it as $2,500 just because the current stage has a 25% chance.

So the dashboard uses:

```text
Pending Order Value = full estimated value of open opportunities
```

Win chance is still useful as a stage maturity signal, but it is not the main dollar amount.

This was an important product decision because it made the CRM dashboard easier to understand for a non-technical business user.

---

## 15. Pipeline analytics decision

I added pipeline analytics to make the Customer Orders page more useful as a dashboard, not just a form.

The analytics include:

- order outcome breakdown;
- value by stage;
- stage breakdown;
- follow-up status;
- best-selling products.

The Best-Selling Products card uses a rolling 7-day sales window. I made that decision because the main Dashboard also uses recent sales metrics. If one card used all-time sales and another used last 7 days, the demo would feel inconsistent.

So I aligned the metric window:

```text
Dashboard Sales · last 7 days
Best-Selling Products · last 7 days
```

This kind of consistency matters because dashboards should not confuse users with mismatched time ranges.

---

## 16. Demo data decisions

I changed the demo data from generic products into furniture and appliance products.

This made the business story more coherent. A furniture/appliance store naturally connects inventory, suppliers, restocks, customer orders, delivery fees, and product quotes.

Example products include:

- sofa;
- dining table;
- bed frame;
- refrigerator;
- washing machine;
- vacuum cleaner.

This helped the demo feel less random and more like one actual business.

I also added safe reset scripts for demo data:

```text
reset_demo_data.py
reset_crm_demo_data.py
```

The reset scripts were designed with safety rules:

- dry-run by default;
- require `--execute`;
- require explicit environment guard variables;
- inventory reset and CRM reset are separate;
- production-looking databases are refused.

This was important because I wanted demo data to be repeatable without accidentally destroying real data.

---

## 17. Repository and production safety decisions

When upgrading to Stockwise-CRM, I did not want to break the original deployed Stockwise version.

So I used a safer path:

- copy the project into a separate local working folder;
- develop the CRM upgrade there;
- avoid pushing to the original production repo;
- create a separate GitHub repo for Stockwise-CRM;
- deploy separate Render and Amplify resources;
- keep the old Stockwise production untouched until the new version was verified.

This was a practical safety decision. It reduced the chance of breaking the original deployed portfolio project while experimenting with CRM features.

After the new deployment worked, I could update the portfolio to point to the new Stockwise-CRM version.

---

## 18. Final deployment decisions for Stockwise-CRM

The current Stockwise-CRM deployment uses:

```text
Frontend: AWS Amplify
Backend: Render
Database: Neon PostgreSQL
Repository: separate Stockwise-CRM GitHub repo
```

I verified the deployment through:

- `/api/health`;
- `/api/products`;
- `/api/leads`;
- `/api/crm/dashboard`;
- Dashboard page;
- Products page;
- Customer Orders page;
- Record Sale page;
- Record Restock page;
- Suppliers page;
- AI Insights page.

I also tightened CORS to the new Amplify frontend domain after confirming the frontend and backend worked together.

This gave the project a real public demo and a cleaner portfolio story.

---

## 19. Portfolio positioning decision

I decided to keep the name **Stockwise**, but describe the upgraded version as:

```text
Sales & Inventory Operations Platform
```

I did not want to present it as two unrelated projects. The CRM version is the latest evolution of the same project.

The new description is stronger because it shows a fuller business workflow:

```text
Inventory → Customer inquiry → Quote → Lead pipeline → Follow-up → Won/Lost → Sale → Inventory movement
```

This makes the project more relevant for backend, cloud, CRM, sales operations, and business application roles.

---


## 20. Main tradeoffs

### I chose practical cloud deployment over overly complex AWS infrastructure

I could have deployed everything manually on EC2 or used heavier AWS services, but that would have increased cost and setup risk. Amplify + Render + Neon gave me a real deployed full-stack app faster and more safely.

### I chose rule-based logic over fake machine learning

For inventory recommendations, explainable rules are better than pretending to have a forecasting model. This makes the app easier to debug and defend.

### I chose a lightweight CRM instead of a full enterprise CRM

The goal was not to recreate Salesforce. The goal was to add enough customer-order workflow to make Stockwise useful for a small business and stronger as a portfolio project.

### I chose separate deployment resources for safety

The CRM upgrade could have broken the original Stockwise deployment. Keeping the new version separate until it was verified was safer and more professional.

---
## 21. Opportunity editing decision

After the CRM pipeline was working, I added the ability to edit opportunities after they were created.

The original form already had a full quote builder. The edit modal needed to match that. A simpler edit form with only a few fields would have created inconsistency — a user could set a product and quantity when creating an opportunity but not be able to change them later.

So I built the edit modal with the same fields as the create form: title, stage, notes, follow-up date, product, quantity, discount, delivery fee, and auto-calculated estimated value. The tax rate logic is shared — the same category-based calculation runs in both the create form and the edit modal.

The edit modal reuses the existing PUT /api/leads/{id} endpoint. No new backend route was needed.

## 22. Won to sale handoff decision

When an opportunity is marked Won, the obvious next step is to record the actual sale so inventory is updated. The question was how to connect those two steps without duplicating logic.

The simplest approach was to navigate to the existing Record Sale page and pre-fill the product and quantity from the opportunity. The user confirms on the Record Sale page and submits, which runs the existing stock-decrement workflow.

This avoided building a separate panel, handling stock validation a second time, or duplicating the inventory movement logic inside the pipeline view. The Record Sale page already handles all of that correctly.

The implementation uses React Router's location state to pass the prefill data. RecordSale reads it once when the product list loads and sets the form fields. If there is no prefill, the page behaves normally.

23. Inventory status consistency decision
The project currently uses two separate status systems for inventory health:
Products page uses a simple threshold rule:

stock = 0 → Out of stock
stock <= reorder_threshold → Low stock
stock > reorder_threshold → Healthy

AI Insights page and Dashboard use a dynamic urgency tier calculated from sales velocity and days left:

estimated_days_left and avg_daily_sales drive the tier
Output: HEALTHY / WATCH / LOW / MODERATE / HIGH / CRITICAL

This means the same product can show "Healthy" on the Products page but "HIGH" on the Dashboard — for example, a product with stock above threshold but only 4 days of supply remaining based on recent sales velocity.
The inconsistency is a known design tradeoff. The dynamic urgency tier is more accurate for operational decisions. The static threshold label on the Products page is simpler and faster to render without an additional API call.
The ideal fix would be to have the Products page reuse the urgency tier from the insights service, replacing the static label with the dynamic one. This was not implemented in the current version because the Products page is primarily a catalog management view, and adding an insights API dependency would increase load complexity for a page that is not the main operational dashboard.


## 24. Future improvements

The next improvements I would consider are:

- authentication and user accounts;
- role-based access control;
- opportunity item tables for multi-product quotes;
- a “Convert Won Opportunity to Sale” workflow;
- CSV export for inventory and customer orders;
- more detailed sales analytics;
- real LLM provider support for AI summaries;
- custom domain for a cleaner production URL;
- stronger automated tests for backend business logic.

---

## 24. What this project demonstrates

Stockwise demonstrates that I can take an operational business problem and turn it into a working system.

It shows:

- backend API design;
- relational data modeling;
- product, sales, restock, supplier, customer, lead, and activity workflows;
- inventory stock-in and stock-out logic;
- explainable rule-based business logic;
- AI-assisted summary design without depending on AI for core decisions;
- React dashboard UI design;
- cloud deployment across frontend, backend, and database;
- environment variable configuration;
- CORS and deployment troubleshooting;
- CI/CD and Docker validation;
- practical product thinking.

The main value of this project is not just that it has many pages. The value is that the business logic is connected:

```text
Products connect to sales.
Sales connect to inventory.
Inventory connects to restock insights.
Customers connect to leads.
Leads connect to quotes and follow-ups.
Won leads connect back to the sale workflow.
```

That is the design idea behind Stockwise.
