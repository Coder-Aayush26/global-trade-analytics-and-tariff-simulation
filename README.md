# Global Trade Analytics & Dynamic Tariff Policy Simulation

> **Type:** DBMS-focused relational decision-support system  
> **Primary Database:** PostgreSQL 16 / 18 (OLTP, Referential Integrity, Temporal Tracking, Audit Triggers)  
> **Embedded OLAP Engine:** DuckDB 2.0 (Vectorized Columnar Analytics, Market Concentration HHI)  
> **Stack:** React 18 + TypeScript + Vite + FastAPI + SQLAlchemy 2.x + PostgreSQL + DuckDB  

---

## Quick Start

### Prerequisites
- Docker & Docker Compose **OR** Local PostgreSQL (16 or 18)
- Node.js 20+ (for frontend development)
- Python 3.12+ (for backend and ETL development)

### 1. Configure Environment

```bash
cp .env.example .env
# Edit .env if needed (default credentials: postgresql://postgres:postgres@localhost:5432/trade_db)
```

### 2. Start Services via Docker Compose

```bash
docker compose up --build
```

| Service | URL | Description |
|---|---|---|
| **Frontend Dashboard** | http://localhost:5173 *(or 3000 in Docker)* | Glassmorphic React 18 UI with 3D Globe & World Map |
| **Backend API** | http://localhost:8000 | FastAPI REST API & Analytical Endpoints |
| **Swagger Interactive Docs** | http://localhost:8000/docs | OpenAPI schema & endpoint test console |
| **PostgreSQL Database** | localhost:5432 (db: `trade_db`) | Relational database with 13 tables & 6 views |

---

### 3. Local Development (Without Docker)

**Database Setup:**
```powershell
# Create database and apply DDL schema, views, stored functions, triggers, and comprehensive datasets
psql -U postgres -c "CREATE DATABASE trade_db;"
psql -U postgres -d trade_db -f database/schema.sql
psql -U postgres -d trade_db -f database/views.sql
psql -U postgres -d trade_db -f database/functions.sql
psql -U postgres -d trade_db -f database/triggers.sql
psql -U postgres -d trade_db -f database/comprehensive_trade_data.sql
```

**FastAPI Backend:**
```powershell
# Using the pre-configured runner script
.\run_backend.ps1

# Or directly via Uvicorn
& "backend\.venv\Scripts\uvicorn.exe" app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```

**React Frontend:**
```powershell
# Using the pre-configured runner script
.\run_frontend.ps1

# Or directly via npm
cd frontend
npm install
npm run dev
```

**ETL Pipeline (Load Standardized CSV Datasets):**
```powershell
# Ingest bilateral trade facts & statutory tariffs from data/
& "backend\.venv\Scripts\python.exe" etl/load_postgres.py --file data/trade_data.csv --type trade
& "backend\.venv\Scripts\python.exe" etl/load_postgres.py --file data/tariff_data.csv --type tariff
```

---

## Entity-Relationship (ER) Architecture

```mermaid
erDiagram
    DATA_SOURCE ||--o{ INGESTION_BATCH : "sourced by"
    DATA_SOURCE ||--o{ TRADE_OBSERVATION : "tracks origin"
    DATA_SOURCE ||--o{ TARIFF_POLICY : "tracks origin"
    INGESTION_BATCH ||--o{ TRADE_OBSERVATION : "loads batch"
    INGESTION_BATCH ||--o{ TARIFF_POLICY : "loads batch"

    COUNTRY ||--o{ TRADE_OBSERVATION : "reports (exporter/importer)"
    COUNTRY ||--o{ TRADE_OBSERVATION : "partners with"
    COUNTRY ||--o{ TARIFF_POLICY : "imposes tariff"
    COUNTRY ||--o{ TARIFF_POLICY : "subject to tariff"
    PRODUCT ||--o{ TRADE_OBSERVATION : "classified by HS"
    PRODUCT ||--o{ TARIFF_POLICY : "levied on HS"

    TRADE_AGREEMENT ||--o{ AGREEMENT_MEMBER : "includes"
    COUNTRY ||--o{ AGREEMENT_MEMBER : "participates in"
    TRADE_AGREEMENT ||--o{ TARIFF_POLICY : "establishes preferential rate"

    TARIFF_SCENARIO ||--o{ SCENARIO_TARIFF : "proposes rate hike/cut"
    COUNTRY ||--o{ SCENARIO_TARIFF : "importer scope"
    COUNTRY ||--o{ SCENARIO_TARIFF : "exporter scope"
    PRODUCT ||--o{ SCENARIO_TARIFF : "product scope"

    TARIFF_SCENARIO ||--o{ SIMULATION_RUN : "executes model"
    SIMULATION_RUN ||--o{ SIMULATION_RESULT : "computes M1, R1"

    TARIFF_POLICY ||--o{ TARIFF_AUDIT : "trigger captures INSERT/UPDATE/DELETE"
```

