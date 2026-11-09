# Relational Database System for Global Trade Analytics and Dynamic Tariff Policy Simulation

> **Project type:** DBMS-focused relational decision-support system  
> **Recommended database:** PostgreSQL  
> **Recommended application stack:** React + FastAPI + SQLAlchemy + PostgreSQL  
> **Core emphasis:** relational modelling, SQL analytics, constraints, transactions, views, stored functions, indexing, and query optimization

---

## 1. Project Overview

### 1.1 Abstract

The **Relational Database System for Global Trade Analytics and Dynamic Tariff Policy Simulation** is a database-driven decision-support application for exploring international trade flows, examining historical tariff schedules, and comparing hypothetical tariff policies. It brings country, product, trade-observation, tariff, trade-agreement, and policy-scenario data into a normalized relational database. Users can query trade patterns, compare imports and exports, track tariff changes over time, create independent what-if scenarios, and compare estimated outcomes under different assumptions.

The project is intentionally designed as a **DBMS project first and a dashboard second**. PostgreSQL is responsible for data integrity and a substantial share of the analytical work through relational joins, aggregate queries, CTEs, window functions, views, stored functions, triggers/audit records, transactions, indexes, and explainable query plans. FastAPI exposes well-defined operations, while React provides the interface and visualizations.

The system is an educational policy-analysis prototype. Its tariff simulator estimates outcomes from transparent assumptions; it does not claim to forecast actual trade or provide official legal/customs advice.

### 1.2 Problem Statement

International trade data is distributed across countries, product classifications, reporting periods, tariff schedules, and trade agreements. It is difficult to compare these dimensions consistently, inspect policy history, and answer questions such as:

- Which countries are a country's largest trading partners for a selected product and period?
- How have a product's reported imports, exports, and trade balance changed over time?
- What tariff rate applied to a product imported from a particular partner on a given date?
- How would the estimated import value and tariff revenue change if a user tested a different tariff rate?
- Which of several hypothetical tariff scenarios produces the largest estimated revenue, smallest estimated import contraction, or another selected metric?
- How can these questions be answered efficiently while preserving data consistency and auditability?

The proposed system addresses these questions using a structured relational model and reusable database operations.

### 1.3 Goals

1. Build a normalized relational database for country, product, trade, tariff, agreement, and scenario data.
2. Preserve primary-key, foreign-key, domain, and temporal integrity.
3. Support meaningful trade analytics using non-trivial SQL queries.
4. Store historical tariff policies with effective dates rather than overwriting past values.
5. Allow users to create tariff scenarios without changing official/base data.
6. Run repeatable, versioned simulations and store the assumptions and results.
7. Demonstrate DBMS topics explicitly: normalization, constraints, views, functions, triggers, transactions, indexing, and query-plan analysis.
8. Provide an understandable interface for exploring data and comparing scenarios.

### 1.4 Non-goals

The initial version should **not** attempt to become a complete customs-clearance system, a legal tariff advisory service, a real-time global trade terminal, or a full-scale macroeconomic forecasting model. Machine learning is not required. Complex general-equilibrium trade modelling, retaliation modelling, exchange-rate forecasting, and country-level policy recommendations are possible future work, not MVP requirements.

---

## 2. Why This Is a Strong DBMS Project

The subject naturally produces connected entities, many-to-many relationships, time-dependent records, data integrity rules, analytical queries, and transactional workflows. It is more defensible as a DBMS project than an application where a database merely stores user profiles and CRUD records.

| DBMS topic | Concrete use in this project |
|---|---|
| ER modelling | Countries, products, trade observations, tariff schedules, agreements, scenarios, runs, and results |
| Normalization | Separate country facts, product descriptions, trade observations, policy records, and source metadata |
| Primary and foreign keys | Prevent orphaned trade observations and scenarios referring to nonexistent entities |
| Composite/business keys | Identify a trade observation by reporter, partner, product, period, flow, classification/source dimensions |
| Constraints | Non-negative values, valid dates, valid tariff ranges, valid status values, required relationships |
| Joins | Join trade values with countries/products/tariffs/agreements |
| Aggregation | Trade totals, balances, partner rankings, tariff summaries, year-over-year change |
| CTEs and window functions | Rank partners, calculate year-over-year growth, compare a country's performance over time |
| Views | Reusable summaries for trade balance, top partners, product performance, and tariff history |
| Stored functions/procedures | Reproducible scenario calculations and validation of inputs |
| Triggers/audit records | Record changes to policy records and important scenario-state transitions |
| Transactions | Save a scenario and its tariff changes/results atomically |
| Indexing | Optimize filters on reporter, partner, product, year, and effective dates |
| Query optimization | Compare `EXPLAIN (ANALYZE, BUFFERS)` results before and after selected indexes |
| Temporal modelling | Preserve tariff effective-from/effective-to dates and historical changes |
| Data quality/ETL | Stage, validate, deduplicate, and load downloaded data before it becomes trusted relational data |

**Design principle:** PostgreSQL should perform a meaningful part of the querying and business calculations. If almost all logic lives in a frontend or Pandas script and PostgreSQL is used only for simple storage, the project looks more like a dashboard/analytics project than a DBMS project.

---

## 3. Target Users and User Stories

### 3.1 Target users

- **Student/research user:** explores historical country-product trade patterns.
- **Policy analyst (prototype role):** creates and compares hypothetical tariff scenarios.
- **Administrator/data steward:** manages imports, checks data quality, and reviews audit history.

Authentication and role-based access control are useful extensions. For a time-limited college project, it is acceptable to keep the first version to a small number of roles and make the database features the priority.

### 3.2 User stories

1. As a user, I can select a reporter country, partner country, product, and period to inspect trade observations.
2. As a user, I can see a country's reported exports, imports, and trade balance by year.
3. As a user, I can inspect the tariff schedule applicable to a product and partner for a date.
4. As a user, I can create a named scenario and propose tariff rates without modifying base tariff records.
5. As a user, I can run a scenario, see the model assumptions, and store the result for later comparison.
6. As a user, I can compare two or more scenarios across import value, estimated tariff revenue, and import change.
7. As an administrator, I can see which source supplied a record and when a policy record was changed.
8. As a developer/evaluator, I can inspect the SQL, indexes, constraints, query plans, and transaction behaviour.

