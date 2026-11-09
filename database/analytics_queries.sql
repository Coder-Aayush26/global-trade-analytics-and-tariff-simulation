-- =============================================================================
-- Analytics Queries Portfolio
-- Global Trade Analytics & Dynamic Tariff Policy Simulation
-- =============================================================================
-- All queries use :param_name placeholders (replace with literals or bind params)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Q1: Top 10 export partners for a reporter country and product range
-- ---------------------------------------------------------------------------
SELECT
    p.country_name        AS partner_country,
    p.iso3                AS partner_iso3,
    SUM(t.trade_value_usd) AS total_export_value_usd
FROM trade_observation AS t
JOIN country AS p ON p.country_id = t.partner_country_id
WHERE t.reporter_country_id = :reporter_id          -- e.g. country_id for India
  AND t.flow_direction      = 'EXPORT'
  AND t.period_year BETWEEN :start_year AND :end_year
GROUP BY p.country_name, p.iso3
ORDER BY total_export_value_usd DESC
LIMIT 10;

-- ---------------------------------------------------------------------------
-- Q2: Annual reported trade balance for a country
-- ---------------------------------------------------------------------------
SELECT
    t.period_year,
    SUM(CASE WHEN t.flow_direction = 'EXPORT'
             THEN t.trade_value_usd ELSE 0 END)   AS exports_usd,
    SUM(CASE WHEN t.flow_direction = 'IMPORT'
             THEN t.trade_value_usd ELSE 0 END)   AS imports_usd,
    SUM(CASE WHEN t.flow_direction = 'EXPORT'
             THEN t.trade_value_usd ELSE 0 END)
  - SUM(CASE WHEN t.flow_direction = 'IMPORT'
             THEN t.trade_value_usd ELSE 0 END)   AS trade_balance_usd
FROM trade_observation AS t
WHERE t.reporter_country_id = :country_id
GROUP BY t.period_year
ORDER BY t.period_year;