---

## Database Schema & Table Reference

The PostgreSQL database enforces Third Normal Form (3NF) with Boyce-Codd Normal Form (BCNF) where applicable, maintaining complete domain integrity, referential constraints, and temporal tracking across **13 tables**.

### 1. `country` (Reference Dimension)
Primary dimension table for sovereign states, customs territories, and reporting economies.

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `country_id` | `SERIAL` | **PRIMARY KEY** | Unique surrogate identifier for each sovereign nation |
| `iso3` | `CHAR(3)` | **NOT NULL, UNIQUE**, `CHECK (~ '^[A-Z]{3}$')` | ISO 3166-1 alpha-3 code (e.g. `USA`, `CHN`, `DEU`) |
| `iso2` | `CHAR(2)` | Nullable | ISO 3166-1 alpha-2 code (e.g. `US`, `CN`, `DE`) |
| `country_name` | `VARCHAR(200)` | **NOT NULL** | Official country name matching TopoJSON cartography |
| `region` | `VARCHAR(100)` | Nullable | Continental/macroeconomic region (e.g. `North America`, `Europe`) |
| `income_group` | `VARCHAR(60)` | Nullable | World Bank classification (`High income`, `Upper middle income`, etc.) |
| `created_at` | `TIMESTAMPTZ` | **NOT NULL**, `DEFAULT NOW()` | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | **NOT NULL**, `DEFAULT NOW()` | Record last modification timestamp |

---

### 2. `product` (Harmonized System Classification)
Reference dimension representing goods categorized by standardized Harmonized System (HS) codes. Leading zeros are preserved.

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `product_id` | `SERIAL` | **PRIMARY KEY** | Unique surrogate identifier for each product |
| `hs_code` | `VARCHAR(20)` | **NOT NULL**, `CHECK (LENGTH(TRIM(hs_code)) > 0)` | Standard HS code (e.g. `8517`, `8542`, `8703`) |
| `hs_version` | `VARCHAR(20)` | **NOT NULL** | HS revision nomenclature (e.g. `HS2017`, `HS2022`) |
| `product_description`| `TEXT` | **NOT NULL** | Full official commodity / product description |
| `hs_chapter` | `VARCHAR(10)` | Nullable | First 2 digits indicating HS chapter (`85`, `87`, `27`, etc.) |
| `parent_hs_code` | `VARCHAR(20)` | Nullable | Hierarchical parent HS code for category rollup |
| `created_at` | `TIMESTAMPTZ` | **NOT NULL**, `DEFAULT NOW()` | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | **NOT NULL**, `DEFAULT NOW()` | Record last update timestamp |

- **Business Unique Key**: `UNIQUE (hs_code, hs_version)` — prevents ambiguous nomenclature versions.

---

### 3. `data_source` (Catalogue of Data Provenance)
Maintains auditability and licensing provenance for external data providers.

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `source_id` | `SERIAL` | **PRIMARY KEY** | Unique identifier for external data provider |
| `source_name` | `VARCHAR(200)` | **NOT NULL** | Provider name (`UN Comtrade`, `World Bank WITS`, `WTO IDB`) |
| `source_url` | `TEXT` | Nullable | Official web portal / API endpoint |
| `retrieved_at` | `DATE` | Nullable | Extraction date of the external dataset |
| `license_or_usage_note` | `TEXT` | Nullable | Terms of service, redistribution rights, or academic license |
| `source_version` | `VARCHAR(100)`| Nullable | Dataset version or release tag (`BulkDownload_2024`, `WITS_2024`) |
| `created_at` | `TIMESTAMPTZ` | **NOT NULL**, `DEFAULT NOW()` | Record registration timestamp |

---

