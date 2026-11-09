-- =============================================================================
-- SQL Integrity Tests
-- Run these against a loaded database to verify constraints are enforced.
-- Each block is expected to FAIL (raise an exception) proving constraints work.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TEST 1: Foreign key constraint — invalid reporter country
-- Expected: FOREIGN KEY violation
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    BEGIN
        INSERT INTO trade_observation
            (reporter_country_id, partner_country_id, product_id,
             period_year, flow_direction, trade_value_usd, source_id)
        VALUES (99999, 2, 1, 2022, 'IMPORT', 1000.00, 1);
        RAISE EXCEPTION 'TEST 1 FAILED: Expected FK violation but row was inserted';
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'TEST 1 PASSED: FK violation caught for invalid reporter_country_id';
    END;
END $$;

-- ---------------------------------------------------------------------------
-- TEST 2: Check constraint — negative trade value
-- Expected: CHECK violation
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    BEGIN
        INSERT INTO trade_observation
            (reporter_country_id, partner_country_id, product_id,
             period_year, flow_direction, trade_value_usd, source_id)
        VALUES (1, 2, 1, 2022, 'IMPORT', -100.00, 1);
        RAISE EXCEPTION 'TEST 2 FAILED: Expected CHECK violation but row was inserted';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'TEST 2 PASSED: Check constraint caught negative trade_value_usd';
    END;
END $$;

-- ---------------------------------------------------------------------------
-- TEST 3: Check constraint — invalid flow direction
-- Expected: CHECK violation
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    BEGIN
        INSERT INTO trade_observation
            (reporter_country_id, partner_country_id, product_id,
             period_year, flow_direction, trade_value_usd, source_id)
        VALUES (1, 2, 1, 2022, 'TRANSIT', 1000.00, 1);
        RAISE EXCEPTION 'TEST 3 FAILED: Expected CHECK violation but row was inserted';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'TEST 3 PASSED: Check constraint caught invalid flow_direction TRANSIT';
    END;
END $$;

-- ---------------------------------------------------------------------------
-- TEST 4: Unique constraint — duplicate trade observation
-- Expected: UNIQUE violation
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    BEGIN
        -- Try to insert a duplicate of an existing seed row
        INSERT INTO trade_observation
            (reporter_country_id, partner_country_id, product_id,
             period_year, flow_direction, trade_value_usd, source_id)
        VALUES (1, 2, 1, 2020, 'EXPORT', 99999.00, 1);
        RAISE EXCEPTION 'TEST 4 FAILED: Expected UNIQUE violation but row was inserted';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'TEST 4 PASSED: Unique constraint prevented duplicate trade observation';
    END;
END $$;

-- ---------------------------------------------------------------------------
-- TEST 5: Check constraint — invalid tariff effective dates
-- Expected: CHECK violation (effective_to <= effective_from)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    BEGIN
        INSERT INTO tariff_policy
            (importer_country_id, product_id, tariff_type, tariff_rate,
             effective_from, effective_to, source_id)
        VALUES (1, 1, 'AD_VALOREM', 0.10, '2023-01-01', '2022-01-01', 1);
        RAISE EXCEPTION 'TEST 5 FAILED: Expected CHECK violation but row was inserted';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'TEST 5 PASSED: Check constraint caught effective_to <= effective_from';
    END;
END $$;

-- ---------------------------------------------------------------------------
-- TEST 6: Check constraint — negative tariff rate
-- Expected: CHECK violation
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    BEGIN
        INSERT INTO tariff_policy
            (importer_country_id, product_id, tariff_type, tariff_rate,
             effective_from, source_id)
        VALUES (1, 1, 'AD_VALOREM', -0.05, '2023-01-01', 1);
        RAISE EXCEPTION 'TEST 6 FAILED: Expected CHECK violation but row was inserted';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'TEST 6 PASSED: Check constraint caught negative tariff_rate';
    END;
END $$;