---

## 4. Core Features and Modules

### Module 1 — Global Trade Data Management

Store and browse country, product, source, and trade-observation data.

**Country data** can include country name, ISO identifiers, region, and optional income-group metadata. **Product data** should use Harmonized System (HS) codes together with the HS classification/version in which that code is defined. Product code alone is not always sufficient because product classifications can change across revisions.

A trade observation should capture at least:

- reporting country (reporter)
- partner country
- product/classification
- period (initially annual; monthly can be added later)
- flow direction (`EXPORT` or `IMPORT`)
- trade value and currency/unit convention
- optional quantity, quantity unit, and net weight
- source and ingestion batch

Example question: *What are India's top ten reported export partners for a selected product from 2020–2025?*

**Acceptance criteria:** users can filter and sort observations; invalid foreign keys are rejected; duplicate source observations are prevented or explicitly resolved; source and period metadata remain traceable.

### Module 2 — Historical Tariff Management

Store tariff rates as time-dependent records. A tariff record should identify the importing country, the partner scope where applicable, the product, the tariff type, the rate, the unit/rate basis, the source, and the period during which it is effective.

Do not overwrite an old tariff just because a new rate becomes effective. End-date the old record and insert a new one, preserving history. Where data supplies a general/MFN rate rather than a partner-specific rate, represent that scope explicitly rather than pretending it is partner-specific.

Example question: *What recorded tariff rate applied to this importer-product-partner combination on a particular date?*

**Important:** tariff schedules can distinguish MFN and preferential treatment, specific duties, ad valorem duties, and other forms. The MVP should focus on a clearly defined subset—preferably **ad valorem percentage tariffs**—and label data limitations visibly.

### Module 3 — Dynamic Tariff Simulation (Signature Feature)

Users create an isolated tariff scenario, enter one or more proposed rates, select a baseline period, choose or review model assumptions, and run the simulation. The system stores the scenario definition, model version, assumptions, timestamp, and results. A new scenario must never silently rewrite source tariff/trade data.

A run can return:

- baseline import customs value
- current and proposed tariff rates
- estimated import customs value under the proposed rate
- estimated tariff revenue before and after the change
- estimated percentage change in imports
- the assumptions/model version used
- data coverage or missing-baseline warnings

**Simulation model for an MVP:** a transparent constant-elasticity sensitivity model. Let:

- `M0` = baseline customs value of imports (excluding tariff duties)
- `t0` = current ad valorem tariff as a decimal (e.g. 25% = 0.25)
- `t1` = proposed ad valorem tariff as a decimal
- `epsilon` = assumed import-demand price elasticity, normally zero or negative; the chosen sign convention must be documented

Assuming a fixed world price, full pass-through of tariff into the landed price, and constant elasticity:

`M1 = M0 × ((1 + t1) / (1 + t0)) ^ epsilon`

Estimated tariff revenue is:

`R0 = M0 × t0`

`R1 = M1 × t1`

where `M1` is estimated customs import value after the change and `R0`/`R1` are simplified ad valorem tariff-revenue estimates. Store rates consistently as decimals in the database and show them as percentages in the UI.

**Illustrative example only:** if baseline customs import value is $1.2 billion and the current tariff is 25%, baseline revenue under this simplified arithmetic is $300 million. A proposed rate of 35% might reduce the estimated customs import value, depending on the elasticity assumption; revenue is then calculated using the proposed rate multiplied by the estimated post-change customs value. These example values are not empirical results.

**Sensitivity handling:** actual elasticity estimates may be unavailable. Instead of inventing a precise one, let users compare a small, labelled range of assumptions (for example, low-, medium-, and high-sensitivity scenarios), or require the user to enter an assumption. Clearly state that the output is a what-if estimate, not a causal forecast. It omits factors such as retaliation, substitution between suppliers, exchange rates, changes in global prices, supply responses, exemptions, and wider economic effects.

**Acceptance criteria:** a scenario can be created, validated, run, and compared; runs are repeatable under a saved model version; the assumptions are visible; base data is unchanged; failed runs do not leave partially written result rows.

### Module 4 — Trade Analytics

Provide database-backed analytics such as:

- top export/import partners by country, product, and period
- trade balance (`reported exports − reported imports`) for a selected reporter and period
- product-level trade composition
- year-over-year growth and multi-year trend summaries
- tariff rate history alongside trade observations
- countries with the highest observed trade value for a selected product
- filters for country, partner, product/HS chapter, period, flow, and source

Avoid double-counting global totals. A country's reported exports and its partner's reported imports may not match exactly due to reporting differences, valuation methods, timing, classification, and other statistical reasons. Analytics should state which reporter/flow is being used and should not silently sum duplicate mirror observations as if they were independent shipments.

### Module 5 — Policy Scenario Comparison

Let users compare multiple named scenarios against the same baseline and model assumptions. A useful comparison table includes:

| Metric | Baseline | Scenario A | Scenario B |
|---|---:|---:|---:|
| Current/proposed tariff | Current | Proposed rate | Proposed rate |
| Estimated customs import value | Baseline | Estimate | Estimate |
| Estimated tariff revenue | Baseline estimate | Estimate | Estimate |
| Estimated import change | 0% reference | Change | Change |
| Elasticity/model assumption | Stored value | Stored value | Stored value |

Only compare runs fairly when they use compatible baseline periods, units, and model assumptions; otherwise show a warning. Charts may visualize the comparisons but should not replace the underlying result records or SQL logic.

### Module 6 — DBMS Demonstration and Administration

This is a first-class part of the project, not a hidden implementation detail.

- normalized schema and ER diagram
- keys and constraints
- SQL query collection (basic to advanced)
- views for reusable analytics
- stored functions for selected business operations
- audit trigger or explicit audit-writing transaction
- scenario transaction with rollback on failure
- indexes justified by real query patterns
- query plan before/after selected indexes
- data validation and ingestion logs
- test cases showing that integrity constraints actually reject invalid data