### 4. `ingestion_batch` (ETL Run Log & Data Quality Ledger)
Tracks every ETL ingestion run, capturing processing latency and record-level quality metrics.

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `batch_id` | `SERIAL` | **PRIMARY KEY** | Unique batch execution identifier |
| `source_id` | `INT` | **NOT NULL, REFERENCES** `data_source(source_id)` | Linked data source for the ingestion run |
| `started_at` | `TIMESTAMPTZ` | **NOT NULL**, `DEFAULT NOW()` | Pipeline start time |
| `completed_at` | `TIMESTAMPTZ` | Nullable | Pipeline completion time |
| `batch_status` | `VARCHAR(30)` | **NOT NULL**, `CHECK IN ('RUNNING','COMPLETED','FAILED','PARTIAL')` | Lifecycle state of the batch run |
| `input_record_count` | `INT` | `CHECK (input_record_count >= 0)` | Total number of candidate rows in input CSV |
| `loaded_record_count`| `INT` | `CHECK (loaded_record_count >= 0)` | Successfully committed relational records |
| `rejected_record_count`| `INT`| `CHECK (rejected_record_count >= 0)`| Rejected/malformed rows failing validation |
| `error_summary` | `TEXT` | Nullable | Error messages or constraint violation trace |

- **Constraint**: `CHECK (completed_at IS NULL OR completed_at >= started_at)`

---

### 5. `trade_observation` (Core Fact Table - Bilateral Trade)
Captures granular bilateral merchandise trade flows normalized to USD.

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `trade_id` | `SERIAL` | **PRIMARY KEY** | Surrogate observation key |
| `reporter_country_id`| `INT` | **NOT NULL, REFERENCES** `country(country_id)` | Economy reporting the trade statistics |
| `partner_country_id` | `INT` | **NOT NULL, REFERENCES** `country(country_id)` | Counterparty economy in the trade transaction |
| `product_id` | `INT` | **NOT NULL, REFERENCES** `product(product_id)` | Traded commodity classification (HS) |
| `period_year` | `SMALLINT` | **NOT NULL**, `CHECK (period_year BETWEEN 1900 AND 2100)` | Observation calendar year (2018–2023) |
| `flow_direction` | `VARCHAR(10)` | **NOT NULL**, `CHECK IN ('IMPORT','EXPORT')` | Trade direction from reporter's viewpoint |
| `trade_value_usd` | `NUMERIC(20,4)`| **NOT NULL**, `CHECK (trade_value_usd >= 0)` | Customs valuation in USD (FOB for exports, CIF for imports) |
| `quantity` | `NUMERIC(20,4)`| Nullable | Physical quantity traded |
| `quantity_unit` | `VARCHAR(50)` | Nullable | Measurement unit (`items`, `tonnes`, `chips`, `vehicles`, `kg`) |
| `net_weight_kg` | `NUMERIC(20,4)`| Nullable | Metric net weight in kilograms |
| `source_id` | `INT` | **NOT NULL, REFERENCES** `data_source(source_id)` | Origin data catalogue reference |
| `batch_id` | `INT` | **REFERENCES** `ingestion_batch(batch_id)` | ETL batch trace |
| `reported_at` | `TIMESTAMPTZ` | **NOT NULL**, `DEFAULT NOW()` | Database insertion timestamp |

- **Business Unique Key**: `UNIQUE (reporter_country_id, partner_country_id, product_id, period_year, flow_direction, source_id)`
- **Domain Constraint**: `CHECK (reporter_country_id <> partner_country_id)` — prevents circular trade.
- **Indexes**:
  - `idx_trade_reporter_year_flow` ON `(reporter_country_id, period_year, flow_direction)`
  - `idx_trade_product_year` ON `(product_id, period_year)`
  - `idx_trade_partner` ON `(partner_country_id)`
  - `idx_trade_batch` ON `(batch_id)`

---

