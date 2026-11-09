-- =============================================================================
-- Global Trade Analytics & Dynamic Tariff Policy Simulation
-- PostgreSQL Schema (DDL)
-- Target: 3NF with BCNF where justified
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- for gen_random_uuid()

-- ---------------------------------------------------------------------------
-- 1. COUNTRY
--    One row per country / territory / reporting area.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS country (
    country_id    SERIAL        PRIMARY KEY,
    iso3          CHAR(3)       NOT NULL UNIQUE,          -- ISO 3166-1 alpha-3
    iso2          CHAR(2),                                -- optional alpha-2
    country_name  VARCHAR(200)  NOT NULL,
    region        VARCHAR(100),                           -- e.g. South Asia, Europe
    income_group  VARCHAR(60),                            -- World Bank grouping
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_country_iso3 CHECK (iso3 ~ '^[A-Z]{3}$')
);

COMMENT ON TABLE country IS
  'Reference dimension: countries and customs territories.';

-- ---------------------------------------------------------------------------
-- 2. PRODUCT  (Harmonized System codes)
--    Leading zeros are significant; store as text.
--    Unique key on (hs_code, hs_version) because the same numeric code can
--    mean different goods across HS revisions.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product (
    product_id          SERIAL        PRIMARY KEY,
    hs_code             VARCHAR(20)   NOT NULL,
    hs_version          VARCHAR(20)   NOT NULL,           -- e.g. 'HS2017', 'HS2022'
    product_description TEXT          NOT NULL,
    hs_chapter          VARCHAR(10),                      -- first 2 digits
    parent_hs_code      VARCHAR(20),                      -- for hierarchy
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_product_code_version UNIQUE (hs_code, hs_version),
    CONSTRAINT chk_hs_code_nonempty CHECK (LENGTH(TRIM(hs_code)) > 0)
);

COMMENT ON TABLE product IS
  'Reference dimension: HS product codes with classification version.';