---

## 5. Recommended Technology Stack

| Layer | Recommendation | Why it fits |
|---|---|---|
| Relational database | **PostgreSQL** | Strong relational constraints, joins, transactions, CTEs, window functions, views, stored functions, indexes, and query-plan inspection |
| Backend API | **Python + FastAPI** | Clear REST endpoints, validation, automatic API docs, and convenient integration with data ingestion/simulation code |
| ORM / database access | **SQLAlchemy 2.x** | Explicit models and database sessions while still allowing important queries/functions to be written and demonstrated as SQL |
| Schema migrations | **Alembic** | Version-controlled database schema changes instead of manual, undocumented edits |
| Validation | **Pydantic** | Request/response validation and useful error messages |
| Frontend | **React** | Component-based dashboard, filters, forms, scenario comparison, and interactive charts |
| Charts | **Plotly** or a React chart library | Trend and scenario-comparison plots; visualization is a presentation layer, not the source of analytical truth |
| Data ingestion | **Python, pandas, CSV/API clients** | Load public datasets into staging tables, clean types, validate codes, and record source metadata |
| Testing | **pytest + PostgreSQL test database** | Unit, API, SQL-integrity, transaction, and simulation tests |
| Version control | **Git + GitHub** | Reproducible team development, issue tracking, and project evidence |
| Deployment (optional) | Docker Compose | Reproducible local setup for frontend, API, and database; avoid making deployment a bigger task than the DBMS work |

### Why PostgreSQL over a document database?

The central entities have stable relationships and require referential integrity. Many project questions depend on joins, time filters, grouping, ranking, and multi-row transactional writes. PostgreSQL directly supports these use cases. JSON columns can still hold limited source metadata if useful, but trade facts and tariff schedules should be relational tables.

### Why not make Pandas the entire analytics engine?

Pandas is useful for ETL, data inspection, and selected model calculations, but the core trade summaries and policy lookups should be reproducible in PostgreSQL. A reviewer should be able to trace how a metric was computed from the SQL/query or versioned database function.

### Why not require machine learning?

The core value is relational data management and transparent what-if analysis. Adding ML without a clear requirement increases implementation risk and can dilute the DBMS learning objectives.

---

## 6. System Architecture

```text
┌───────────────────────────────────────────────────────┐
│                     React Frontend                    │
│ Dashboard | Trade Explorer | Tariff History | Scenarios│
└───────────────────────────┬───────────────────────────┘
                            │ HTTPS / JSON REST API
┌───────────────────────────▼───────────────────────────┐
│                    FastAPI Backend                    │
│ Request validation | Auth (optional) | Service layer  │
│ Trade queries | Scenario validation | Run management  │
└───────────────────────────┬───────────────────────────┘
                            │ SQLAlchemy / SQL
┌───────────────────────────▼───────────────────────────┐
│                    PostgreSQL DB                      │
│ Dimensions | Trade observations | Tariff schedules    │
│ Scenarios | Simulation runs/results | Audit records   │
│ Constraints | Views | Functions | Indexes             │
└───────────────────────────▲───────────────────────────┘
                            │
┌───────────────────────────┴───────────────────────────┐
│                 Data Ingestion / ETL                  │
│ CSV/API → staging → validation → deduplication        │
│ → normalized tables + batch/source metadata           │
└───────────────────────────▲───────────────────────────┘
                            │
              Public trade/tariff data sources
```

**Separation of responsibilities:**

- **PostgreSQL:** source of truth, constraints, joins, reporting queries, scenario persistence, auditability, and selected simulation calculations.
- **FastAPI:** validates requests, orchestrates transactions, invokes SQL/functions, handles API errors, and returns structured output.
- **React:** user input, filters, tables, charts, and scenario comparison.
- **ETL scripts:** acquire and validate source data before inserting it into trusted tables.

A small Python service-layer formula can calculate the numerical simulation if needed, but it should store inputs/outputs transactionally and keep the formula versioned and testable. To emphasize DBMS work, use PostgreSQL functions for key validation, lookups, or calculations where they are maintainable.

---

## 7. Relational Data Model

The following is a proposed logical schema. Exact fields can be adjusted after selecting a real dataset and understanding its classification, period, and tariff conventions.

### 7.1 Core tables

#### `country`

- `country_id` — primary key
- `iso3` — unique ISO alpha-3 code where available
- `country_name` — required country/area name
- `region` — optional grouping
- optional source code and metadata fields

#### `product`

- `product_id` — primary key
- `hs_code` — code represented as text so leading zeros are preserved
- `hs_version` — classification revision/version
- `product_description`
- optional `parent_hs_code` / chapter grouping
- unique key on `(hs_code, hs_version)`

#### `data_source`

- `source_id` — primary key
- `source_name`
- `source_url`
- `retrieved_at`
- `license_or_usage_note`
- `source_version` / dataset release where available

#### `ingestion_batch`

- `batch_id` — primary key
- `source_id` — foreign key
- `started_at`, `completed_at`
- `batch_status`
- `input_record_count`, `loaded_record_count`, `rejected_record_count`
- optional log/error summary

#### `trade_observation`

- `trade_id` — primary key
- `reporter_country_id` — foreign key to `country`
- `partner_country_id` — foreign key to `country`
- `product_id` — foreign key to `product`
- `period_year` (or a period key when monthly data is added)
- `flow_direction` — constrained to `EXPORT` or `IMPORT`
- `trade_value_usd` — value normalized to a documented currency basis
- optional `quantity`, `quantity_unit`, `net_weight_kg`
- `source_id` and/or `batch_id` — traceability
- `reported_at` / ingestion timestamp if needed

Use a suitable unique business key based on the selected source's dimensions, for example reporter + partner + product + period + flow + source/classification. Do not assume one universal key before inspecting the dataset: sources may include revisions, supplementary measures, or multiple units.

#### `tariff_policy`

