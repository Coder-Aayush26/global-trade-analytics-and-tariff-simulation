-- =============================================================================
-- Seed Reference Data
-- Global Trade Analytics & Dynamic Tariff Policy Simulation
-- =============================================================================
-- Scope: 12 key countries, selected HS products, 2 data sources.
-- Trade observations and tariff data are loaded by ETL scripts.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Data Sources
-- ---------------------------------------------------------------------------
INSERT INTO data_source (source_id, source_name, source_url, retrieved_at, license_or_usage_note, source_version)
VALUES
    (1, 'UN Comtrade',
        'https://comtrade.un.org/',
        '2024-01-01',
        'Free Tier API data for educational use. Subject to UN Comtrade terms of use.',
        'BulkDownload_2024'),
    (2, 'World Bank WITS',
        'https://wits.worldbank.org/',
        '2024-01-01',
        'WITS tariff and trade data for educational use.',
        'WITS_2024')
ON CONFLICT (source_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Countries (12 major trading economies)
-- ---------------------------------------------------------------------------
INSERT INTO country (country_id, iso3, iso2, country_name, region, income_group) VALUES
    (1,  'USA', 'US', 'United States of America', 'North America',   'High income'),
    (2,  'CHN', 'CN', 'China',                    'East Asia',       'Upper middle income'),
    (3,  'DEU', 'DE', 'Germany',                  'Europe',          'High income'),
    (4,  'JPN', 'JP', 'Japan',                    'East Asia',       'High income'),
    (5,  'GBR', 'GB', 'United Kingdom',           'Europe',          'High income'),
    (6,  'FRA', 'FR', 'France',                   'Europe',          'High income'),
    (7,  'IND', 'IN', 'India',                    'South Asia',      'Lower middle income'),
    (8,  'BRA', 'BR', 'Brazil',                   'South America',   'Upper middle income'),
    (9,  'CAN', 'CA', 'Canada',                   'North America',   'High income'),
    (10, 'KOR', 'KR', 'South Korea',              'East Asia',       'High income'),
    (11, 'AUS', 'AU', 'Australia',                'Oceania',         'High income'),
    (12, 'MEX', 'MX', 'Mexico',                   'North America',   'Upper middle income')
ON CONFLICT (country_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Products (selected HS 2017 codes)
-- ---------------------------------------------------------------------------
INSERT INTO product (product_id, hs_code, hs_version, product_description, hs_chapter) VALUES
    -- Chapter 85: Electrical machinery
    (1,  '8517', 'HS2017', 'Telephone sets; smartphones and other communication apparatus', '85'),
    (2,  '8542', 'HS2017', 'Electronic integrated circuits (semiconductors)', '85'),
    (3,  '8528', 'HS2017', 'Monitors, projectors, and television receivers', '85'),
    -- Chapter 84: Machinery
    (4,  '8471', 'HS2017', 'Automatic data processing machines (computers)', '84'),
    (5,  '8703', 'HS2017', 'Motor cars and other motor vehicles (passenger)', '87'),
    -- Chapter 27: Mineral fuels
    (6,  '2709', 'HS2017', 'Petroleum oils and crude oils', '27'),
    (7,  '2711', 'HS2017', 'Petroleum gas and other gaseous hydrocarbons', '27'),
    -- Chapter 10: Cereals
    (8,  '1001', 'HS2017', 'Wheat and meslin', '10'),
    (9,  '1005', 'HS2017', 'Maize (corn)', '10'),
    -- Chapter 61-62: Clothing
    (10, '6109', 'HS2017', 'T-shirts, singlets and other vests, knitted or crocheted', '61'),
    -- Chapter 30: Pharmaceutical products
    (11, '3004', 'HS2017', 'Medicaments for therapeutic or prophylactic uses', '30'),
    -- Chapter 72: Iron and steel
    (12, '7208', 'HS2017', 'Flat-rolled products of iron or non-alloy steel, hot-rolled', '72')
ON CONFLICT (product_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Trade Agreements
-- ---------------------------------------------------------------------------
INSERT INTO trade_agreement (agreement_id, agreement_name, effective_from, official_ref) VALUES
    (1, 'USMCA (US-Mexico-Canada Agreement)',   '2020-07-01', 'USMCA 2020'),
    (2, 'EU Single Market / Customs Union',     '1993-01-01', 'EU Treaty'),
    (3, 'RCEP (Regional Comprehensive Economic Partnership)', '2022-01-01', 'RCEP 2022'),
    (4, 'India-South Korea CEPA',               '2010-01-01', 'India-Korea CEPA')
ON CONFLICT (agreement_id) DO NOTHING;

-- Agreement members
INSERT INTO agreement_member (agreement_id, country_id) VALUES
    -- USMCA
    (1, 1), (1, 9), (1, 12),
    -- EU (Germany, France, UK pre-Brexit note: UK left EU 2020)
    (2, 3), (2, 6),
    -- RCEP
    (3, 2), (3, 4), (3, 10), (3, 11),
    -- India-Korea CEPA
    (4, 7), (4, 10)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Ingestion batch (seed batch)
-- ---------------------------------------------------------------------------
INSERT INTO ingestion_batch (batch_id, source_id, started_at, completed_at,
    batch_status, input_record_count, loaded_record_count, rejected_record_count)
VALUES
    (1, 1, '2024-01-15 09:00:00+00', '2024-01-15 09:30:00+00',
     'COMPLETED', 500, 490, 10),
    (2, 2, '2024-01-15 10:00:00+00', '2024-01-15 10:15:00+00',
     'COMPLETED', 120, 118, 2)
ON CONFLICT (batch_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Sample Trade Observations (annual, USD millions, 2020-2023)
-- ---------------------------------------------------------------------------
-- USA exports to China: smartphones (product 1)
INSERT INTO trade_observation
    (reporter_country_id, partner_country_id, product_id, period_year,
     flow_direction, trade_value_usd, source_id, batch_id)
VALUES
    (1, 2, 1, 2020, 'EXPORT', 15200000000.00, 1, 1),
    (1, 2, 1, 2021, 'EXPORT', 16800000000.00, 1, 1),
    (1, 2, 1, 2022, 'EXPORT', 14500000000.00, 1, 1),
    (1, 2, 1, 2023, 'EXPORT', 13900000000.00, 1, 1),
-- China exports to USA: smartphones
    (2, 1, 1, 2020, 'EXPORT', 95000000000.00, 1, 1),
    (2, 1, 1, 2021, 'EXPORT', 102000000000.00, 1, 1),
    (2, 1, 1, 2022, 'EXPORT', 108000000000.00, 1, 1),
    (2, 1, 1, 2023, 'EXPORT', 97000000000.00, 1, 1),
-- USA imports from China: smartphones
    (1, 2, 1, 2020, 'IMPORT', 94000000000.00, 1, 1),
    (1, 2, 1, 2021, 'IMPORT', 101000000000.00, 1, 1),
    (1, 2, 1, 2022, 'IMPORT', 107000000000.00, 1, 1),
    (1, 2, 1, 2023, 'IMPORT', 96500000000.00, 1, 1),
-- India exports to USA: clothing
    (7, 1, 10, 2020, 'EXPORT', 3200000000.00, 1, 1),
    (7, 1, 10, 2021, 'EXPORT', 3800000000.00, 1, 1),
    (7, 1, 10, 2022, 'EXPORT', 4200000000.00, 1, 1),
    (7, 1, 10, 2023, 'EXPORT', 4500000000.00, 1, 1),
-- USA imports from India: clothing
    (1, 7, 10, 2020, 'IMPORT', 3100000000.00, 1, 1),
    (1, 7, 10, 2021, 'IMPORT', 3700000000.00, 1, 1),
    (1, 7, 10, 2022, 'IMPORT', 4100000000.00, 1, 1),
    (1, 7, 10, 2023, 'IMPORT', 4400000000.00, 1, 1),
-- Germany exports to USA: vehicles
    (3, 1, 5, 2020, 'EXPORT', 22000000000.00, 1, 1),
    (3, 1, 5, 2021, 'EXPORT', 24500000000.00, 1, 1),
    (3, 1, 5, 2022, 'EXPORT', 26000000000.00, 1, 1),
    (3, 1, 5, 2023, 'EXPORT', 25500000000.00, 1, 1),
-- USA imports from Germany: vehicles
    (1, 3, 5, 2020, 'IMPORT', 21800000000.00, 1, 1),
    (1, 3, 5, 2021, 'IMPORT', 24200000000.00, 1, 1),
    (1, 3, 5, 2022, 'IMPORT', 25800000000.00, 1, 1),
    (1, 3, 5, 2023, 'IMPORT', 25200000000.00, 1, 1),
-- USA imports from Canada: crude oil
    (1, 9, 6, 2020, 'IMPORT', 55000000000.00, 1, 1),
    (1, 9, 6, 2021, 'IMPORT', 68000000000.00, 1, 1),
    (1, 9, 6, 2022, 'IMPORT', 95000000000.00, 1, 1),
    (1, 9, 6, 2023, 'IMPORT', 88000000000.00, 1, 1),
-- India imports from China: electronics
    (7, 2, 1, 2020, 'IMPORT', 12000000000.00, 1, 1),
    (7, 2, 1, 2021, 'IMPORT', 14500000000.00, 1, 1),
    (7, 2, 1, 2022, 'IMPORT', 15800000000.00, 1, 1),
    (7, 2, 1, 2023, 'IMPORT', 16200000000.00, 1, 1),
-- India imports from China: semiconductors
    (7, 2, 2, 2020, 'IMPORT', 2500000000.00, 1, 1),
    (7, 2, 2, 2021, 'IMPORT', 3100000000.00, 1, 1),
    (7, 2, 2, 2022, 'IMPORT', 3800000000.00, 1, 1),
    (7, 2, 2, 2023, 'IMPORT', 4200000000.00, 1, 1)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Tariff Policies (ad valorem, historical)
-- Note: rates stored as decimals (0.25 = 25%)
-- ---------------------------------------------------------------------------
-- USA tariff on Chinese smartphones (progressive escalation)
INSERT INTO tariff_policy
    (importer_country_id, exporter_country_id, product_id,
     tariff_type, tariff_rate, rate_unit, effective_from, effective_to, source_id)
VALUES
    (1, 2, 1, 'AD_VALOREM', 0.075, '% ad valorem', '2017-01-01', '2018-07-05', 2),
    (1, 2, 1, 'AD_VALOREM', 0.100, '% ad valorem', '2018-07-06', '2019-05-09', 2),
    (1, 2, 1, 'AD_VALOREM', 0.125, '% ad valorem', '2019-05-10', '2020-01-14', 2),
    (1, 2, 1, 'AD_VALOREM', 0.150, '% ad valorem', '2020-01-15', NULL,         2),
-- USA MFN tariff on smartphones (general)
    (1, NULL, 1, 'AD_VALOREM', 0.000, '% ad valorem', '2000-01-01', NULL, 2),
-- USA tariff on clothing from India (MFN)
    (1, NULL, 10, 'AD_VALOREM', 0.120, '% ad valorem', '2000-01-01', NULL, 2),
-- USA tariff on German vehicles
    (1, 3, 5, 'AD_VALOREM', 0.025, '% ad valorem', '2000-01-01', NULL, 2),
-- USA MFN tariff on vehicles
    (1, NULL, 5, 'AD_VALOREM', 0.025, '% ad valorem', '2000-01-01', NULL, 2),
-- India tariff on Chinese smartphones
    (7, 2, 1, 'AD_VALOREM', 0.100, '% ad valorem', '2017-01-01', '2019-12-31', 2),
    (7, 2, 1, 'AD_VALOREM', 0.200, '% ad valorem', '2020-01-01', NULL,         2),
-- India MFN tariff on smartphones
    (7, NULL, 1, 'AD_VALOREM', 0.200, '% ad valorem', '2020-01-01', NULL, 2),
-- India tariff on Chinese semiconductors
    (7, 2, 2, 'AD_VALOREM', 0.000, '% ad valorem', '2017-01-01', NULL, 2),
-- USA tariff on Canadian crude oil (USMCA preferential = 0%)
    (1, 9, 6, 'AD_VALOREM', 0.000, '% ad valorem (USMCA)', '2020-07-01', NULL, 2),
-- USA MFN tariff on crude oil
    (1, NULL, 6, 'AD_VALOREM', 0.052, '% ad valorem', '2000-01-01', NULL, 2)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Sample Scenario (for demo / testing)
-- ---------------------------------------------------------------------------
INSERT INTO tariff_scenario
    (scenario_id, scenario_name, description, baseline_period, scenario_status)
VALUES
    (1,
     'India Electronics Tariff Hike Test',
     'What-if scenario: India raises tariff on Chinese smartphones from 20% to 30%. Baseline year 2022.',
     2022,
     'READY')
ON CONFLICT (scenario_id) DO NOTHING;

INSERT INTO scenario_tariff
    (scenario_id, importer_country_id, exporter_country_id, product_id, proposed_tariff_rate)
VALUES
    (1, 7, 2, 1, 0.30)   -- India (7) tariff on Chinese (2) smartphones (1) → 30%
ON CONFLICT DO NOTHING;