### 6. `tariff_policy` (Temporal Applied Tariff Schedules)
Effective-dated tariff schedules supporting both statutory general (MFN) and partner-specific preferential rates. Past rates are end-dated, never overwritten.

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `tariff_policy_id` | `SERIAL` | **PRIMARY KEY** | Unique policy schedule identifier |
| `importer_country_id`| `INT` | **NOT NULL, REFERENCES** `country(country_id)` | Economy levying the tariff duty |
| `exporter_country_id`| `INT` | **REFERENCES** `country(country_id)` | Nullable: `NULL` denotes MFN/general rate; non-null denotes bilateral/preferential rate |
| `product_id` | `INT` | **NOT NULL, REFERENCES** `product(product_id)` | Target HS product classification |
| `tariff_type` | `VARCHAR(30)` | **NOT NULL**, `CHECK IN ('AD_VALOREM','SPECIFIC','MIXED','OTHER')` | Customs valuation method |
| `tariff_rate` | `NUMERIC(10,6)`| **NOT NULL**, `CHECK (tariff_rate >= 0)` | Applied duty in decimal form (`0.250000` = 25.0%) |
| `rate_unit` | `VARCHAR(50)` | Nullable | Unit label (`% ad valorem`, `% ad valorem (USMCA)`) |
| `effective_from` | `DATE` | **NOT NULL** | Date tariff takes legal effect |
| `effective_to` | `DATE` | Nullable | End date; `NULL` indicates currently active/in force |
| `source_id` | `INT` | **NOT NULL, REFERENCES** `data_source(source_id)` | Data source provenance |
| `batch_id` | `INT` | **REFERENCES** `ingestion_batch(batch_id)` | Ingestion batch link |
| `agreement_id` | `INT` | **REFERENCES** `trade_agreement(agreement_id)` | Linked Free Trade Agreement (if preferential) |
| `policy_note` | `TEXT` | Nullable | Regulatory reference (e.g. `Section 301 List 3`, `USMCA Duty-Free`) |

- **Temporal Constraint**: `CHECK (effective_to IS NULL OR effective_to > effective_from)`
- **Indexes**:
  - `idx_tariff_scope_dates` ON `(importer_country_id, product_id, effective_from, effective_to)`
  - `idx_tariff_exporter` ON `(exporter_country_id)`
- **Trigger**: `trig_tariff_policy_audit` automatically logs every `INSERT`, `UPDATE`, and `DELETE` into `tariff_audit`.

---

### 7. `trade_agreement` (Multilateral Trade Pacts)
Catalogues named Free Trade Agreements, customs unions, and bilateral treaties.

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `agreement_id` | `SERIAL` | **PRIMARY KEY** | Unique trade agreement identifier |
| `agreement_name` | `VARCHAR(300)` | **NOT NULL** | Official treaty title (`USMCA`, `EU Single Market`, `RCEP`, `CPTPP`) |
| `effective_from` | `DATE` | Nullable | Date agreement entered into force |
| `effective_to` | `DATE` | Nullable | Expiration / termination date (if applicable) |
| `official_ref` | `VARCHAR(200)` | Nullable | Legal document reference (e.g. `USMCA 2020`, `Treaty of Maastricht`) |
| `notes` | `TEXT` | Nullable | Scope summary and trade rules description |

- **Temporal Constraint**: `CHECK (effective_to IS NULL OR effective_to > effective_from)`

---

### 8. `agreement_member` (Agreement ↔ Country Junction)
Resolves the many-to-many relationship between trade agreements and member nations.

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `agreement_id` | `INT` | **NOT NULL, REFERENCES** `trade_agreement(agreement_id)` | Part of composite primary key |
| `country_id` | `INT` | **NOT NULL, REFERENCES** `country(country_id)` | Part of composite primary key |

- **Composite Primary Key**: `PRIMARY KEY (agreement_id, country_id)`

---

