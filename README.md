# Global Trade Analytics & Dynamic Tariff Policy Simulation

> **Type:** DBMS-focused relational decision-support system  
> **Database:** PostgreSQL 16  
> **Stack:** React + FastAPI + SQLAlchemy 2.x + PostgreSQL  

---

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local frontend development)
- Python 3.12+ (for local backend/ETL development)

### 1. Clone & configure

```bash
cp .env.example .env
# Edit .env if needed (default credentials are for Docker)
```

### 2. Start everything with Docker Compose

```bash
docker compose up --build
```

| Service  | URL |
|----------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| PostgreSQL | localhost:5432 |

The database is automatically initialized with:
- Full schema (DDL + constraints + indexes)
- Views, stored functions, triggers
- Seed reference data (12 countries, 12 products, sample trade observations & tariffs)

### 3. Local development (without Docker)

**Database:**
```bash
psql -U postgres -c "CREATE DATABASE trade_db;"
psql -U postgres -d trade_db -f database/schema.sql
psql -U postgres -d trade_db -f database/views.sql
psql -U postgres -d trade_db -f database/functions.sql
psql -U postgres -d trade_db -f database/triggers.sql
psql -U postgres -d trade_db -f database/seed_reference_data.sql
```

**Backend:**
```bash
cd backend
pip install -r requirements.txt
cp ../.env.example .env
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**ETL (load custom CSV data):**
```bash
cd etl
pip install -r requirements.txt
python load_postgres.py --file data/trade_data.csv --type trade
python load_postgres.py --file data/tariff_data.csv --type tariff
```

---

## Project Structure

```
DBMS Project/
├── README.md
├── docker-compose.yml
├── .env.example
├── database/
│   ├── schema.sql              ← DDL: 13 tables with PKs, FKs, checks, indexes
│   ├── views.sql               ← 6 reusable SQL views
│   ├── functions.sql           ← 4 stored functions (simulation, lookup, YoY growth)
│   ├── triggers.sql            ← Audit trigger + updated_at triggers
│   ├── seed_reference_data.sql ← Countries, products, sources, sample data
│   └── analytics_queries.sql  ← 12 analytical SQL queries portfolio
├── backend/
│   ├── app/
│   │   ├── main.py             ← FastAPI app + CORS
│   │   ├── core/config.py      ← Settings from environment
│   │   ├── db/database.py      ← SQLAlchemy engine + session
│   │   ├── db/models.py        ← ORM models mirroring schema
│   │   ├── api/reference.py    ← /countries, /products
│   │   ├── api/trade.py        ← /trade, /analytics/*
│   │   ├── api/tariffs.py      ← /tariffs
│   │   ├── api/scenarios.py    ← /scenarios, /runs, /compare
│   │   └── api/admin.py        ← /admin/ingestion-batches
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx             ← Router + sidebar navigation
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx       ← Trade balance + top partners charts
│   │   │   ├── TradeExplorer.tsx   ← Filtered trade observations table
│   │   │   ├── TariffHistory.tsx   ← Effective-dated tariff lookup
│   │   │   ├── Simulator.tsx       ← Create scenarios + run simulations
│   │   │   ├── ScenarioComparison.tsx ← Multi-run comparison
│   │   │   └── AdminPage.tsx       ← ETL batches + DBMS evidence
│   │   └── api/client.ts       ← Axios API client
│   ├── package.json
│   ├── vite.config.ts
│   ├── Dockerfile
│   └── nginx.conf
├── etl/
│   ├── load_postgres.py        ← CSV → PostgreSQL ETL with batch tracking
│   └── requirements.txt
└── tests/
    └── sql_integrity_tests.sql ← 10 SQL tests verifying constraint enforcement
```

---

## DBMS Features Implemented

| Feature | Location |
|---------|----------|
| 13 normalized tables (3NF) | `database/schema.sql` |
| Primary & foreign keys | `database/schema.sql` |
| Check constraints (flow, rates, dates, non-negative) | `database/schema.sql` |
| Unique business keys (trade observations, products) | `database/schema.sql` |
| 4 composite indexes | `database/schema.sql` |
| 6 views (balance, partners, products, tariff history, scenarios) | `database/views.sql` |
| 4 stored functions (effective tariff, simulation, validation, YoY growth) | `database/functions.sql` |
| Audit trigger (INSERT/UPDATE/DELETE on tariff_policy) | `database/triggers.sql` |
| Atomic scenario creation (transaction + rollback) | `backend/app/api/scenarios.py` |
| Atomic simulation run via stored function | `database/functions.sql` |
| Temporal tariff history (effective_from / effective_to) | `database/schema.sql` |
| 12 analytical SQL queries (CTEs, window functions, aggregations) | `database/analytics_queries.sql` |
| ETL with batch tracking and rejection counts | `etl/load_postgres.py` |
| 10 SQL integrity constraint tests | `tests/sql_integrity_tests.sql` |

---

## Simulation Model

The tariff simulator uses a **constant-elasticity model**:

```
M₁ = M₀ × ((1 + t₁) / (1 + t₀))^ε
R₀ = M₀ × t₀
R₁ = M₁ × t₁
```

Where:
- `M₀` = baseline customs import value (USD)
- `t₀` = current tariff rate (decimal, e.g. 0.25 = 25%)
- `t₁` = proposed tariff rate (decimal)
- `ε` = import-demand price elasticity (user-defined, ≤ 0)
- `M₁` = estimated post-change import value
- `R₀`, `R₁` = estimated tariff revenue before/after

**Assumptions:** Fixed world price, full tariff pass-through, constant elasticity.  
**This is a what-if estimate, not a forecast.** It omits retaliation, substitution, exchange rates, supply responses, exemptions, and broader economic effects.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/countries` | Country list/search |
| GET | `/api/products` | Product/HS code search |
| GET | `/api/trade` | Paginated trade observations |
| GET | `/api/analytics/top-partners` | Top trade partners |
| GET | `/api/analytics/trade-balance` | Annual trade balance |
| GET | `/api/analytics/yoy-growth` | Year-over-year growth |
| GET | `/api/tariffs` | Tariff history/lookup |
| POST | `/api/scenarios` | Create scenario (atomic) |
| GET | `/api/scenarios` | List scenarios |
| GET | `/api/scenarios/{id}` | Scenario detail |
| GET | `/api/scenarios/{id}/validate` | Pre-flight validation |
| POST | `/api/scenarios/{id}/runs` | Run simulation |
| GET | `/api/scenarios/{id}/runs` | List runs |
| GET | `/api/runs/{run_id}/results` | Simulation results |
| GET | `/api/scenarios/compare?run_ids=1,2` | Compare runs |
| GET | `/api/admin/ingestion-batches` | ETL batch status |

Full interactive docs at: http://localhost:8000/docs

---

## Running SQL Tests

```bash
psql -U postgres -d trade_db -f tests/sql_integrity_tests.sql
```

Expected output: 10 `NOTICE` lines each reading `TEST N PASSED`.

---

## Data Sources

- **UN Comtrade** – international merchandise trade statistics
- **World Bank WITS** – tariff and trade data

The seed data contains illustrative sample values for educational purposes.
Check UN Comtrade and WITS terms of use before loading and redistributing their data.