-- ---------------------------------------------------------------------------
-- Q3: Year-over-year export growth (window function)
-- ---------------------------------------------------------------------------
WITH yearly_exports AS (
    SELECT period_year, SUM(trade_value_usd) AS export_value
    FROM trade_observation
    WHERE reporter_country_id = :country_id
      AND flow_direction       = 'EXPORT'
      AND product_id           = :product_id
    GROUP BY period_year
),
compared AS (
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
    CASE
        WHEN previous_year_value IS NULL OR previous_year_value = 0 THEN NULL
        ELSE ROUND(100.0 * (export_value - previous_year_value)
                        / previous_year_value, 4)
    END AS yoy_change_pct
FROM compared
ORDER BY period_year;

-- ---------------------------------------------------------------------------
-- Q4: Effective tariff lookup for a date
-- ---------------------------------------------------------------------------
SELECT tariff_rate, ROUND(tariff_rate*100,2) AS pct,
       tariff_type, effective_from, effective_to
FROM tariff_policy
WHERE importer_country_id = :importer_id
  AND product_id           = :product_id
  AND (exporter_country_id = :exporter_id OR exporter_country_id IS NULL)
  AND effective_from      <= :as_of_date
  AND (effective_to IS NULL OR :as_of_date < effective_to)
ORDER BY
    (exporter_country_id IS NULL) ASC,   -- preferential first (not null)
    effective_from DESC
LIMIT 1;

-- ---------------------------------------------------------------------------
-- Q5: Ranked import sources for a product and importer
-- ---------------------------------------------------------------------------
SELECT
    par.country_name AS exporter_country,
    par.iso3,
    t.period_year,
    SUM(t.trade_value_usd) AS import_value_usd,
    RANK() OVER (
        PARTITION BY t.period_year
        ORDER BY SUM(t.trade_value_usd) DESC
    ) AS source_rank
FROM trade_observation AS t
JOIN country AS par ON par.country_id = t.partner_country_id
WHERE t.reporter_country_id = :importer_id
  AND t.product_id           = :product_id
  AND t.flow_direction       = 'IMPORT'
  AND t.period_year BETWEEN :start_year AND :end_year
GROUP BY par.country_name, par.iso3, t.period_year
ORDER BY t.period_year, source_rank;

-- ---------------------------------------------------------------------------
-- Q6: Countries with the highest trade value for a product (global overview)
-- ---------------------------------------------------------------------------
SELECT
    r.country_name  AS reporter_country,
    t.flow_direction,
    t.period_year,
    SUM(t.trade_value_usd) AS total_value_usd
FROM trade_observation AS t
JOIN country AS r ON r.country_id = t.reporter_country_id
WHERE t.product_id   = :product_id
  AND t.period_year  = :year
GROUP BY r.country_name, t.flow_direction, t.period_year
ORDER BY total_value_usd DESC
LIMIT 20;

-- ---------------------------------------------------------------------------
-- Q7: Tariff rate trend for a specific importer-product over years
--     (uses effective dates to build a year-by-year series)
-- ---------------------------------------------------------------------------
WITH year_series AS (
    SELECT generate_series(:start_year, :end_year) AS yr
),
tariff_per_year AS (
    SELECT
        ys.yr,
        (
            SELECT tp.tariff_rate
            FROM tariff_policy AS tp
            WHERE tp.importer_country_id = :importer_id
              AND tp.product_id           = :product_id
              AND (tp.exporter_country_id = :exporter_id
                   OR tp.exporter_country_id IS NULL)
              AND tp.effective_from      <= (ys.yr || '-12-31')::DATE
              AND (tp.effective_to IS NULL
                   OR (ys.yr || '-12-31')::DATE < tp.effective_to)
            ORDER BY (tp.exporter_country_id IS NULL) ASC,
                     tp.effective_from DESC
            LIMIT 1
        ) AS tariff_rate
    FROM year_series AS ys
)
SELECT yr, tariff_rate, ROUND(tariff_rate * 100, 2) AS tariff_pct
FROM tariff_per_year
ORDER BY yr;

-- ---------------------------------------------------------------------------
-- Q8: Product composition of a country's exports (HS chapter level)
-- ---------------------------------------------------------------------------
SELECT
    p.hs_chapter,
    SUM(t.trade_value_usd)                         AS chapter_export_usd,
    ROUND(100.0 * SUM(t.trade_value_usd) /
          SUM(SUM(t.trade_value_usd)) OVER (), 2)  AS pct_of_total
FROM trade_observation AS t
JOIN product AS p ON p.product_id = t.product_id
WHERE t.reporter_country_id = :country_id
  AND t.flow_direction       = 'EXPORT'
  AND t.period_year          = :year
GROUP BY p.hs_chapter
ORDER BY chapter_export_usd DESC;

-- ---------------------------------------------------------------------------
-- Q9: Scenario comparison — side-by-side result rows for two runs
-- ---------------------------------------------------------------------------
SELECT
    res.importer_country_id,
    imp.country_name  AS importer,
    exp_c.country_name AS exporter,
    p.hs_code,
    p.product_description,
    res.baseline_import_value,
    res.current_tariff_rate,
    res.proposed_tariff_rate,
    res.estimated_import_value_after,
    res.estimated_revenue_before,
    res.estimated_revenue_after,
    res.estimated_import_change_pct,
    r.run_at,
    r.elasticity_assumption,
    s.scenario_name
FROM simulation_result AS res
JOIN simulation_run   AS r   ON r.run_id      = res.run_id
JOIN tariff_scenario  AS s   ON s.scenario_id = r.scenario_id
JOIN country          AS imp  ON imp.country_id  = res.importer_country_id
JOIN country          AS exp_c ON exp_c.country_id = res.exporter_country_id
JOIN product          AS p   ON p.product_id  = res.product_id
WHERE r.run_id IN (:run_id_1, :run_id_2)
ORDER BY s.scenario_id, p.hs_code;

-- ---------------------------------------------------------------------------
-- Q10: Data quality summary from ingestion batches
-- ---------------------------------------------------------------------------
SELECT
    ds.source_name,
    b.batch_id,
    b.started_at,
    b.completed_at,
    b.batch_status,
    b.input_record_count,
    b.loaded_record_count,
    b.rejected_record_count,
    ROUND(100.0 * b.rejected_record_count
               / NULLIF(b.input_record_count, 0), 2) AS rejection_rate_pct
FROM ingestion_batch AS b
JOIN data_source     AS ds ON ds.source_id = b.source_id
ORDER BY b.started_at DESC;

-- ---------------------------------------------------------------------------
-- Q11: Audit trail for a tariff policy record
-- ---------------------------------------------------------------------------
SELECT
    ta.audit_id,
    ta.operation,
    ta.old_tariff_rate,
    ROUND(ta.old_tariff_rate * 100, 2) AS old_pct,
    ta.new_tariff_rate,
    ROUND(ta.new_tariff_rate * 100, 2) AS new_pct,
    ta.old_effective_from,
    ta.new_effective_from,
    ta.old_effective_to,
    ta.new_effective_to,
    ta.changed_by,
    ta.changed_at
FROM tariff_audit AS ta
WHERE ta.tariff_policy_id = :tariff_policy_id
ORDER BY ta.changed_at;

-- ---------------------------------------------------------------------------
-- Q12: Running simulation and comparing results (with elasticity sensitivity)
-- ---------------------------------------------------------------------------
-- Compare two runs with different elasticity assumptions on the same scenario
SELECT
    r.run_id,
    r.elasticity_assumption,
    res.proposed_tariff_rate,
    ROUND(res.proposed_tariff_rate * 100, 2) AS proposed_pct,
    res.baseline_import_value,
    res.estimated_import_value_after,
    res.estimated_revenue_before,
    res.estimated_revenue_after,
    res.estimated_import_change_pct
FROM simulation_result AS res
JOIN simulation_run AS r ON r.run_id = res.run_id
WHERE r.scenario_id = :scenario_id
ORDER BY r.run_at DESC, res.product_id;