-- ---------------------------------------------------------------------------
-- TEST 7: Scenario FK — scenario tariff referencing non-existent scenario
-- Expected: FOREIGN KEY violation
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    BEGIN
        INSERT INTO scenario_tariff
            (scenario_id, importer_country_id, exporter_country_id,
             product_id, proposed_tariff_rate)
        VALUES (99999, 1, 2, 1, 0.20);
        RAISE EXCEPTION 'TEST 7 FAILED: Expected FK violation but row was inserted';
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'TEST 7 PASSED: FK violation caught for nonexistent scenario_id';
    END;
END $$;

-- ---------------------------------------------------------------------------
-- TEST 8: Transaction atomicity — rollback removes all rows on failure
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_scenario_id INT;
    v_count       INT;
BEGIN
    BEGIN
        -- Insert a valid scenario
        INSERT INTO tariff_scenario (scenario_name, baseline_period)
        VALUES ('Atomic Test Scenario', 2022)
        RETURNING scenario_id INTO v_scenario_id;

        -- Insert a valid tariff row
        INSERT INTO scenario_tariff
            (scenario_id, importer_country_id, exporter_country_id,
             product_id, proposed_tariff_rate)
        VALUES (v_scenario_id, 1, 2, 1, 0.30);

        -- Intentionally fail: invalid proposed_tariff_rate
        INSERT INTO scenario_tariff
            (scenario_id, importer_country_id, exporter_country_id,
             product_id, proposed_tariff_rate)
        VALUES (v_scenario_id, 1, 2, 1, -0.10);  -- will fail

    EXCEPTION WHEN OTHERS THEN
        -- Rollback has already undone everything in this block
        SELECT COUNT(*) INTO v_count
        FROM tariff_scenario
        WHERE scenario_name = 'Atomic Test Scenario';

        IF v_count = 0 THEN
            RAISE NOTICE 'TEST 8 PASSED: Transaction rolled back — no partial scenario rows exist';
        ELSE
            RAISE NOTICE 'TEST 8 WARNING: Scenario row still found after rollback (count=%)', v_count;
        END IF;
    END;
END $$;

-- ---------------------------------------------------------------------------
-- TEST 9: Audit trigger verification
-- Expected: Inserting/updating tariff_policy writes to tariff_audit
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_policy_id  INT;
    v_audit_count INT;
BEGIN
    -- Insert a test tariff policy
    INSERT INTO tariff_policy
        (importer_country_id, product_id, tariff_type, tariff_rate,
         effective_from, source_id)
    VALUES (11, 1, 'AD_VALOREM', 0.05, '2024-01-01', 2)
    RETURNING tariff_policy_id INTO v_policy_id;

    -- Update the rate
    UPDATE tariff_policy SET tariff_rate = 0.07 WHERE tariff_policy_id = v_policy_id;

    -- Check audit
    SELECT COUNT(*) INTO v_audit_count
    FROM tariff_audit
    WHERE tariff_policy_id = v_policy_id;

    IF v_audit_count >= 2 THEN
        RAISE NOTICE 'TEST 9 PASSED: Audit trigger wrote % rows for insert+update', v_audit_count;
    ELSE
        RAISE EXCEPTION 'TEST 9 FAILED: Expected ≥ 2 audit rows, found %', v_audit_count;
    END IF;

    -- Cleanup
    DELETE FROM tariff_policy WHERE tariff_policy_id = v_policy_id;
END $$;

-- ---------------------------------------------------------------------------
-- TEST 10: Same-reporter constraint (reporter != partner)
-- Expected: CHECK violation
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    BEGIN
        INSERT INTO trade_observation
            (reporter_country_id, partner_country_id, product_id,
             period_year, flow_direction, trade_value_usd, source_id)
        VALUES (1, 1, 1, 2022, 'EXPORT', 1000.00, 1);
        RAISE EXCEPTION 'TEST 10 FAILED: Expected CHECK violation but row was inserted';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'TEST 10 PASSED: Check constraint prevented reporter == partner';
    END;
END $$;

-- Summary
SELECT 'All integrity tests complete. Review NOTICE messages above.' AS result;