- `tariff_policy_id` — primary key
- `importer_country_id` — foreign key to `country`
- `exporter_country_id` — nullable when the source record represents a general/MFN scope; use explicit, documented semantics for null
- `product_id` — foreign key to `product`
- `tariff_type` — for MVP, constrain to supported types such as `AD_VALOREM`
- `tariff_rate` — numeric decimal (e.g. 0.25, not 25)
- `rate_unit` / `duty_basis`
- `effective_from`, `effective_to` — inclusive/exclusive convention must be consistent and documented
- `source_id`, source reference, load batch
- optional agreement identifier or policy note

Historical records should be retained. Prevent invalid intervals and, where feasible, enforce that equivalent tariff scopes do not have overlapping effective date ranges. Preferential and general tariff scopes must not be conflated.

#### `trade_agreement`

- `agreement_id` — primary key
- `agreement_name`
- `effective_from`, `effective_to`
- optional official reference and notes

#### `agreement_member`

- `agreement_id` — foreign key
- `country_id` — foreign key
- composite primary key `(agreement_id, country_id)`

This resolves the many-to-many relationship between trade agreements and countries.

#### `tariff_scenario`

- `scenario_id` — primary key
- `scenario_name`
- `description`
- `created_by` (nullable if authentication is not included)
- `baseline_period`
- `scenario_status` — e.g. `DRAFT`, `READY`, `SIMULATED`, `ARCHIVED`
- `created_at`, `updated_at`

#### `scenario_tariff`

- `scenario_id` — foreign key
- `importer_country_id` — foreign key
- `exporter_country_id` — foreign key (or explicitly model partner scope if general rates are supported)
- `product_id` — foreign key
- `proposed_tariff_rate`
- composite primary key over scenario + importer + exporter/scope + product

This lets one scenario contain proposed rates for multiple products or trade relationships.

#### `simulation_run`

- `run_id` — primary key
- `scenario_id` — foreign key
- `model_name`, `model_version`
- `elasticity_assumption` (nullable only if another model is used)
- `baseline_period`, `run_at`, `run_status`
- optional warnings and execution metadata

Each re-run creates a new row. Do not overwrite prior results when assumptions change.

#### `simulation_result`

- `result_id` — primary key
- `run_id` — foreign key
- importer/exporter/product dimensions
- `baseline_import_value`
- `current_tariff_rate`, `proposed_tariff_rate`
- `estimated_import_value_after`
- `estimated_revenue_before`, `estimated_revenue_after`
- `estimated_import_change_pct`
- optional result status/warning/data quality indicator

#### `tariff_audit` (recommended)

- `audit_id` — primary key
- `tariff_policy_id`
- old/new rate and effective dates where applicable
- `changed_by`, `changed_at`, `operation`
- optional reason/reference

### 7.2 Relationship summary

- One country can be the reporter or partner in many trade observations.
- One product can appear in many trade observations and tariff policies.
- One country can have many tariff policies as importer; another country may be the partner scope.
- Trade agreements and countries have a many-to-many relationship through `agreement_member`.
- One scenario has many proposed tariff rows.
- One scenario can have many simulation runs; each run has multiple result rows.
- A source can contribute many observations and tariff records; each ingestion batch belongs to a source.

### 7.3 Text ER overview

```text
COUNTRY 1 ─────< TRADE_OBSERVATION >───── 1 COUNTRY
                       |
                       | N
                       v
                    PRODUCT
                       ^
                       | N
COUNTRY 1 ─────< TARIFF_POLICY >───── 0..1 PARTNER COUNTRY

TRADE_AGREEMENT >────< COUNTRY   (through AGREEMENT_MEMBER)

TARIFF_SCENARIO 1 ─────< SCENARIO_TARIFF
       |
       └───────────────< SIMULATION_RUN 1 ─────< SIMULATION_RESULT

DATA_SOURCE 1 ─────< INGESTION_BATCH
DATA_SOURCE 1 ─────< TRADE_OBSERVATION / TARIFF_POLICY
TARIFF_POLICY 1 ─────< TARIFF_AUDIT (where audited)
```

This is conceptual rather than a literal diagramming syntax; the final report should include a proper ER diagram made in an ER tool or diagram editor.

---

## 8. Normalization and Integrity Design

### 8.1 Normalization target

Target **Third Normal Form (3NF)** for the core transactional tables. Consider BCNF where the functional dependencies justify it. Do not denormalize simply to make a dashboard query easier; first implement a normalized source of truth and then consider views or materialized views for measured performance needs.

### 8.2 Example of why normalization matters

A single wide relation containing reporter name, partner name, region, product description, tariff rate, agreement name, and yearly trade values would duplicate country/product/agreement facts and create update, insertion, and deletion anomalies. Separating `country`, `product`, `trade_observation`, `tariff_policy`, and `trade_agreement` avoids repeating those facts across every observation.

### 8.3 Keys and constraints to demonstrate

- Primary key on each entity.
- Foreign keys from observations/policies/scenarios to their dimensions.
- Unique country identifiers and unique `(hs_code, hs_version)`.
- Check constraints for valid numeric ranges and allowed enumerated values.
- Required non-null fields.
- Date checks such as `effective_to > effective_from` where end dates are exclusive.
- A business uniqueness rule for trade observations that matches the chosen source.
- Prevention or detection of overlapping effective tariff intervals for equivalent policy scope.
- Explicit handling for missing/null values rather than silently substituting zero.

Example constraints (adapt names/types to the implementation):

```sql
CHECK (trade_value_usd >= 0)
CHECK (tariff_rate >= 0)
CHECK (tariff_rate <= 1) -- only if project scope sets a 100% maximum
CHECK (flow_direction IN ('IMPORT', 'EXPORT'))
CHECK (effective_to IS NULL OR effective_to > effective_from)
```

Do not use the `tariff_rate <= 1` constraint unless the project deliberately defines a maximum of 100%; some tariff schedules and duty structures can exceed that simple ceiling. A safer general rule is `tariff_rate >= 0` plus validation informed by the selected dataset.

---

## 9. SQL Deliverables and Examples

The following snippets demonstrate the intended style. They are illustrative and may require table aliases/column adjustments to match the final DDL.

### 9.1 Top partners for a reporter and flow

