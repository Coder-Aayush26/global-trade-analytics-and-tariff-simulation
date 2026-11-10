-- =============================================================================
-- Stored Functions and Procedures
-- Global Trade Analytics & Dynamic Tariff Policy Simulation
-- =============================================================================

-- ---------------------------------------------------------------------------
-- F1: get_effective_tariff_rate
--     Returns the best tariff rate for importer-exporter-product on a given
--     date. Preferential (partner-specific) takes precedence over MFN.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_effective_tariff_rate(
    p_importer_id  INT,
    p_exporter_id  INT,
    p_product_id   INT,
    p_as_of_date   DATE
)
RETURNS TABLE (
    tariff_policy_id   INT,
    tariff_type        VARCHAR,
    tariff_rate        NUMERIC,
    tariff_rate_pct    NUMERIC,
    effective_from     DATE,
    effective_to       DATE,
    scope              TEXT
)
LANGUAGE sql
STABLE
AS $$
    -- Preferential (partner-specific) first, then MFN/general
    (
        SELECT
            tp.tariff_policy_id,
            tp.tariff_type,
            tp.tariff_rate,
            ROUND(tp.tariff_rate * 100, 4) AS tariff_rate_pct,
            tp.effective_from,
            tp.effective_to,
            'PREFERENTIAL' AS scope
        FROM tariff_policy AS tp
        WHERE tp.importer_country_id = p_importer_id
          AND tp.exporter_country_id = p_exporter_id
          AND tp.product_id          = p_product_id
          AND tp.effective_from     <= p_as_of_date
          AND (tp.effective_to IS NULL OR p_as_of_date < tp.effective_to)
          AND tp.tariff_type         = 'AD_VALOREM'
        ORDER BY tp.effective_from DESC
        LIMIT 1
    )
    UNION ALL
    (
        SELECT
            tp.tariff_policy_id,
            tp.tariff_type,
            tp.tariff_rate,
            ROUND(tp.tariff_rate * 100, 4),
            tp.effective_from,
            tp.effective_to,
            'MFN' AS scope
        FROM tariff_policy AS tp
        WHERE tp.importer_country_id = p_importer_id
          AND tp.exporter_country_id IS NULL         -- MFN / general rate
          AND tp.product_id          = p_product_id
          AND tp.effective_from     <= p_as_of_date
          AND (tp.effective_to IS NULL OR p_as_of_date < tp.effective_to)
          AND tp.tariff_type         = 'AD_VALOREM'
        ORDER BY tp.effective_from DESC
        LIMIT 1
    )
    ORDER BY scope DESC   -- PREFERENTIAL (P) sorts before MFN (M) descending
    LIMIT 1;
$$;

COMMENT ON FUNCTION get_effective_tariff_rate IS
  'Returns the in-force ad valorem tariff rate for a given importer-exporter-product-date.
   Preferential rates take precedence over MFN rates.';

-- ---------------------------------------------------------------------------
-- F2: run_tariff_scenario
--     Creates a simulation_run record and populates simulation_result rows
--     using the constant-elasticity model:
--         M1 = M0 * ((1+t1)/(1+t0))^epsilon
--         R0 = M0 * t0
--         R1 = M1 * t1
--     Runs atomically; on failure all rows are rolled back.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION run_tariff_scenario(
    p_scenario_id    INT,
    p_elasticity     NUMERIC DEFAULT -0.5,
    p_model_version  VARCHAR DEFAULT '1.0'
)
RETURNS INT   -- returns the new run_id
LANGUAGE plpgsql
AS $$
DECLARE
    v_run_id          INT;
    v_scenario        tariff_scenario%ROWTYPE;
    v_tariff_row      scenario_tariff%ROWTYPE;
    v_baseline_value  NUMERIC;
    v_current_rate    NUMERIC;
    v_m1              NUMERIC;
    v_r0              NUMERIC;
    v_r1              NUMERIC;
    v_change_pct      NUMERIC;
    v_status          VARCHAR(30);
    v_warning         TEXT;
