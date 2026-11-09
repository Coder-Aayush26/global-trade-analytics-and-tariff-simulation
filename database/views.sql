-- =============================================================================
-- Views for Global Trade Analytics
-- =============================================================================

-- ---------------------------------------------------------------------------
-- V1: Country-year trade balance (reported, same reporter for both flows)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_country_year_trade_balance AS
SELECT
    r.country_id    AS reporter_country_id,
    r.country_name  AS reporter_country,
    t.period_year,
    SUM(CASE WHEN t.flow_direction = 'EXPORT'
             THEN t.trade_value_usd ELSE 0 END)   AS total_exports_usd,
    SUM(CASE WHEN t.flow_direction = 'IMPORT'
             THEN t.trade_value_usd ELSE 0 END)   AS total_imports_usd,
    SUM(CASE WHEN t.flow_direction = 'EXPORT'
             THEN t.trade_value_usd ELSE 0 END)
  - SUM(CASE WHEN t.flow_direction = 'IMPORT'
             THEN t.trade_value_usd ELSE 0 END)   AS reported_trade_balance_usd
FROM trade_observation AS t
JOIN country AS r ON r.country_id = t.reporter_country_id
GROUP BY r.country_id, r.country_name, t.period_year;

COMMENT ON VIEW vw_country_year_trade_balance IS
  'Reported trade balance per country and year. Uses same reporter for imports and exports.';

-- ---------------------------------------------------------------------------
-- V2: Top trade partners per reporter (all years; use WHERE in query layer)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_top_trade_partners AS
SELECT
    rep.country_id    AS reporter_country_id,
    rep.country_name  AS reporter_country,
    par.country_id    AS partner_country_id,
    par.country_name  AS partner_country,
    t.period_year,
    t.flow_direction,
    SUM(t.trade_value_usd)                         AS total_value_usd,
    RANK() OVER (
        PARTITION BY rep.country_id, t.period_year, t.flow_direction
        ORDER BY SUM(t.trade_value_usd) DESC
    )                                              AS partner_rank
FROM trade_observation AS t
JOIN country AS rep ON rep.country_id = t.reporter_country_id
JOIN country AS par ON par.country_id = t.partner_country_id
GROUP BY rep.country_id, rep.country_name,
         par.country_id, par.country_name,
         t.period_year, t.flow_direction;

COMMENT ON VIEW vw_top_trade_partners IS
  'Ranked trade partners per reporter, year, and flow direction.';

-- ---------------------------------------------------------------------------
-- V3: Product-level trade summary per country
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_product_trade_summary AS
SELECT
    r.country_id    AS reporter_country_id,
    r.country_name  AS reporter_country,
    p.product_id,
    p.hs_code,
    p.hs_version,
    p.product_description,
    p.hs_chapter,
    t.period_year,
    t.flow_direction,
    SUM(t.trade_value_usd)  AS total_value_usd,
    COUNT(*)                AS observation_count
FROM trade_observation AS t
JOIN country  AS r ON r.country_id  = t.reporter_country_id
JOIN product  AS p ON p.product_id  = t.product_id
GROUP BY r.country_id, r.country_name,
         p.product_id, p.hs_code, p.hs_version, p.product_description, p.hs_chapter,
         t.period_year, t.flow_direction;

COMMENT ON VIEW vw_product_trade_summary IS
  'Aggregated trade values per reporter, product, year, and flow.';

-- ---------------------------------------------------------------------------
-- V4: Tariff history (human-readable)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_tariff_history AS
SELECT
    tp.tariff_policy_id,
    imp.country_name   AS importer_country,
    imp.iso3           AS importer_iso3,
    exp_c.country_name AS exporter_country,
    exp_c.iso3         AS exporter_iso3,
    p.hs_code,
    p.hs_version,
    p.product_description,
    tp.tariff_type,
    tp.tariff_rate,
    ROUND(tp.tariff_rate * 100, 4) AS tariff_rate_pct,
    tp.rate_unit,
    tp.effective_from,
    tp.effective_to,
    tp.policy_note,
    ds.source_name,
    ta.agreement_name
FROM tariff_policy AS tp
JOIN country       AS imp   ON imp.country_id  = tp.importer_country_id
LEFT JOIN country  AS exp_c ON exp_c.country_id = tp.exporter_country_id
JOIN product       AS p     ON p.product_id    = tp.product_id
JOIN data_source   AS ds    ON ds.source_id    = tp.source_id
LEFT JOIN trade_agreement AS ta ON ta.agreement_id = tp.agreement_id;

COMMENT ON VIEW vw_tariff_history IS
  'Human-readable tariff records with country names and product descriptions.';

-- ---------------------------------------------------------------------------
-- V5: Scenario with its latest run summary
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_scenario_latest_run AS
SELECT DISTINCT ON (s.scenario_id)
    s.scenario_id,
    s.scenario_name,
    s.description,
    s.baseline_period,
    s.scenario_status,
    s.created_at,
    r.run_id               AS latest_run_id,
    r.run_at               AS latest_run_at,
    r.run_status           AS latest_run_status,
    r.model_name,
    r.model_version,
    r.elasticity_assumption,
    r.warnings             AS run_warnings
FROM tariff_scenario AS s
LEFT JOIN simulation_run AS r ON r.scenario_id = s.scenario_id
ORDER BY s.scenario_id, r.run_at DESC NULLS LAST;

COMMENT ON VIEW vw_scenario_latest_run IS
  'Each scenario joined to its most recent simulation run.';

-- ---------------------------------------------------------------------------
-- V6: Scenario comparison (all runs)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_scenario_comparison AS
SELECT
    s.scenario_id,
    s.scenario_name,
    r.run_id,
    r.run_at,
    r.elasticity_assumption,
    r.model_version,
    imp.country_name  AS importer_country,
    exp_c.country_name AS exporter_country,
    p.hs_code,
    p.product_description,
    res.baseline_import_value,
    res.current_tariff_rate,
    ROUND(res.current_tariff_rate  * 100, 4) AS current_tariff_pct,
    res.proposed_tariff_rate,
    ROUND(res.proposed_tariff_rate * 100, 4) AS proposed_tariff_pct,
    res.estimated_import_value_after,
    res.estimated_revenue_before,
    res.estimated_revenue_after,
    res.estimated_import_change_pct,
    res.result_status,
    res.result_warning
FROM simulation_result AS res
JOIN simulation_run   AS r   ON r.run_id      = res.run_id
JOIN tariff_scenario  AS s   ON s.scenario_id = r.scenario_id
JOIN country          AS imp  ON imp.country_id  = res.importer_country_id
JOIN country          AS exp_c ON exp_c.country_id = res.exporter_country_id
JOIN product          AS p   ON p.product_id  = res.product_id;

COMMENT ON VIEW vw_scenario_comparison IS
  'Full denormalized view for multi-scenario comparison across runs.';