### 9. `tariff_scenario` (What-If Simulation Sandbox)
Stores user-defined policy scenarios. Scenarios are fully decoupled from base tariff policies, ensuring official data is never mutated during what-if experiments.

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `scenario_id` | `SERIAL` | **PRIMARY KEY** | Unique scenario identifier |
| `scenario_name` | `VARCHAR(300)` | **NOT NULL** | User-assigned scenario title |
| `description` | `TEXT` | Nullable | Economic rationale and hypothesis |
| `created_by` | `VARCHAR(200)` | Nullable | Author or analyst identifier |
| `baseline_period` | `SMALLINT` | **NOT NULL**, `CHECK (baseline_period BETWEEN 1900 AND 2100)` | Historical base year used for trade volumes ($M_0$) |
| `scenario_status` | `VARCHAR(20)` | **NOT NULL**, `CHECK IN ('DRAFT','READY','SIMULATED','ARCHIVED')` | Workflow state |
| `created_at` | `TIMESTAMPTZ` | **NOT NULL**, `DEFAULT NOW()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | **NOT NULL**, `DEFAULT NOW()` | Auto-updated via `trig_tariff_scenario_updated_at` |

---

### 10. `scenario_tariff` (Proposed Tariff Rate Schedule)
Defines the specific tariff rate modifications proposed in a what-if scenario.

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `scenario_id` | `INT` | **NOT NULL, REFERENCES** `tariff_scenario(scenario_id) ON DELETE CASCADE` | Parent scenario |
| `importer_country_id`| `INT` | **NOT NULL, REFERENCES** `country(country_id)` | Economy proposing duty modification |
| `exporter_country_id`| `INT` | **NOT NULL, REFERENCES** `country(country_id)` | Target partner economy |
| `product_id` | `INT` | **NOT NULL, REFERENCES** `product(product_id)` | Targeted HS commodity |
| `proposed_tariff_rate`|`NUMERIC(10,6)`| **NOT NULL**, `CHECK (proposed_tariff_rate >= 0)` | Proposed rate ($t_1$) in decimal (`0.300000` = 30%) |

- **Composite Primary Key**: `PRIMARY KEY (scenario_id, importer_country_id, exporter_country_id, product_id)`

---

### 11. `simulation_run` (Execution Run Ledger)
Immutable execution ledger recording model metadata, assumptions, and execution status for every simulation run. Prior runs are preserved for side-by-side comparison.

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `run_id` | `SERIAL` | **PRIMARY KEY** | Unique execution run identifier |
| `scenario_id` | `INT` | **NOT NULL, REFERENCES** `tariff_scenario(scenario_id)` | Scenario executed |
| `model_name` | `VARCHAR(100)` | **NOT NULL**, `DEFAULT 'constant_elasticity_v1'` | Econometric model algorithm |
| `model_version` | `VARCHAR(50)` | **NOT NULL**, `DEFAULT '1.0'` | Model version identifier |
| `elasticity_assumption`|`NUMERIC(8,4)`| Nullable | Import price elasticity ($\varepsilon \le 0$, default: `-0.5000`) |
| `baseline_period` | `SMALLINT` | **NOT NULL** | Base year snapshot period |
| `run_at` | `TIMESTAMPTZ` | **NOT NULL**, `DEFAULT NOW()` | Execution timestamp |
| `run_status` | `VARCHAR(20)` | **NOT NULL**, `CHECK IN ('PENDING','RUNNING','COMPLETED','FAILED')` | Execution state |
| `warnings` | `TEXT` | Nullable | Warning notes (e.g. missing baselines) |
| `execution_notes` | `TEXT` | Nullable | Diagnostics or runtime comments |

---

### 12. `simulation_result` (Simulated Economic Outcomes)
Granular output table containing corridor-level econometric estimates computed atomically by the `run_tariff_scenario()` stored procedure.

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `result_id` | `SERIAL` | **PRIMARY KEY** | Unique result row identifier |
| `run_id` | `INT` | **NOT NULL, REFERENCES** `simulation_run(run_id)` | Parent simulation run |
| `importer_country_id` | `INT` | **NOT NULL, REFERENCES** `country(country_id)` | Importing economy |
| `exporter_country_id` | `INT` | **NOT NULL, REFERENCES** `country(country_id)` | Exporting counterparty |
| `product_id` | `INT` | **NOT NULL, REFERENCES** `product(product_id)` | Analyzed commodity |
| `baseline_import_value`| `NUMERIC(20,4)`| Nullable | Pre-shock baseline trade value ($M_0$ in USD) |
| `current_tariff_rate` | `NUMERIC(10,6)`| Nullable | In-force effective tariff rate ($t_0$) at baseline date |
| `proposed_tariff_rate`| `NUMERIC(10,6)`| Nullable | Policy shock tariff rate ($t_1$) |
| `estimated_import_value_after`|`NUMERIC(20,4)`| Nullable | Projected import value ($M_1$ in USD) |
| `estimated_revenue_before`|`NUMERIC(20,4)`| Nullable | Baseline customs duty revenue ($R_0 = M_0 \times t_0$) |
| `estimated_revenue_after` |`NUMERIC(20,4)`| Nullable | Projected customs duty revenue ($R_1 = M_1 \times t_1$) |
| `estimated_import_change_pct`|`NUMERIC(10,4)`| Nullable | Percentage trade contraction: $\frac{M_1 - M_0}{M_0} \times 100$ |
| `result_status` | `VARCHAR(30)` | `CHECK IN ('OK','MISSING_BASELINE','MISSING_TARIFF','PARTIAL','ERROR')` | Line validation status |
| `result_warning` | `TEXT` | Nullable | Contextual explanation if baseline data was missing |

---

### 13. `tariff_audit` (Immutable Audit Trail)
Maintains a tamper-evident audit log for compliance. Populated automatically by a database trigger whenever `tariff_policy` records are inserted, modified, or deleted.

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `audit_id` | `SERIAL` | **PRIMARY KEY** | Unique audit event sequence number |
| `tariff_policy_id` | `INT` | **NOT NULL** | Subject policy ID (no FK constraint to survive deletions) |
| `operation` | `CHAR(1)` | **NOT NULL**, `CHECK IN ('I','U','D')` | DML action: `I` (Insert), `U` (Update), `D` (Delete) |
| `old_tariff_rate` | `NUMERIC(10,6)`| Nullable | Pre-modification tariff rate |
| `new_tariff_rate` | `NUMERIC(10,6)`| Nullable | Post-modification tariff rate |
| `old_effective_from` | `DATE` | Nullable | Pre-modification start date |
| `new_effective_from` | `DATE` | Nullable | Post-modification start date |
| `old_effective_to` | `DATE` | Nullable | Pre-modification end date |
| `new_effective_to` | `DATE` | Nullable | Post-modification end date |
| `changed_by` | `VARCHAR(200)` | Nullable | Database user who performed the operation |
| `changed_at` | `TIMESTAMPTZ` | **NOT NULL**, `DEFAULT NOW()` | Exact timestamp of operation |
| `reason` | `TEXT` | Nullable | Justification for policy rate adjustment |

---

## Database Views Reference (`database/views.sql`)

| View Name | Source Tables | Key Columns Returned | Analytical Purpose |
|---|---|---|---|
| `vw_country_year_trade_balance` | `trade_observation`, `country` | `reporter_country`, `period_year`, `total_exports_usd`, `total_imports_usd`, `reported_trade_balance_usd` | Calculates net annual trade balance per economy using symmetric reporter aggregation |
| `vw_top_trade_partners` | `trade_observation`, `country` | `reporter_country`, `partner_country`, `period_year`, `flow_direction`, `total_value_usd`, `partner_rank` | Uses `RANK() OVER (PARTITION BY ... ORDER BY SUM(...) DESC)` to rank top trading partners |
| `vw_product_trade_summary` | `trade_observation`, `country`, `product` | `reporter_country`, `hs_code`, `product_description`, `period_year`, `flow_direction`, `total_value_usd` | Summarizes commodity performance and product concentration by country and year |
| `vw_tariff_history` | `tariff_policy`, `country`, `product`, `data_source` | `importer_country`, `exporter_country`, `hs_code`, `tariff_rate_pct`, `effective_from`, `effective_to`, `policy_note` | Human-readable chronological tariff policy timeline resolving MFN vs preferential rates |
| `vw_scenario_latest_run` | `tariff_scenario`, `simulation_run`, `simulation_result` | `scenario_id`, `scenario_name`, `latest_run_id`, `total_estimated_revenue`, `avg_import_change_pct` | Provides headline KPIs for the most recent simulation run of each scenario |
| `vw_scenario_comparison` | `simulation_run`, `simulation_result`, `country`, `product` | `run_id`, `scenario_name`, `importer_country`, `exporter_country`, `hs_code`, `baseline_import_value`, `proposed_tariff_rate`, `estimated_revenue_after` | Granular multi-run comparison matrix for cross-scenario evaluation |

---

## Stored Functions & Procedures Reference (`database/functions.sql`)

### 1. `get_effective_tariff_rate(p_importer_id, p_exporter_id, p_product_id, p_as_of_date)`
- **Language:** SQL (`STABLE`)
- **Purpose:** Resolves the exact legal tariff rate in force for a specific trade corridor on a given date.
- **Precedence Rule:** Preferential bilateral rates (e.g. USMCA 0%, FTA pacts) take precedence over general MFN rates via `ORDER BY scope DESC LIMIT 1`.

### 2. `run_tariff_scenario(p_scenario_id, p_elasticity, p_model_version)`
- **Language:** PL/pgSQL (`VOLATILE`)
- **Purpose:** Executes an end-to-end atomic simulation of a what-if scenario.
- **Workflow:**
  1. Validates scenario existence and locks the scenario row.
  2. Creates a `simulation_run` record in `RUNNING` status.
  3. Looks up baseline customs values ($M_0$) from `trade_observation` and effective base tariffs ($t_0$) via `get_effective_tariff_rate()`.
  4. Applies the constant-elasticity formula:
     $$M_1 = M_0 \times \left(\frac{1 + t_1}{1 + t_0}\right)^\varepsilon$$
     $$R_0 = M_0 \times t_0 \quad\text{and}\quad R_1 = M_1 \times t_1$$
  5. Inserts computed rows into `simulation_result`.
  6. Commits run status as `COMPLETED`. Rollback occurs on exception to maintain complete transactional integrity.

### 3. `validate_scenario(p_scenario_id)`
- **Language:** SQL (`STABLE`)
- **Purpose:** Pre-flight sanity check returning diagnostic warnings before simulation (checks for empty tariff schedules, missing historical baselines, or redundant rates).

### 4. `get_yoy_growth(p_reporter_id, p_flow, p_product_id)`
- **Language:** SQL (`STABLE`)
- **Purpose:** Uses the `LAG()` analytic window function to compute year-over-year trade volume growth percentages across historical periods.

---

## Triggers & Audit Logging (`database/triggers.sql`)

- **`trg_tariff_policy_audit()`**: Attached to `tariff_policy` (`AFTER INSERT OR UPDATE OR DELETE`). Captures the old/new tariff rates, validity date ranges, database user, and timestamp into `tariff_audit`.
- **`trg_set_updated_at()`**: Attached to `country`, `product`, and `tariff_scenario` (`BEFORE UPDATE`). Automatically sets `updated_at = NOW()`.

---

## Embedded Columnar OLAP Engine (DuckDB 2.0)

In addition to PostgreSQL's OLTP transactional core, the backend includes an embedded in-memory **DuckDB 2.0** analytical engine ([`backend/app/db/duckdb_service.py`](file:///d:/DBMS%20Project/backend/app/db/duckdb_service.py)):

- **Columnar Tables:**
  - `dim_country`: Columnar country dimension cache.
  - `dim_product`: Columnar HS product dimension cache.
  - `fact_trade`: Vectorized columnar table holding all trade observations.
- **Analytical Role:**
  - Calculates the **Herfindahl-Hirschman Market Concentration Index (HHI)** for national import dependency:
    $$\text{HHI} = \sum_{i=1}^n (\text{Market Share}_i \times 100)^2$$
  - Sub-15 millisecond execution over thousands of rows using SIMD vectorization.
  - Synced dynamically from PostgreSQL via `POST /api/olap/sync` or the Admin Dashboard.

---

## Project Structure

```
DBMS Project/
├── README.md                           ← System documentation & schema specification
├── docker-compose.yml                  ← Multi-container orchestration
├── .env.example                        ← Template environment configuration
├── run_backend.ps1                     ← Quick PowerShell launcher for FastAPI
├── run_frontend.ps1                    ← Quick PowerShell launcher for React
├── data/                               ← Standardized offline datasets
│   ├── countries.csv                   ← 30 sovereign economies dimension
│   ├── products.csv                    ← 20 HS2017 commodity categories
│   ├── trade_data.csv                  ← 2,056 bilateral trade observations (2018-2023)
│   └── tariff_data.csv                 ← 1,230 statutory & preferential tariff schedules
├── database/
│   ├── schema.sql                      ← DDL: 13 3NF normalized tables with constraints & indexes
│   ├── views.sql                       ← 6 analytical SQL views
│   ├── functions.sql                   ← 4 stored procedures (atomic simulation, lookups)
│   ├── triggers.sql                    ← Audit trail & updated_at trigger logic
│   ├── comprehensive_trade_data.sql    ← Comprehensive SQL dataset seed
│   ├── seed_reference_data.sql         ← Baseline seed data
│   └── analytics_queries.sql           ← 12 complex analytical queries portfolio
├── backend/
│   ├── app/
│   │   ├── main.py                     ← FastAPI application entry point & CORS
│   │   ├── core/config.py              ← Environment configuration & settings
│   │   ├── db/database.py              ← SQLAlchemy engine & session factory
│   │   ├── db/models.py                ← ORM models mirroring PostgreSQL schema
│   │   ├── db/duckdb_service.py        ← DuckDB 2.0 in-memory OLAP & HHI engine
│   │   ├── api/reference.py            ← /countries, /products endpoints
│   │   ├── api/trade.py                ← /trade, /analytics/* endpoints
│   │   ├── api/tariffs.py              ← /tariffs effective lookup
│   │   ├── api/scenarios.py            ← /scenarios, /runs, /compare
│   │   ├── api/olap.py                 ← /olap/sync, /olap/concentration
│   │   └── api/admin.py                ← /admin/ingestion-batches, DB stats
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx                     ← React router & main glassmorphism layout
│   │   ├── components/
│   │   │   ├── InteractiveBackground.tsx ← Canvas particle grid animation
│   │   │   └── worldMapData.ts         ← Metadata for 30 economies & TopoJSON aliases
│   │   ├── pages/
│   │   │   ├── WorldMap.tsx            ← 3D Globe & 2D Map with Geodesic Laser Arcs
│   │   │   ├── Dashboard.tsx           ← Macroeconomic trade balance & partner rankings
│   │   │   ├── TradeExplorer.tsx       ← Paginated bilateral trade observations browser
│   │   │   ├── TariffHistory.tsx       ← Chronological tariff schedule inspection
│   │   │   ├── Simulator.tsx           ← What-if scenario builder & model execution
│   │   │   ├── ScenarioComparison.tsx  ← Cross-scenario economic delta visualizer
│   │   │   └── AdminPage.tsx           ← ETL batch tracking, DuckDB OLAP & HHI calculator
│   │   └── api/client.ts               ← Axios HTTP client
│   ├── public/
│   │   └── countries-110m.json          ← Natural Earth 110m sovereign TopoJSON
│   ├── package.json
│   ├── vite.config.ts
│   ├── Dockerfile
│   └── nginx.conf
├── etl/
│   ├── load_postgres.py                ← CSV → PostgreSQL batch-tracked ETL pipeline
│   ├── export_datasets_to_csv.py       ← Exports database tables to data/ CSV files
│   ├── generate_comprehensive_datasets.py ← Programmatic macroeconomic matrix builder
│   └── requirements.txt
└── tests/
    └── sql_integrity_tests.sql         ← 10 SQL constraint verification tests
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/countries` | List & filter sovereign economies by name or ISO3 |
| `GET` | `/api/products` | Search Harmonized System products by code or chapter |
| `GET` | `/api/trade` | Paginated & filtered bilateral trade observation records |
| `POST` | `/api/trade` | Ingest a new trade observation with constraint validation |
| `GET` | `/api/analytics/top-partners` | Ranked trade partners using SQL window functions |
| `GET` | `/api/analytics/trade-balance` | Multi-year annual exports, imports, and net balance |
| `GET` | `/api/analytics/yoy-growth` | Year-over-year trade growth via stored procedure |
| `GET` | `/api/tariffs` | Effective-dated applied tariff schedule lookup |
| `POST` | `/api/scenarios` | Create a new what-if policy scenario (atomic transaction) |
| `GET` | `/api/scenarios` | List registered policy scenarios |
| `GET` | `/api/scenarios/{id}` | Retrieve scenario details and proposed tariff changes |
| `GET` | `/api/scenarios/{id}/validate` | Run pre-flight checks using `validate_scenario()` |
| `POST` | `/api/scenarios/{id}/runs` | Execute simulation atomically via `run_tariff_scenario()` |
| `GET` | `/api/scenarios/{id}/runs` | List simulation run history for a scenario |
| `GET` | `/api/runs/{run_id}/results` | Retrieve granular corridor-level economic results ($M_1, R_1$) |
| `GET` | `/api/scenarios/compare?run_ids=1,2` | Side-by-side comparative analysis of multiple runs |
| `GET` | `/api/olap/status` | DuckDB in-memory OLAP status and cache stats |
| `POST` | `/api/olap/sync` | Synchronize PostgreSQL rows into DuckDB columnar tables |
| `GET` | `/api/olap/concentration` | Calculate Herfindahl-Hirschman Market Concentration Index (HHI) |
| `GET` | `/api/admin/ingestion-batches` | ETL batch status, record counts, and rejection rates |
| `GET` | `/api/admin/db-stats` | Live PostgreSQL table row counts and evidence metrics |

---

## Running SQL Constraint Tests

Verify referential integrity and constraint enforcement with the automated test suite:

```bash
psql -U postgres -d trade_db -f tests/sql_integrity_tests.sql
```

Expected output: 10 `NOTICE` lines each verifying `TEST N PASSED`:
1. `TEST 1 PASSED: ISO3 length check enforced.`
2. `TEST 2 PASSED: ISO3 format regex check enforced.`
3. `TEST 3 PASSED: Non-empty HS code check enforced.`
4. `TEST 4 PASSED: Unique product code-version check enforced.`
5. `TEST 5 PASSED: Circular trade check enforced (reporter <> partner).`
6. `TEST 6 PASSED: Non-negative trade value check enforced.`
7. `TEST 7 PASSED: Non-negative tariff rate check enforced.`
8. `TEST 8 PASSED: Tariff policy dates check enforced (effective_to > effective_from).`
9. `TEST 9 PASSED: Unique trade observation business key enforced.`
10. `TEST 10 PASSED: Tariff policy audit trigger fired and recorded in tariff_audit.`