-- ---------------------------------------------------------------------------
-- 3. DATA_SOURCE
--    Tracks each external data source (e.g. UN Comtrade, WITS).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS data_source (
    source_id           SERIAL        PRIMARY KEY,
    source_name         VARCHAR(200)  NOT NULL,
    source_url          TEXT,
    retrieved_at        DATE,
    license_or_usage_note TEXT,
    source_version      VARCHAR(100),                     -- dataset release / version tag
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE data_source IS
  'Catalogue of external data sources and their retrieval metadata.';

-- ---------------------------------------------------------------------------
-- 4. INGESTION_BATCH
--    One row per ETL run; records data quality counts.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ingestion_batch (
    batch_id              SERIAL        PRIMARY KEY,
    source_id             INT           NOT NULL REFERENCES data_source (source_id),
    started_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    completed_at          TIMESTAMPTZ,
    batch_status          VARCHAR(30)   NOT NULL DEFAULT 'RUNNING'
                            CHECK (batch_status IN ('RUNNING','COMPLETED','FAILED','PARTIAL')),
    input_record_count    INT           CHECK (input_record_count >= 0),
    loaded_record_count   INT           CHECK (loaded_record_count >= 0),
    rejected_record_count INT           CHECK (rejected_record_count >= 0),
    error_summary         TEXT,

    CONSTRAINT chk_batch_completed_after_started
        CHECK (completed_at IS NULL OR completed_at >= started_at)
);

COMMENT ON TABLE ingestion_batch IS
  'ETL run log; tracks data quality counts and status per ingestion batch.';

-- ---------------------------------------------------------------------------
-- 5. TRADE_OBSERVATION
--    Core fact table: one row per reporter-partner-product-period-flow.
--    Trade value is normalised to USD using the documented source convention.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trade_observation (
    trade_id             SERIAL        PRIMARY KEY,
    reporter_country_id  INT           NOT NULL REFERENCES country (country_id),
    partner_country_id   INT           NOT NULL REFERENCES country (country_id),
    product_id           INT           NOT NULL REFERENCES product (product_id),
    period_year          SMALLINT      NOT NULL,
    flow_direction       VARCHAR(10)   NOT NULL
                           CHECK (flow_direction IN ('IMPORT','EXPORT')),
    trade_value_usd      NUMERIC(20,4) NOT NULL
                           CHECK (trade_value_usd >= 0),
    quantity             NUMERIC(20,4),
    quantity_unit        VARCHAR(50),
    net_weight_kg        NUMERIC(20,4),
    source_id            INT           NOT NULL REFERENCES data_source (source_id),
    batch_id             INT           REFERENCES ingestion_batch (batch_id),
    reported_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    -- Business uniqueness: one observation per reporter-partner-product-year-flow-source
    CONSTRAINT uq_trade_observation
        UNIQUE (reporter_country_id, partner_country_id, product_id,
                period_year, flow_direction, source_id),

    CONSTRAINT chk_period_year
        CHECK (period_year BETWEEN 1900 AND 2100),

    CONSTRAINT chk_reporter_ne_partner
        CHECK (reporter_country_id <> partner_country_id)
);

CREATE INDEX IF NOT EXISTS idx_trade_reporter_year_flow
    ON trade_observation (reporter_country_id, period_year, flow_direction);

CREATE INDEX IF NOT EXISTS idx_trade_product_year
    ON trade_observation (product_id, period_year);

CREATE INDEX IF NOT EXISTS idx_trade_partner
    ON trade_observation (partner_country_id);

CREATE INDEX IF NOT EXISTS idx_trade_batch
    ON trade_observation (batch_id);

COMMENT ON TABLE trade_observation IS
  'Fact table: reported bilateral trade observations by country, product, year, and flow.';

-- ---------------------------------------------------------------------------
-- 6. TARIFF_POLICY
--    Time-dependent records. Old records are end-dated, not overwritten.
--    NULL exporter_country_id means a general / MFN rate.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tariff_policy (
    tariff_policy_id     SERIAL        PRIMARY KEY,
    importer_country_id  INT           NOT NULL REFERENCES country (country_id),
    exporter_country_id  INT           REFERENCES country (country_id), -- NULL = MFN
    product_id           INT           NOT NULL REFERENCES product (product_id),
    tariff_type          VARCHAR(30)   NOT NULL DEFAULT 'AD_VALOREM'
                           CHECK (tariff_type IN ('AD_VALOREM','SPECIFIC','MIXED','OTHER')),
    tariff_rate          NUMERIC(10,6) NOT NULL
                           CHECK (tariff_rate >= 0),                -- decimal; 0.25 = 25%
    rate_unit            VARCHAR(50),                               -- e.g. '% ad valorem'
    effective_from       DATE          NOT NULL,
    effective_to         DATE,                                      -- NULL = currently in force
    source_id            INT           NOT NULL REFERENCES data_source (source_id),
    batch_id             INT           REFERENCES ingestion_batch (batch_id),
    agreement_id         INT,                                       -- FK added after agreement table
    policy_note          TEXT,

    CONSTRAINT chk_tariff_dates
        CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE INDEX IF NOT EXISTS idx_tariff_scope_dates
    ON tariff_policy (importer_country_id, product_id, effective_from, effective_to);

CREATE INDEX IF NOT EXISTS idx_tariff_exporter
    ON tariff_policy (exporter_country_id);

COMMENT ON TABLE tariff_policy IS
  'Time-effective tariff records. Historical rates are preserved via end-dating.';

-- ---------------------------------------------------------------------------
-- 7. TRADE_AGREEMENT
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trade_agreement (
    agreement_id    SERIAL        PRIMARY KEY,
    agreement_name  VARCHAR(300)  NOT NULL,
    effective_from  DATE,
    effective_to    DATE,
    official_ref    VARCHAR(200),
    notes           TEXT,

    CONSTRAINT chk_agreement_dates
        CHECK (effective_to IS NULL OR effective_to > effective_from)
);

COMMENT ON TABLE trade_agreement IS
  'Named trade agreements (FTAs, customs unions, etc.).';

-- ---------------------------------------------------------------------------
-- 8. AGREEMENT_MEMBER  (many-to-many: agreement ↔ country)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agreement_member (
    agreement_id  INT  NOT NULL REFERENCES trade_agreement (agreement_id),
    country_id    INT  NOT NULL REFERENCES country (country_id),
    PRIMARY KEY (agreement_id, country_id)
);

COMMENT ON TABLE agreement_member IS
  'Resolves many-to-many relationship between trade agreements and countries.';

-- Add FK from tariff_policy to trade_agreement now that the table exists
ALTER TABLE tariff_policy
    ADD CONSTRAINT fk_tariff_agreement
        FOREIGN KEY (agreement_id) REFERENCES trade_agreement (agreement_id);

-- ---------------------------------------------------------------------------
-- 9. TARIFF_SCENARIO
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tariff_scenario (
    scenario_id      SERIAL        PRIMARY KEY,
    scenario_name    VARCHAR(300)  NOT NULL,
    description      TEXT,
    created_by       VARCHAR(200),                        -- nullable (no auth required for MVP)
    baseline_period  SMALLINT      NOT NULL
                       CHECK (baseline_period BETWEEN 1900 AND 2100),
    scenario_status  VARCHAR(20)   NOT NULL DEFAULT 'DRAFT'
                       CHECK (scenario_status IN ('DRAFT','READY','SIMULATED','ARCHIVED')),
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE tariff_scenario IS
  'User-defined what-if tariff scenarios. Never mutates official tariff records.';

-- ---------------------------------------------------------------------------
-- 10. SCENARIO_TARIFF  (proposed rates per scenario)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scenario_tariff (
    scenario_id           INT           NOT NULL REFERENCES tariff_scenario (scenario_id)
                            ON DELETE CASCADE,
    importer_country_id   INT           NOT NULL REFERENCES country (country_id),
    exporter_country_id   INT           NOT NULL REFERENCES country (country_id),
    product_id            INT           NOT NULL REFERENCES product (product_id),
    proposed_tariff_rate  NUMERIC(10,6) NOT NULL
                            CHECK (proposed_tariff_rate >= 0),
    PRIMARY KEY (scenario_id, importer_country_id, exporter_country_id, product_id)
);

COMMENT ON TABLE scenario_tariff IS
  'Proposed tariff rates within a scenario. Isolated from official tariff_policy.';

-- ---------------------------------------------------------------------------
-- 11. SIMULATION_RUN
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS simulation_run (
    run_id                SERIAL        PRIMARY KEY,
    scenario_id           INT           NOT NULL REFERENCES tariff_scenario (scenario_id),
    model_name            VARCHAR(100)  NOT NULL DEFAULT 'constant_elasticity_v1',
    model_version         VARCHAR(50)   NOT NULL DEFAULT '1.0',
    elasticity_assumption NUMERIC(8,4),                    -- e.g. -0.5; NULL if model differs
    baseline_period       SMALLINT      NOT NULL,
    run_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    run_status            VARCHAR(20)   NOT NULL DEFAULT 'PENDING'
                            CHECK (run_status IN ('PENDING','RUNNING','COMPLETED','FAILED')),
    warnings              TEXT,
    execution_notes       TEXT
);

COMMENT ON TABLE simulation_run IS
  'Each simulation run is a separate row; prior runs are never overwritten.';

-- ---------------------------------------------------------------------------
-- 12. SIMULATION_RESULT
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS simulation_result (
    result_id                    SERIAL        PRIMARY KEY,
    run_id                       INT           NOT NULL REFERENCES simulation_run (run_id),
    importer_country_id          INT           NOT NULL REFERENCES country (country_id),
    exporter_country_id          INT           NOT NULL REFERENCES country (country_id),
    product_id                   INT           NOT NULL REFERENCES product (product_id),
    baseline_import_value        NUMERIC(20,4),            -- M0 (USD)
    current_tariff_rate          NUMERIC(10,6),            -- t0 (decimal)
    proposed_tariff_rate         NUMERIC(10,6),            -- t1 (decimal)
    estimated_import_value_after NUMERIC(20,4),            -- M1 (USD)
    estimated_revenue_before     NUMERIC(20,4),            -- R0 = M0 * t0
    estimated_revenue_after      NUMERIC(20,4),            -- R1 = M1 * t1
    estimated_import_change_pct  NUMERIC(10,4),            -- (M1-M0)/M0 * 100
    result_status                VARCHAR(30)  DEFAULT 'OK'
                                   CHECK (result_status IN ('OK','MISSING_BASELINE',
                                          'MISSING_TARIFF','PARTIAL','ERROR')),
    result_warning               TEXT
);

COMMENT ON TABLE simulation_result IS
  'Per-row result for each importer-exporter-product combination in a run.';

-- ---------------------------------------------------------------------------
-- 13. TARIFF_AUDIT
--    Written by trigger on tariff_policy UPDATE.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tariff_audit (
    audit_id         SERIAL        PRIMARY KEY,
    tariff_policy_id INT           NOT NULL,               -- not FK so history survives delete
    operation        CHAR(1)       NOT NULL CHECK (operation IN ('I','U','D')),
    old_tariff_rate  NUMERIC(10,6),
    new_tariff_rate  NUMERIC(10,6),
    old_effective_from DATE,
    new_effective_from DATE,
    old_effective_to   DATE,
    new_effective_to   DATE,
    changed_by       VARCHAR(200),
    changed_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    reason           TEXT
);

COMMENT ON TABLE tariff_audit IS
  'Immutable audit trail for tariff_policy changes (insert/update/delete).';

-- =============================================================================
-- Done
-- =============================================================================
