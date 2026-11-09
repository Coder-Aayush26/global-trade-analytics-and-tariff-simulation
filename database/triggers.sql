-- =============================================================================
-- Triggers and Audit Logging
-- Global Trade Analytics & Dynamic Tariff Policy Simulation
-- =============================================================================

-- ---------------------------------------------------------------------------
-- T1: Audit trigger on tariff_policy
--     Writes INSERT / UPDATE / DELETE operations to tariff_audit.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_tariff_policy_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO tariff_audit (
            tariff_policy_id,
            operation,
            old_tariff_rate,  new_tariff_rate,
            old_effective_from, new_effective_from,
            old_effective_to,   new_effective_to,
            changed_by, changed_at
        ) VALUES (
            NEW.tariff_policy_id,
            'I',
            NULL, NEW.tariff_rate,
            NULL, NEW.effective_from,
            NULL, NEW.effective_to,
            current_user, NOW()
        );
        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO tariff_audit (
            tariff_policy_id,
            operation,
            old_tariff_rate,  new_tariff_rate,
            old_effective_from, new_effective_from,
            old_effective_to,   new_effective_to,
            changed_by, changed_at
        ) VALUES (
            NEW.tariff_policy_id,
            'U',
            OLD.tariff_rate, NEW.tariff_rate,
            OLD.effective_from, NEW.effective_from,
            OLD.effective_to,   NEW.effective_to,
            current_user, NOW()
        );
        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO tariff_audit (
            tariff_policy_id,
            operation,
            old_tariff_rate,  new_tariff_rate,
            old_effective_from, new_effective_from,
            old_effective_to,   new_effective_to,
            changed_by, changed_at
        ) VALUES (
            OLD.tariff_policy_id,
            'D',
            OLD.tariff_rate, NULL,
            OLD.effective_from, NULL,
            OLD.effective_to,   NULL,
            current_user, NOW()
        );
        RETURN OLD;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS trig_tariff_policy_audit ON tariff_policy;
CREATE TRIGGER trig_tariff_policy_audit
    AFTER INSERT OR UPDATE OR DELETE ON tariff_policy
    FOR EACH ROW EXECUTE FUNCTION trg_tariff_policy_audit();

COMMENT ON TRIGGER trig_tariff_policy_audit ON tariff_policy IS
  'Writes every INSERT/UPDATE/DELETE on tariff_policy into tariff_audit.';

-- ---------------------------------------------------------------------------
-- T2: Auto-update updated_at timestamp on tariff_scenario
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trig_tariff_scenario_updated_at ON tariff_scenario;
CREATE TRIGGER trig_tariff_scenario_updated_at
    BEFORE UPDATE ON tariff_scenario
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

DROP TRIGGER IF EXISTS trig_country_updated_at ON country;
CREATE TRIGGER trig_country_updated_at
    BEFORE UPDATE ON country
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

DROP TRIGGER IF EXISTS trig_product_updated_at ON product;
CREATE TRIGGER trig_product_updated_at
    BEFORE UPDATE ON product
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

COMMENT ON FUNCTION trg_set_updated_at IS
  'Generic trigger function to auto-set updated_at on UPDATE.';