BEGIN
    -- 1. Validate scenario exists
    SELECT * INTO v_scenario
    FROM tariff_scenario
    WHERE scenario_id = p_scenario_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Scenario % not found', p_scenario_id;
    END IF;

    -- 2. Check at least one proposed tariff row exists
    IF NOT EXISTS (
        SELECT 1 FROM scenario_tariff WHERE scenario_id = p_scenario_id
    ) THEN
        RAISE EXCEPTION 'Scenario % has no proposed tariff rows', p_scenario_id;
    END IF;

    -- 3. Create simulation_run record
    INSERT INTO simulation_run (
        scenario_id, model_name, model_version,
        elasticity_assumption, baseline_period, run_status
    )
    VALUES (
        p_scenario_id,
        'constant_elasticity',
        p_model_version,
        p_elasticity,
        v_scenario.baseline_period,
        'RUNNING'
    )
    RETURNING run_id INTO v_run_id;

    -- 4. Process each scenario_tariff row
    FOR v_tariff_row IN
        SELECT * FROM scenario_tariff WHERE scenario_id = p_scenario_id
    LOOP
        v_status  := 'OK';
        v_warning := NULL;

        -- 4a. Find baseline import value (M0)
        SELECT SUM(trade_value_usd) INTO v_baseline_value
        FROM trade_observation
        WHERE reporter_country_id = v_tariff_row.importer_country_id
          AND partner_country_id  = v_tariff_row.exporter_country_id
          AND product_id          = v_tariff_row.product_id
          AND period_year         = v_scenario.baseline_period
          AND flow_direction      = 'IMPORT';

        IF v_baseline_value IS NULL THEN
            v_status  := 'MISSING_BASELINE';
            v_warning := 'No baseline import observation found for period ' ||
                         v_scenario.baseline_period;
        END IF;

        -- 4b. Find current tariff rate (t0)
        SELECT tariff_rate INTO v_current_rate
        FROM get_effective_tariff_rate(
            v_tariff_row.importer_country_id,
            v_tariff_row.exporter_country_id,
            v_tariff_row.product_id,
            (v_scenario.baseline_period || '-12-31')::DATE
        )
        LIMIT 1;

        IF v_current_rate IS NULL AND v_status = 'OK' THEN
            v_status  := 'MISSING_TARIFF';
            v_warning := 'No current tariff found for baseline date';
        END IF;

        -- 4c. Apply constant-elasticity model (only when inputs are available)
        IF v_baseline_value IS NOT NULL AND v_current_rate IS NOT NULL THEN
            v_m1 := v_baseline_value *
                     POWER((1.0 + v_tariff_row.proposed_tariff_rate) /
                           (1.0 + v_current_rate),
                           p_elasticity);
            v_r0 := v_baseline_value * v_current_rate;
            v_r1 := v_m1 * v_tariff_row.proposed_tariff_rate;
            v_change_pct := CASE
                                WHEN v_baseline_value = 0 THEN NULL
                                ELSE 100.0 * (v_m1 - v_baseline_value) / v_baseline_value
                            END;
        ELSE
            v_m1 := NULL; v_r0 := NULL; v_r1 := NULL; v_change_pct := NULL;
        END IF;

        -- 4d. Insert result row
        INSERT INTO simulation_result (
            run_id,
            importer_country_id,
            exporter_country_id,
            product_id,
            baseline_import_value,
            current_tariff_rate,
            proposed_tariff_rate,
            estimated_import_value_after,
            estimated_revenue_before,
            estimated_revenue_after,
            estimated_import_change_pct,
            result_status,
            result_warning
        ) VALUES (
            v_run_id,
            v_tariff_row.importer_country_id,
            v_tariff_row.exporter_country_id,
            v_tariff_row.product_id,
            v_baseline_value,
            v_current_rate,
            v_tariff_row.proposed_tariff_rate,
            v_m1,
            v_r0,
            v_r1,
            v_change_pct,
            v_status,
            v_warning
        );
    END LOOP;

    -- 5. Mark run as COMPLETED
    UPDATE simulation_run
    SET run_status = 'COMPLETED'
    WHERE run_id = v_run_id;

    -- 6. Update scenario status
    UPDATE tariff_scenario
    SET scenario_status = 'SIMULATED', updated_at = NOW()
    WHERE scenario_id = p_scenario_id;

    RETURN v_run_id;

EXCEPTION WHEN OTHERS THEN
    -- Mark the run as failed if it was created; rollback will undo result rows
    IF v_run_id IS NOT NULL THEN
        UPDATE simulation_run
        SET run_status = 'FAILED',
            warnings   = SQLERRM
        WHERE run_id = v_run_id;
    END IF;
    RAISE;