```sql
SELECT
    p.country_name AS partner_country,
    SUM(t.trade_value_usd) AS total_value_usd
FROM trade_observation AS t
JOIN country AS p
  ON p.country_id = t.partner_country_id
WHERE t.reporter_country_id = :reporter_id
  AND t.flow_direction = 'EXPORT'
  AND t.period_year BETWEEN :start_year AND :end_year
GROUP BY p.country_name
ORDER BY total_value_usd DESC
LIMIT 10;
```

### 9.2 Country trade balance by year

```sql
SELECT
    t.reporter_country_id,
    t.period_year,
    SUM(CASE WHEN t.flow_direction = 'EXPORT'
             THEN t.trade_value_usd ELSE 0 END)
  - SUM(CASE WHEN t.flow_direction = 'IMPORT'
             THEN t.trade_value_usd ELSE 0 END) AS reported_trade_balance_usd
FROM trade_observation AS t
WHERE t.reporter_country_id = :country_id
GROUP BY t.reporter_country_id, t.period_year
ORDER BY t.period_year;
```

This uses the same reporting country for imports and exports. It is a reported balance, and it is not necessarily identical to a value calculated by combining partners' mirror data.

### 9.3 Year-over-year growth using a window function

```sql
WITH yearly_exports AS (
    SELECT period_year, SUM(trade_value_usd) AS export_value
    FROM trade_observation
    WHERE reporter_country_id = :country_id
      AND flow_direction = 'EXPORT'
      AND product_id = :product_id
    GROUP BY period_year
), compared AS (
    SELECT
        period_year,
        export_value,
        LAG(export_value) OVER (ORDER BY period_year) AS previous_year_value
    FROM yearly_exports
)
SELECT
    period_year,
    export_value,
    previous_year_value,
    CASE WHEN previous_year_value IS NULL OR previous_year_value = 0
         THEN NULL
         ELSE 100.0 * (export_value - previous_year_value)
                    / previous_year_value
    END AS year_over_year_change_pct
FROM compared
ORDER BY period_year;
```

### 9.4 Effective tariff lookup

A policy lookup must respect the effective-date convention and partner scope. A simplified partner-specific lookup is:

```sql
SELECT tariff_rate, tariff_type, effective_from, effective_to
FROM tariff_policy
WHERE importer_country_id = :importer_id
  AND exporter_country_id = :exporter_id
  AND product_id = :product_id
  AND effective_from <= :as_of_date
  AND (effective_to IS NULL OR :as_of_date < effective_to)
ORDER BY effective_from DESC;
```

If the data includes MFN/general and preferential records, lookup precedence must be explicitly designed and tested. It should not be guessed by returning the first row.

### 9.5 Views

Recommended views include:

- `vw_country_year_trade_balance`
- `vw_top_trade_partners` (or a parameterized query rather than a view)
- `vw_product_trade_summary`
- `vw_tariff_history`
- `vw_scenario_latest_run`

A normal view stores a query definition, not a frozen copy of its data. A materialized view stores results and needs a refresh policy; use one only if performance measurement demonstrates a need.

### 9.6 Stored functions/procedures

A function or service operation such as `run_tariff_scenario(scenario_id, model_version, elasticity)` should:

1. validate that the scenario exists and contains tariff proposals;
2. verify that each proposal has a suitable baseline observation and current tariff;
3. apply the chosen model and unit conventions;
4. create a `simulation_run` record;
5. insert one result row per relevant country-partner-product combination;
6. record warnings for missing or unsupported data;
7. commit all rows together or roll back on failure.

Keep the formula and model version documented. Avoid silently defaulting missing tariffs or values to zero; a zero tariff and an unknown tariff are different states.

### 9.7 Trigger and audit demonstration

A PostgreSQL trigger can write old/new tariff values into `tariff_audit` on update. For a simpler and more easily understood audit trail, the API can also use an explicit transaction to insert the audit row. Whichever approach is chosen, explain why it is safe and test it. Do not create triggers that duplicate application work or hide essential business logic unexpectedly.

### 9.8 Transaction example

Creating a scenario and its proposals should be atomic:

```text
BEGIN
  INSERT tariff_scenario ...
  INSERT scenario_tariff ... (one or more rows)
  validate scenario contents
COMMIT

On any failure: ROLLBACK
```

An invalid foreign key, invalid rate, or failed validation should not leave an empty scenario with only some of its policy rows unless that is an intentional documented workflow.

### 9.9 Indexing and query-plan experiment

Candidate indexes should be chosen after observing actual filters and joins. For example:

```sql
CREATE INDEX idx_trade_reporter_year_flow
    ON trade_observation (reporter_country_id, period_year, flow_direction);

CREATE INDEX idx_trade_product_year
    ON trade_observation (product_id, period_year);

CREATE INDEX idx_trade_partner
    ON trade_observation (partner_country_id);

CREATE INDEX idx_tariff_scope_dates
    ON tariff_policy (importer_country_id, product_id, effective_from, effective_to);
```

The exact index definitions depend on query patterns, data size, and database statistics. A composite index helps when its leading columns align with common filters. Too many indexes increase storage and write cost.

For the report, run the same query before and after adding an appropriate index and capture:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT ...;
```

Discuss plan choice, estimated versus actual rows, execution time, buffer reads, and why the planner did or did not use the index. Do not claim an index improved performance unless the experiment shows it.

---

## 10. API Design (Suggested)

The API is a boundary around the database and simulation operations. Example endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/countries` | Country list/search |
| `GET` | `/api/products` | Product/HS code search |
| `GET` | `/api/trade` | Filtered trade observations with pagination |
| `GET` | `/api/analytics/top-partners` | Top partners for a selected reporter, flow, product, and period |
| `GET` | `/api/analytics/trade-balance` | Country/year trade balance series |
| `GET` | `/api/tariffs` | Tariff lookup/history by scope and date |
| `POST` | `/api/scenarios` | Create scenario metadata and proposals |
| `GET` | `/api/scenarios/{id}` | Scenario and proposed rates |
| `POST` | `/api/scenarios/{id}/runs` | Run simulation with explicit model assumptions |
| `GET` | `/api/scenarios/{id}/runs` | List historical runs |
| `GET` | `/api/runs/{run_id}/results` | Return result rows and warnings |
| `GET` | `/api/scenarios/compare?run_ids=...` | Compare compatible runs |
| `GET` | `/api/admin/ingestion-batches` | Inspect import status and data-quality counts |