END;
$$;

COMMENT ON FUNCTION run_tariff_scenario IS
  'Runs the constant-elasticity tariff simulation for a scenario.
   Creates a simulation_run + simulation_result rows atomically.
   Formula: M1 = M0 * ((1+t1)/(1+t0))^epsilon.';

-- ---------------------------------------------------------------------------
-- F3: validate_scenario
--     Returns a summary of potential issues before running a scenario.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_scenario(p_scenario_id INT)
RETURNS TABLE (
    issue_type   TEXT,
    description  TEXT,
    severity     TEXT
)
LANGUAGE sql
STABLE
AS $$
    -- Issue 1: no proposed tariff rows
    SELECT
        'NO_TARIFF_ROWS'     AS issue_type,
        'Scenario has no proposed tariff entries' AS description,
        'ERROR'              AS severity
    WHERE NOT EXISTS (
        SELECT 1 FROM scenario_tariff WHERE scenario_id = p_scenario_id
    )

    UNION ALL

    -- Issue 2: missing baseline observations
    SELECT
        'MISSING_BASELINE',
        'No baseline import observation for importer=' ||
            st.importer_country_id || ', exporter=' ||
            st.exporter_country_id || ', product=' ||
            st.product_id,
        'WARNING'
    FROM scenario_tariff AS st
    JOIN tariff_scenario AS ts ON ts.scenario_id = st.scenario_id
    WHERE st.scenario_id = p_scenario_id
      AND NOT EXISTS (
          SELECT 1 FROM trade_observation AS t
          WHERE t.reporter_country_id = st.importer_country_id
            AND t.partner_country_id  = st.exporter_country_id
            AND t.product_id          = st.product_id
            AND t.period_year         = ts.baseline_period
            AND t.flow_direction      = 'IMPORT'
      )

    UNION ALL

    -- Issue 3: proposed rate same as current rate (not an error, just informational)
    SELECT
        'UNCHANGED_RATE',
        'Proposed rate equals current tariff for product=' || st.product_id,
        'INFO'
    FROM scenario_tariff AS st
    JOIN tariff_scenario AS ts ON ts.scenario_id = st.scenario_id
    WHERE st.scenario_id = p_scenario_id
      AND EXISTS (
          SELECT 1 FROM get_effective_tariff_rate(
              st.importer_country_id,
              st.exporter_country_id,
              st.product_id,
              (ts.baseline_period || '-12-31')::DATE
          ) AS ef
          WHERE ABS(ef.tariff_rate - st.proposed_tariff_rate) < 0.000001
      );
$$;

COMMENT ON FUNCTION validate_scenario IS
  'Returns validation issues for a scenario before running simulation.';

-- ---------------------------------------------------------------------------
-- F4: get_yoy_growth
--     Year-over-year trade growth for a reporter, flow, and optional product.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_yoy_growth(
    p_reporter_id INT,
    p_flow        VARCHAR,
    p_product_id  INT DEFAULT NULL
)
RETURNS TABLE (
    period_year             SMALLINT,
    trade_value_usd         NUMERIC,
    previous_year_value     NUMERIC,
    yoy_change_pct          NUMERIC
)
LANGUAGE sql
STABLE
AS $$
WITH yearly AS (
    SELECT
        t.period_year,
        SUM(t.trade_value_usd) AS trade_value_usd
    FROM trade_observation AS t
    WHERE t.reporter_country_id = p_reporter_id
      AND t.flow_direction      = p_flow
      AND (p_product_id IS NULL OR t.product_id = p_product_id)
    GROUP BY t.period_year
),
compared AS (
    SELECT
        period_year,
        trade_value_usd,
        LAG(trade_value_usd) OVER (ORDER BY period_year) AS previous_year_value
    FROM yearly
)
SELECT
    period_year,
    trade_value_usd,
    previous_year_value,
    CASE
        WHEN previous_year_value IS NULL OR previous_year_value = 0 THEN NULL
        ELSE ROUND(100.0 * (trade_value_usd - previous_year_value)
                        / previous_year_value, 4)
    END AS yoy_change_pct
FROM compared
ORDER BY period_year;
$$;

COMMENT ON FUNCTION get_yoy_growth IS
  'Returns year-over-year trade growth using a window function. Handles NULL and zero base year.';