Implement pagination for potentially large tables, validate IDs and ranges, use parameterized SQL/ORM expressions, and return structured errors. Do not interpolate untrusted text directly into SQL.

---

## 11. Frontend Pages and UX

### 11.1 Dashboard

Potential high-level indicators:

- selected country's reported exports/imports for the selected period
- reported trade balance
- top trade partners
- top product categories
- tariff-rate trend where data is available

Every card/chart should expose its date range, units, source, and selection context. Avoid presenting a global headline total if the dataset is only a subset.

### 11.2 Trade Explorer

Filters: reporter, partner, product/HS code, flow direction, year range, and source. Provide a sortable/paginated table and downloadable result CSV if time permits.

### 11.3 Tariff History

Show rate, tariff type, partner scope, effective dates, and source. Visually differentiate general/MFN from partner-specific rates if both are supported.

### 11.4 Tariff Simulator

Inputs: importer, exporter/partner scope, product, baseline period, proposed rate, and elasticity assumption. Outputs: baseline values, proposed values, estimated import change, estimated revenue change, and warnings. Label all assumptions clearly.

### 11.5 Scenario Comparison

Select multiple simulation runs, validate that their baselines/model assumptions are compatible, and compare tabular results with small charts. Keep the result data accessible in a table for auditability.

### 11.6 DBMS Evidence page (optional but useful for demo)

A page or report appendix can link to schema diagrams, query examples, index experiments, constraint tests, and ingestion statistics. You do not need to expose live SQL execution to end users; the purpose is to make the technical work easy to demonstrate to an evaluator.

---

## 12. Data Sources and ETL Plan

### 12.1 Candidate sources

- **UN Comtrade:** international merchandise trade statistics by product, partner, period, and flow; API access and availability limits depend on the API endpoint/account level. See [UN Comtrade API documentation](https://uncomtrade.org/docs/un-comtrade-api/) and [UN Comtrade database](https://comtrade.un.org/).
- **World Bank WITS:** access to trade, tariff, and non-tariff-measure information and analytical tools. See [WITS](https://wits.worldbank.org/) and the [WITS API introduction](https://wits.worldbank.org/witsapiintro.aspx?lang=en).

These sources are candidates, not a guarantee that every field needed for the chosen scenario is freely available in one consistent download. Check coverage, access limits, usage terms, classification version, units, missing periods, and permitted redistribution before committing to a source.

### 12.2 Recommended MVP data scope

To control complexity:

1. Select a limited set of countries (for example 8–15) or focus on one reporter country and its partners.
2. Select one clearly described product classification version and a manageable set of product codes.
3. Use annual trade observations for an initial multi-year window.
4. Use ad valorem tariff records only if reliable compatible data is available.
5. Keep the source's original record identifier/code and record the source/retrieval timestamp.
6. Use a small, clearly labelled sample dataset for development, then load the final validated subset.

### 12.3 ETL pipeline

```text
Download CSV/API response
          ↓
Raw file + metadata retained
          ↓
Staging tables / temporary files
          ↓
Type conversion and code normalization
          ↓
Validation: missing values, duplicates, ranges, referential codes
          ↓
Rejections and warnings logged
          ↓
Load dimensions (country/product/source)
          ↓
Load trade observations and tariff policies
          ↓
Record ingestion batch summary
```

Do not silently discard rejected rows. Save rejection reasons and counts so data-quality limitations can be explained. Do not assume missing trade value means zero trade. Do not assume exports reported by one country must match the partner's reported imports exactly.

---

## 13. Security, Reliability, and Data Quality

For a college MVP, keep the security design proportional but sound:

- Use environment variables for database credentials; do not commit `.env` files.
- Use parameterized SQL/ORM expressions.
- Validate all API inputs (IDs, periods, rates, date ranges, pagination limits).
- Use least-privilege database credentials for the application.
- If authentication is added, hash passwords using a suitable password-hashing implementation and enforce authorization on write endpoints.
- Keep database migrations in version control.
- Do not allow scenario endpoints to mutate source tariff records.
- Log import errors and simulation failures without exposing secrets.
- Use transactions for multi-row writes.
- Apply foreign-key and check constraints in the database even if the API also validates the inputs.
- Make all units explicit: currency, quantity, tariff-rate representation, period, and whether import values are customs values excluding duty.

---

## 14. Testing and Acceptance Criteria

### 14.1 Database tests

- Inserting a trade row with an invalid country/product ID fails.
- Duplicate observations matching the selected source's business key are rejected or handled by a documented upsert/revision policy.
- Negative trade values/rates are rejected when invalid under the chosen data convention.
- Invalid effective date intervals are rejected.
- Country/product foreign keys remain valid after data loads.
- Scenario rows cannot refer to a nonexistent scenario.
- A rollback removes all rows from a failed multi-row scenario write.
- The audit trail contains the required old/new values when a tariff policy changes.

### 14.2 Analytics tests

- Top-partner query returns the expected ranking for a small hand-checked fixture.
- Trade-balance calculations correctly subtract reported imports from reported exports for the same reporter and period.
- Year-over-year growth handles a missing previous year and a previous-year value of zero without division errors.
- Date-effective tariff lookup returns the correct row and does not return expired records.
- General and partner-specific tariffs follow the documented lookup precedence.

### 14.3 Simulation tests

- A proposed tariff equal to the current tariff yields no model-driven import change under the formula above (within numeric precision).
- Increasing the tariff with a negative elasticity lowers estimated import value under the stated assumptions.
- With a zero elasticity assumption, estimated import customs value stays constant while estimated duty revenue changes with the tariff rate.
- Rates are converted consistently between UI percentage and database decimal representation.
- Each run records the model version and inputs.
- A missing baseline is reported as missing, not silently treated as zero.
- Re-running with a different elasticity creates a separate run and preserves the earlier result.

### 14.4 Performance tests

- Measure at least two representative analytical queries before and after selected indexes.
- Capture query plans with `EXPLAIN (ANALYZE, BUFFERS)`.
- Report database size and row counts for the tested dataset.
- Explain that tiny datasets may not show index benefits because sequential scans can be optimal.

### 14.5 Suggested final acceptance checklist

- [ ] ER diagram and relational schema documented.
- [ ] Normalization rationale documented.
- [ ] Real or clearly labelled test data loaded with provenance.
- [ ] Constraints and foreign keys tested.
- [ ] At least 8–12 meaningful analytical SQL queries prepared.
- [ ] At least 3 views implemented where appropriate.
- [ ] At least one stored function/procedure or explicit database-centred simulation transaction demonstrated.
- [ ] Trigger/audit example implemented and tested.
- [ ] ACID/rollback scenario demonstrated.
- [ ] Indexing/query-plan comparison documented.
- [ ] Scenario assumptions and limitations visible in the UI/report.
- [ ] Multiple simulation runs can be compared.
- [ ] Setup instructions and reproducibility notes provided.

---

## 15. Feasible Implementation Plan

A sensible schedule for a small college team is a phased build; do not attempt every optional feature before the core schema works.

### Phase 1 — Scope and dataset (Week 1)

- Fix the product classification, years, countries, flow types, and allowed tariff types.
- Inspect sample source data and confirm units/access limitations.
- Write problem statement, requirements, and ER model.
- Decide the precise definition of each calculated metric.

**Output:** source/data decision, data dictionary, initial ER diagram.

### Phase 2 — Database foundation (Week 2)

- Implement DDL, primary/foreign keys, checks, and business uniqueness rules.
- Load country/product/source dimensions.
- Create staging and ingestion logs.
- Normalize and import the first validated dataset.

**Output:** populated PostgreSQL schema and data-quality summary.

### Phase 3 — SQL analytics (Week 3)

- Build partner rankings, balances, product summaries, year-over-year trends, and tariff-history queries.
- Implement reusable views.
- Test queries against known small examples.

**Output:** SQL script/queries folder and analytical query results.

### Phase 4 — Simulation and transaction logic (Week 4)

- Define the scenario model and assumptions.
- Implement scenario tables and run/result tables.
- Implement validation, atomic writes, saved model versions, and audit behaviour.
- Unit-test mathematical edge cases.

**Output:** repeatable scenario run flow.

### Phase 5 — API and UI (Weeks 5–6)

- Expose trade, tariff, analytics, scenario, and run-result endpoints.
- Build trade explorer, tariff history, simulator, and comparison pages.
- Add pagination, validation errors, units, and explanatory warnings.

**Output:** end-to-end working application.

### Phase 6 — DBMS evaluation and polish (Weeks 7–8)

- Add selected indexes based on observed access patterns.
- Capture before/after query plans.
- Complete data integrity and simulation tests.
- Prepare ERD, schema, SQL portfolio, architecture diagram, limitations, and viva notes.
- Test clean setup using README instructions.

**Output:** reproducible project, report evidence, presentation/demo.

For a shorter timeline, prioritize the database, SQL, and one working simulation workflow; simplify the UI rather than dropping the DBMS mechanisms.

---

## 16. Feasibility, Uniqueness, and Evaluation Ratings

Ratings assume that the project implements the planned relational schema, useful SQL, historical tariff handling, and a working scenario feature. Ratings are estimates of project potential, not grades or guarantees.

| Parameter | Rating | Rationale |
|---|---:|---|
| DBMS correlation | **9.5/10** | Natural relational structure and direct use of advanced SQL/database mechanisms |
| Technical depth | **9/10** | Can include normalization, temporal records, stored functions, triggers, transactions, indexing, and query plans |
| Uniqueness | **8.5–9/10** | More distinctive than standard library/hospital/shop CRUD projects; trade/tariff topic still needs good execution to stand out |
| Feasibility | **8/10** | Manageable if data scope and tariff types are restricted; source harmonization is the main risk |
| Implementation difficulty | **8/10** | Moderate-to-high due to data preparation, temporal policy rules, API/UI, and careful simulation design |
| Analytical capability | **9.5/10** | Joins, aggregations, ranking, growth, tariff history, and scenario comparisons fit naturally |
| Visualization potential | **9/10** | Trend charts, partner/product analysis, and scenario comparisons are intuitive |
| Viva potential | **10/10** | Many concrete decisions can be defended through DBMS concepts and measured experiments |
| Scalability discussion | **9/10** | Indexes, partitioning, query planning, staging, and materialized views provide future discussion points |
| Overall potential | **About 9/10** | Strong if PostgreSQL is central; weaker if it becomes only a dashboard over precomputed Pandas data |

### What determines the actual grade?

A sophisticated title cannot compensate for a superficial implementation. The project becomes strong when the team can demonstrate the schema, defend normalization, show non-trivial SQL, test integrity rules, run a transaction with rollback, explain an index/query plan, and show reproducible simulation assumptions/results.

---

## 17. Scope Management: Must-Have vs Optional

### Must-have (MVP)

1. PostgreSQL relational schema with country, product, trade observation, tariff policy, scenario, run, and result entities.
2. ETL/data import with source metadata and data-quality checks.
3. Trade explorer and at least 5 meaningful analytics queries.
4. Historical tariff lookup for a limited supported tariff type.
5. Scenario creation and reproducible what-if simulation.
6. Scenario comparison.
7. Constraints, views, transaction/rollback, audit example, indexes, and query-plan evidence.
8. README, ER diagram, data dictionary, test evidence, and demo script.

### Nice-to-have (only after MVP works)

- User authentication and role-based permissions.
- More granular monthly data.
- More product chapters/countries.
- Materialized views with refresh strategy.
- Table partitioning on period for large datasets.
- CSV exports and downloadable reports.
- Background jobs for large imports/simulations.
- Interactive trade network/map visualizations.
- Additional tariff types, trade agreement preferences, and more advanced economic models.

### Avoid in the first version

- A complex machine-learning model with no reliable training data.
- Live ingestion of every country/product/year.
- Treating a simple elasticity formula as a validated forecast.
- Adding many triggers without a clear integrity/audit purpose.
- Building a highly polished frontend before proving the SQL and schema.

---

## 18. Risks and Mitigations

| Risk | Why it matters | Mitigation |
|---|---|---|
| Inconsistent source data | Country-reported imports and partner-reported exports can differ | Keep reporter/flow/source dimensions; explain the selected measure; do not silently combine mirror records |
| Product-classification changes | The same numeric HS code may mean something different across revisions | Store classification version with product code; document mappings if versions are reconciled |
| Incomplete tariff coverage | Historical rate may be missing or may mix MFN/preferential scope | Limit scope, label gaps, and use explicit scope/precedence rules |
| Overly ambitious scope | Too many countries and product levels can consume the project schedule | Use a subset and annual data first |
| False precision in simulation | Results depend on elasticity and economic assumptions | Expose assumptions, store model version, provide sensitivity analysis, and label outputs as estimates |
| Database becomes passive storage | Project may be judged as analytics rather than DBMS | Keep complex analytics in SQL, show constraints/views/functions/transactions/indexes/query plans |
| Poor performance claims | Indexes may not help small datasets | Measure and report actual `EXPLAIN ANALYZE` results without overclaiming |
| Unit ambiguity | Trade values, quantities, rates, and duties can be mixed | Store and display units explicitly; test percentage/decimal conversion |

---

## 19. Suggested Repository Structure

```text
global-trade-tariff-simulator/
├── README.md
├── docs/
│   ├── architecture.md
│   ├── data_dictionary.md
│   ├── er_diagram.png
│   ├── sql_design.md
│   ├── simulation_model.md
│   └── query_plan_experiments.md
├── database/
│   ├── migrations/
│   ├── schema.sql
│   ├── seed_reference_data.sql
│   ├── views.sql
│   ├── functions.sql
│   ├── triggers.sql
│   └── analytics_queries.sql
├── etl/
│   ├── download_source.py
│   ├── validate_data.py
│   ├── load_postgres.py
│   └── requirements.txt
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── db/
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   └── package.json
├── tests/
│   ├── sql_integrity_tests.sql
│   └── fixtures/
├── docker-compose.yml
└── .env.example
```

This is a suggested structure; folders can be simplified depending on team size. Do not commit credentials, licensed source files that cannot be redistributed, or large raw datasets without checking their usage terms.

---

## 20. Suggested Demonstration Flow

A 5–7 minute demo can follow this sequence:

1. **Show the data model:** explain country/product dimensions and trade/tariff facts.
2. **Run a complex SQL query:** rank top partners or calculate annual trade balance.
3. **Show historical tariffs:** demonstrate an effective-date lookup and explain why history is retained.
4. **Create a scenario:** change a tariff for a selected importer-partner-product combination.
5. **Run simulation:** show baseline, proposed rate, elasticity assumption, estimated values, and caveats.
6. **Compare two scenarios:** explain that results are comparable only under compatible assumptions.
7. **Prove DBMS depth:** show a constraint rejection or rollback, an audit row, and an `EXPLAIN ANALYZE` before/after index comparison.

This demo sequence makes the relational database work visible instead of presenting only charts.

---

## 21. Viva / Evaluation Questions to Prepare

1. Why is PostgreSQL more suitable here than a document database?
2. What are the entities, relationships, cardinalities, and candidate keys in the ER model?
3. Why is `product` separated from `trade_observation`?
4. What functional dependencies support the chosen normalization level?
5. What is the difference between a primary key, candidate key, unique constraint, and foreign key?
6. Why preserve historical tariff rows instead of updating one rate in place?
7. How do you represent a general/MFN tariff separately from a partner-specific preferential tariff?
8. Why is an HS classification version stored with the product code?
9. How do your SQL window functions differ from a normal `GROUP BY`?
10. When should you use a normal view versus a materialized view?
11. Why may an index not improve every query?
12. What does `EXPLAIN (ANALYZE, BUFFERS)` tell you?
13. How does the scenario transaction preserve atomicity?
14. How does your audit mechanism capture policy history?
15. How do you stop duplicate rows during ETL?
16. What happens if the baseline tariff or trade value is missing?
17. What assumptions are used in your tariff simulation?
18. Why is the simulator an estimate rather than a forecast?
19. How do you prevent a scenario from mutating official tariff data?
20. What would change if the dataset grew from thousands to millions of observations?

---

## 22. Final Recommendation

Keep the project topic. Its distinguishing feature is not simply a global-trade dashboard; it is the combination of a normalized relational database, temporal tariff records, SQL-based analytics, and a versioned what-if scenario engine.

**Recommended build order:**

**PostgreSQL schema and constraints → data import/validation → analytical SQL and views → scenario tables and transaction logic → FastAPI → React UI → indexing experiments and final evidence.**

Do not reverse this order by spending most of the time on a dashboard before the database is sound.

### Short academic description

> A PostgreSQL-based relational decision-support system that integrates country/product reference data, historical international trade observations, and effective-dated tariff policies to deliver SQL-driven trade analytics and reproducible what-if tariff simulations. The system demonstrates normalization, integrity constraints, temporal data modelling, views, stored functions, transactions, auditing, indexing, and query optimization.

---

## 23. Reference Links

- [UN Comtrade database](https://comtrade.un.org/)
- [UN Comtrade API documentation](https://uncomtrade.org/docs/un-comtrade-api/)
- [UN Comtrade data documentation](https://uncomtrade.org/docs/content-of-data/)
- [World Integrated Trade Solution (WITS)](https://wits.worldbank.org/)
- [WITS API introduction and tariff data dimensions](https://wits.worldbank.org/witsapiintro.aspx?lang=en)
- [PostgreSQL documentation](https://www.postgresql.org/docs/)
- [FastAPI documentation](https://fastapi.tiangolo.com/)
- [SQLAlchemy documentation](https://docs.sqlalchemy.org/)
- [React documentation](https://react.dev/)

Before implementation, verify source coverage, API limits, usage terms, and classification mappings for the selected dataset.
