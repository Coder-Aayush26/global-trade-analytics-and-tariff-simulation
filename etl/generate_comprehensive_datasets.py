"""
ETL Data Generator & Ingestion Script for Global Trade & Tariff Analytics
Generates comprehensive, realistic, multi-year international trade datasets
based on UN Comtrade, World Bank WITS, and WTO Tariff Schedules (2018-2023).
"""

import sys
import os
import random
from typing import List, Dict, Tuple

# ---------------------------------------------------------------------------
# 1. Countries (30 Major Sovereign Economies)
# ---------------------------------------------------------------------------
COUNTRIES = [
    (1,  'USA', 'US', 'United States of America', 'North America',          'High income'),
    (2,  'CHN', 'CN', 'China',                    'East Asia',               'Upper middle income'),
    (3,  'DEU', 'DE', 'Germany',                  'Europe',                  'High income'),
    (4,  'JPN', 'JP', 'Japan',                    'East Asia',               'High income'),
    (5,  'GBR', 'GB', 'United Kingdom',           'Europe',                  'High income'),
    (6,  'FRA', 'FR', 'France',                   'Europe',                  'High income'),
    (7,  'IND', 'IN', 'India',                    'South Asia',              'Lower middle income'),
    (8,  'BRA', 'BR', 'Brazil',                   'South America',           'Upper middle income'),
    (9,  'CAN', 'CA', 'Canada',                   'North America',           'High income'),
    (10, 'KOR', 'KR', 'South Korea',              'East Asia',               'High income'),
    (11, 'AUS', 'AU', 'Australia',                'Oceania',                 'High income'),
    (12, 'MEX', 'MX', 'Mexico',                   'North America',           'Upper middle income'),
    (13, 'ITA', 'IT', 'Italy',                    'Europe',                  'High income'),
    (14, 'ESP', 'ES', 'Spain',                    'Europe',                  'High income'),
    (15, 'NLD', 'NL', 'Netherlands',              'Europe',                  'High income'),
    (16, 'SAU', 'SA', 'Saudi Arabia',             'Middle East',             'High income'),
    (17, 'SGP', 'SG', 'Singapore',                'East Asia & Pacific',     'High income'),
    (18, 'VNM', 'VN', 'Vietnam',                  'East Asia & Pacific',     'Lower middle income'),
    (19, 'IDN', 'ID', 'Indonesia',                'East Asia & Pacific',     'Upper middle income'),
    (20, 'CHE', 'CH', 'Switzerland',              'Europe',                  'High income'),
    (21, 'TUR', 'TR', 'Turkey',                   'Europe / Middle East',    'Upper middle income'),
    (22, 'ZAF', 'ZA', 'South Africa',             'Sub-Saharan Africa',      'Upper middle income'),
    (23, 'ARG', 'AR', 'Argentina',                'South America',           'Upper middle income'),
    (24, 'EGY', 'EG', 'Egypt',                    'Middle East & North Africa', 'Lower middle income'),
    (25, 'RUS', 'RU', 'Russia',                   'Europe / Eurasia',        'Upper middle income'),
    (26, 'ARE', 'AE', 'United Arab Emirates',     'Middle East',             'High income'),
    (27, 'MYS', 'MY', 'Malaysia',                 'East Asia & Pacific',     'Upper middle income'),
    (28, 'THA', 'TH', 'Thailand',                 'East Asia & Pacific',     'Upper middle income'),
    (29, 'POL', 'PL', 'Poland',                   'Europe',                  'High income'),
    (30, 'SWE', 'SE', 'Sweden',                   'Europe',                  'High income'),
]

# ---------------------------------------------------------------------------
# 2. Products (20 Standardized HS2017 Codes)
# ---------------------------------------------------------------------------
PRODUCTS = [
    (1,  '8517', 'HS2017', 'Telephone sets; smartphones and other communication apparatus', '85'),
    (2,  '8542', 'HS2017', 'Electronic integrated circuits (semiconductors, microprocessors)', '85'),
    (3,  '8528', 'HS2017', 'Monitors, projectors, and television receivers', '85'),
    (4,  '8471', 'HS2017', 'Automatic data processing machines (computers and servers)', '84'),
    (5,  '8703', 'HS2017', 'Motor cars and other motor vehicles (passenger vehicles)', '87'),
    (6,  '2709', 'HS2017', 'Petroleum oils and crude oils from bituminous minerals', '27'),
    (7,  '2711', 'HS2017', 'Petroleum gas and other gaseous hydrocarbons (LNG, LPG)', '27'),
    (8,  '1001', 'HS2017', 'Wheat and meslin', '10'),
    (9,  '1005', 'HS2017', 'Maize (corn)', '10'),
    (10, '6109', 'HS2017', 'T-shirts, singlets and other vests, knitted or crocheted', '61'),
    (11, '3004', 'HS2017', 'Medicaments for therapeutic or prophylactic uses', '30'),
    (12, '7208', 'HS2017', 'Flat-rolled products of iron or non-alloy steel, hot-rolled', '72'),
    (13, '8708', 'HS2017', 'Parts and accessories of motor vehicles', '87'),
    (14, '2710', 'HS2017', 'Petroleum oils, refined (gasoline, diesel, kerosene)', '27'),
    (15, '1201', 'HS2017', 'Soya beans, whether or not broken', '12'),
    (16, '2601', 'HS2017', 'Iron ores and concentrates, including roasted iron pyrites', '26'),
    (17, '8541', 'HS2017', 'Semiconductor devices; photovoltaic cells (solar cells)', '85'),
    (18, '9018', 'HS2017', 'Instruments and appliances used in medical or surgical sciences', '90'),
    (19, '8802', 'HS2017', 'Powered aircraft (airplanes, spacecraft, helicopters)', '88'),
    (20, '7108', 'HS2017', 'Gold, unwrought or in semi-manufactured forms', '71'),
]

# ---------------------------------------------------------------------------
# 3. Data Sources
# ---------------------------------------------------------------------------
DATA_SOURCES = [
    (1, 'UN Comtrade', 'https://comtradeplus.un.org/', '2024-01-01', 'Official UN International Merchandise Trade Statistics (IMTS)', 'BulkDownload_2024'),
    (2, 'World Bank WITS', 'https://wits.worldbank.org/', '2024-01-01', 'World Integrated Trade Solution - Trade and Tariff Database', 'WITS_2024'),
    (3, 'WTO Tariff Download Facility', 'https://www.wto.org/english/tratop_e/tariffs_e/tariff_data_e.htm', '2024-01-01', 'WTO Integrated Database (IDB) & Consolidated Tariff Schedules (CTS)', 'WTO_CTS_2024'),
    (4, 'OECD BTDIxE', 'https://www.oecd.org/sti/ind/bilateraltradeingoodsbyindustryandend-usecategory.htm', '2024-01-01', 'OECD Bilateral Trade in Goods by Industry and End-use', 'OECD_2024'),
]

# ---------------------------------------------------------------------------
# 4. Ingestion Batches
# ---------------------------------------------------------------------------
BATCHES = [
    (1, 1, '2024-01-15 09:00:00+00', '2024-01-15 09:30:00+00', 'COMPLETED', 500, 490, 10, 'Seed baseline batch'),
    (2, 2, '2024-01-15 10:00:00+00', '2024-01-15 10:15:00+00', 'COMPLETED', 120, 118, 2, 'WITS Seed Tariffs'),
    (101, 1, '2024-02-01 08:00:00+00', '2024-02-01 08:45:00+00', 'COMPLETED', 1500, 1500, 0, 'UN Comtrade Global Bilateral Matrix 2018-2023 Ingestion'),
    (102, 2, '2024-02-01 09:00:00+00', '2024-02-01 09:20:00+00', 'COMPLETED', 450, 450, 0, 'WITS & WTO Statutory Applied & Preferential Tariffs Ingestion'),
    (103, 3, '2024-02-01 09:30:00+00', '2024-02-01 09:40:00+00', 'COMPLETED', 180, 180, 0, 'WTO Section 301 and Multilateral FTA Schedules Ingestion')
]

# ---------------------------------------------------------------------------
# 5. Trade Agreements & Members
# ---------------------------------------------------------------------------
TRADE_AGREEMENTS = [
    (1, 'USMCA (US-Mexico-Canada Agreement)', '2020-07-01', None, 'USMCA 2020', 'Comprehensive NAFTA modernization'),
    (2, 'EU Single Market & Customs Union', '1993-01-01', None, 'Treaty of Maastricht / TFEU', 'European common customs territory with 0% internal duties'),
    (3, 'RCEP (Regional Comprehensive Economic Partnership)', '2022-01-01', None, 'RCEP 2022', 'Asia-Pacific megaregional trade bloc'),
    (4, 'India-South Korea CEPA', '2010-01-01', None, 'India-Korea CEPA', 'Comprehensive Economic Partnership Agreement'),
    (5, 'CPTPP (Comprehensive & Progressive Trans-Pacific Partnership)', '2018-12-30', None, 'CPTPP 2018', 'Trans-Pacific multilateral agreement'),
    (6, 'Mercosur (Southern Common Market)', '1991-11-29', None, 'Treaty of Asuncion', 'South American regional integration pact'),
    (7, 'KORUS (United States-Korea Free Trade Agreement)', '2012-03-15', None, 'KORUS 2012', 'Bilateral FTA eliminating tariffs on >95% of consumer & industrial products'),
    (8, 'EU-UK Trade and Cooperation Agreement (TCA)', '2021-01-01', None, 'EU-UK TCA 2021', 'Post-Brexit zero tariffs and zero quotas on qualifying goods'),
    (9, 'GCC (Gulf Cooperation Council Customs Union)', '2003-01-01', None, 'GCC 2003', 'Unified external tariff and duty-free movement of national goods'),
    (10, 'ASEAN Free Trade Area (AFTA)', '1992-01-28', None, 'AFTA 1992', 'Common Effective Preferential Tariff scheme across Southeast Asia')
]

AGREEMENT_MEMBERS = [
    # USMCA (1)
    (1, 1), (1, 9), (1, 12),
    # EU (2)
    (2, 3), (2, 6), (2, 13), (2, 14), (2, 15), (2, 29), (2, 30),
    # RCEP (3)
    (3, 2), (3, 4), (3, 10), (3, 11), (3, 17), (3, 18), (3, 19), (3, 27), (3, 28),
    # India-Korea (4)
    (4, 7), (4, 10),
    # CPTPP (5)
    (5, 4), (5, 5), (5, 9), (5, 11), (5, 12), (5, 17), (5, 18), (5, 27),
    # Mercosur (6)
    (6, 8), (6, 23),
    # KORUS (7)
    (7, 1), (7, 10),
    # EU-UK TCA (8)
    (8, 3), (8, 5), (8, 6), (8, 13), (8, 15),
    # GCC (9)
    (9, 16), (9, 26),
    # ASEAN (10)
    (10, 17), (10, 18), (10, 19), (10, 27), (10, 28)
]

# ---------------------------------------------------------------------------
# 6. Bilateral Trade Route Definitions (Authentic Macroeconomic Flows)
# (Exporter_ID, Importer_ID, Product_ID, Base_2018_USD_Billions, Unit_Price_USD, Unit_Name)
# ---------------------------------------------------------------------------
TRADE_FLOW_SPECS = [
    # USA <-> China
    (2, 1, 1, 92.0, 320.0, 'items'),       # CHN -> USA: smartphones
    (2, 1, 2, 12.5, 42.0, 'chips'),        # CHN -> USA: semiconductors
    (2, 1, 4, 48.0, 550.0, 'items'),       # CHN -> USA: computers
    (2, 1, 3, 16.5, 210.0, 'items'),       # CHN -> USA: monitors
    (2, 1, 10, 18.0, 8.5, 'items'),        # CHN -> USA: clothing
    (2, 1, 17, 12.0, 75.0, 'items'),       # CHN -> USA: solar cells
    (2, 1, 12, 4.5, 900.0, 'tonnes'),      # CHN -> USA: steel
    (1, 2, 15, 14.5, 420.0, 'tonnes'),     # USA -> CHN: soybeans
    (1, 2, 19, 16.0, 1.2e8, 'aircraft'),   # USA -> CHN: Boeing aircraft
    (1, 2, 2, 11.5, 45.0, 'chips'),        # USA -> CHN: semiconductors
    (1, 2, 11, 7.8, 120.0, 'doses'),       # USA -> CHN: pharma
    (1, 2, 6, 6.2, 520.0, 'tonnes'),       # USA -> CHN: crude oil
    (1, 2, 5, 8.5, 42000.0, 'vehicles'),   # USA -> CHN: cars

    # USA <-> Canada (USMCA)
    (9, 1, 6, 68.0, 480.0, 'tonnes'),      # CAN -> USA: crude oil
    (9, 1, 5, 38.0, 31000.0, 'vehicles'),  # CAN -> USA: motor vehicles
    (9, 1, 13, 16.5, 650.0, 'parts'),      # CAN -> USA: vehicle parts
    (9, 1, 7, 9.2, 380.0, 'tonnes'),       # CAN -> USA: natural gas
    (9, 1, 8, 3.8, 260.0, 'tonnes'),       # CAN -> USA: wheat
    (1, 9, 5, 28.0, 34000.0, 'vehicles'),  # USA -> CAN: motor vehicles
    (1, 9, 13, 24.0, 720.0, 'parts'),      # USA -> CAN: auto parts
    (1, 9, 14, 18.5, 750.0, 'tonnes'),     # USA -> CAN: refined fuels
    (1, 9, 4, 9.5, 620.0, 'items'),        # USA -> CAN: computers

    # USA <-> Mexico (USMCA)
    (12, 1, 5, 36.0, 26000.0, 'vehicles'), # MEX -> USA: motor cars
    (12, 1, 13, 32.0, 480.0, 'parts'),     # MEX -> USA: auto parts
    (12, 1, 4, 28.0, 520.0, 'items'),      # MEX -> USA: computers
    (12, 1, 1, 15.0, 240.0, 'items'),      # MEX -> USA: telecom
    (12, 1, 18, 11.5, 1400.0, 'devices'),  # MEX -> USA: medical devices
    (12, 1, 6, 12.0, 460.0, 'tonnes'),     # MEX -> USA: crude oil
    (1, 12, 14, 26.5, 760.0, 'tonnes'),    # USA -> MEX: refined fuels
    (1, 12, 13, 19.5, 580.0, 'parts'),     # USA -> MEX: auto parts
    (1, 12, 9, 4.8, 190.0, 'tonnes'),      # USA -> MEX: corn / maize
    (1, 12, 2, 8.2, 38.0, 'chips'),        # USA -> MEX: semiconductors

    # USA <-> Germany
    (3, 1, 5, 24.5, 54000.0, 'vehicles'),  # DEU -> USA: luxury passenger cars
    (3, 1, 11, 21.0, 180.0, 'doses'),      # DEU -> USA: medicaments
    (3, 1, 18, 12.5, 3500.0, 'devices'),   # DEU -> USA: medical instruments
    (3, 1, 13, 8.5, 950.0, 'parts'),       # DEU -> USA: auto parts
    (1, 3, 11, 14.5, 190.0, 'doses'),      # USA -> DEU: pharma / vaccines
    (1, 3, 19, 9.8, 1.4e8, 'aircraft'),    # USA -> DEU: aircraft
    (1, 3, 7, 7.5, 410.0, 'tonnes'),       # USA -> DEU: LNG gas
    (1, 3, 5, 8.5, 42000.0, 'vehicles'),   # USA -> DEU: passenger cars (BMW US / Tesla)

    # USA <-> Japan
    (4, 1, 5, 39.0, 32000.0, 'vehicles'),  # JPN -> USA: passenger cars
    (4, 1, 13, 14.2, 820.0, 'parts'),      # JPN -> USA: auto parts
    (4, 1, 2, 9.5, 62.0, 'chips'),         # JPN -> USA: semiconductors
    (1, 4, 19, 7.5, 1.3e8, 'aircraft'),    # USA -> JPN: aircraft
    (1, 4, 7, 6.8, 420.0, 'tonnes'),       # USA -> JPN: LNG gas
    (1, 4, 9, 3.5, 195.0, 'tonnes'),       # USA -> JPN: corn

    # USA <-> South Korea
    (10, 1, 2, 18.5, 48.0, 'chips'),       # KOR -> USA: memory chips
    (10, 1, 5, 22.0, 28000.0, 'vehicles'), # KOR -> USA: motor vehicles
    (10, 1, 1, 9.2, 340.0, 'items'),       # KOR -> USA: smartphones
    (10, 1, 17, 4.2, 85.0, 'items'),       # KOR -> USA: solar panels
    (1, 10, 6, 8.8, 510.0, 'tonnes'),      # USA -> KOR: crude oil
    (1, 10, 2, 6.5, 55.0, 'chips'),        # USA -> KOR: microprocessors
    (1, 10, 19, 4.5, 1.3e8, 'aircraft'),   # USA -> KOR: aircraft

    # USA <-> United Kingdom
    (5, 1, 11, 12.5, 160.0, 'doses'),      # GBR -> USA: medicaments
    (5, 1, 5, 8.8, 62000.0, 'vehicles'),   # GBR -> USA: premium vehicles
    (5, 1, 19, 5.2, 1.1e8, 'aircraft'),    # GBR -> USA: jet engines
    (1, 5, 19, 9.5, 1.3e8, 'aircraft'),    # USA -> GBR: aircraft
    (1, 5, 6, 7.2, 530.0, 'tonnes'),       # USA -> GBR: crude oil
    (1, 5, 20, 8.0, 52000.0, 'kg'),        # USA -> GBR: gold bullion

    # USA <-> India
    (7, 1, 11, 8.5, 45.0, 'doses'),        # IND -> USA: generic medicaments
    (7, 1, 14, 5.2, 780.0, 'tonnes'),      # IND -> USA: refined fuels
    (7, 1, 10, 4.5, 9.0, 'items'),         # IND -> USA: apparel
    (7, 1, 1, 3.8, 290.0, 'items'),        # IND -> USA: smartphones
    (1, 7, 6, 5.5, 510.0, 'tonnes'),       # USA -> IND: crude oil
    (1, 7, 19, 4.8, 1.3e8, 'aircraft'),    # USA -> IND: Boeing aircraft
    (1, 7, 7, 3.5, 430.0, 'tonnes'),       # USA -> IND: LNG gas

    # USA <-> Vietnam
    (18, 1, 1, 14.5, 270.0, 'items'),      # VNM -> USA: smartphones
    (18, 1, 4, 8.2, 450.0, 'items'),       # VNM -> USA: computers
    (18, 1, 10, 13.0, 9.5, 'items'),       # VNM -> USA: apparel
    (18, 1, 17, 3.8, 72.0, 'items'),       # VNM -> USA: solar cells
    (1, 18, 2, 4.5, 45.0, 'chips'),        # USA -> VNM: chips
    (1, 18, 4, 2.2, 580.0, 'items'),       # USA -> VNM: computers

    # China <-> Germany
    (3, 2, 5, 26.5, 48000.0, 'vehicles'),  # DEU -> CHN: passenger cars
    (3, 2, 13, 11.2, 880.0, 'parts'),      # DEU -> CHN: vehicle parts
    (3, 2, 18, 8.5, 3200.0, 'devices'),    # DEU -> CHN: medical instruments
    (2, 3, 1, 16.5, 310.0, 'items'),       # CHN -> DEU: smartphones
    (2, 3, 4, 14.2, 540.0, 'items'),       # CHN -> DEU: computers
    (2, 3, 17, 6.8, 74.0, 'items'),        # CHN -> DEU: solar cells
    (2, 3, 2, 9.5, 42.0, 'chips'),         # CHN -> DEU: semiconductors

    # China <-> Japan
    (4, 2, 2, 24.0, 52.0, 'chips'),        # JPN -> CHN: semiconductors
    (4, 2, 13, 12.5, 780.0, 'parts'),      # JPN -> CHN: auto parts
    (4, 2, 12, 6.8, 920.0, 'tonnes'),      # JPN -> CHN: flat steel
    (2, 4, 1, 18.0, 310.0, 'items'),       # CHN -> JPN: smartphones
    (2, 4, 4, 13.5, 530.0, 'items'),       # CHN -> JPN: computers
    (2, 4, 10, 8.5, 9.0, 'items'),         # CHN -> JPN: apparel

    # China <-> South Korea
    (10, 2, 2, 45.0, 44.0, 'chips'),       # KOR -> CHN: memory chips
    (10, 2, 3, 9.2, 220.0, 'items'),       # KOR -> CHN: display panels
    (10, 2, 12, 7.5, 890.0, 'tonnes'),     # KOR -> CHN: flat steel
    (2, 10, 2, 15.0, 40.0, 'chips'),       # CHN -> KOR: semiconductors
    (2, 10, 1, 11.5, 290.0, 'items'),      # CHN -> KOR: smartphones
    (2, 10, 17, 5.2, 72.0, 'items'),       # CHN -> KOR: solar cells

    # China <-> Australia
    (11, 2, 16, 62.0, 115.0, 'tonnes'),    # AUS -> CHN: iron ore
    (11, 2, 7, 14.5, 390.0, 'tonnes'),     # AUS -> CHN: LNG gas
    (11, 2, 8, 3.2, 270.0, 'tonnes'),      # AUS -> CHN: wheat
    (2, 11, 1, 6.8, 320.0, 'items'),       # CHN -> AUS: smartphones
    (2, 11, 4, 5.5, 540.0, 'items'),       # CHN -> AUS: computers
    (2, 11, 5, 4.2, 24000.0, 'vehicles'),  # CHN -> AUS: electric cars

    # China <-> Brazil
    (8, 2, 15, 32.0, 410.0, 'tonnes'),     # BRA -> CHN: soybeans
    (8, 2, 16, 28.5, 110.0, 'tonnes'),     # BRA -> CHN: iron ore
    (8, 2, 6, 15.2, 490.0, 'tonnes'),      # BRA -> CHN: crude oil
    (2, 8, 2, 5.8, 42.0, 'chips'),         # CHN -> BRA: semiconductors
    (2, 8, 1, 6.2, 290.0, 'items'),        # CHN -> BRA: smartphones
    (2, 8, 17, 3.5, 75.0, 'items'),        # CHN -> BRA: solar panels

    # China <-> Saudi Arabia
    (16, 2, 6, 42.0, 520.0, 'tonnes'),     # SAU -> CHN: crude oil
    (16, 2, 14, 5.8, 720.0, 'tonnes'),     # SAU -> CHN: petrochemicals
    (2, 16, 1, 4.5, 310.0, 'items'),       # CHN -> SAU: smartphones
    (2, 16, 12, 3.8, 880.0, 'tonnes'),     # CHN -> SAU: steel
    (2, 16, 5, 3.2, 23000.0, 'vehicles'),  # CHN -> SAU: cars

    # China <-> Vietnam
    (18, 2, 1, 12.0, 260.0, 'items'),      # VNM -> CHN: telecom parts
    (18, 2, 2, 6.5, 42.0, 'chips'),        # VNM -> CHN: semiconductors
    (2, 18, 2, 14.5, 40.0, 'chips'),       # CHN -> VNM: semiconductors
    (2, 18, 12, 7.8, 860.0, 'tonnes'),     # CHN -> VNM: steel
    (2, 18, 1, 8.2, 280.0, 'items'),       # CHN -> VNM: phone components

    # India <-> China
    (2, 7, 1, 14.5, 290.0, 'items'),       # CHN -> IND: telecom apparatus
    (2, 7, 2, 6.8, 41.0, 'chips'),         # CHN -> IND: semiconductors
    (2, 7, 17, 5.2, 73.0, 'items'),        # CHN -> IND: solar cells
    (2, 7, 4, 4.8, 510.0, 'items'),        # CHN -> IND: computers
    (7, 2, 16, 3.5, 105.0, 'tonnes'),      # IND -> CHN: iron ore
    (7, 2, 14, 2.8, 740.0, 'tonnes'),      # IND -> CHN: refined fuels

    # India <-> Saudi Arabia & UAE
    (16, 7, 6, 28.0, 515.0, 'tonnes'),     # SAU -> IND: crude oil
    (16, 7, 7, 4.5, 410.0, 'tonnes'),      # SAU -> IND: LPG gas
    (26, 7, 6, 19.5, 520.0, 'tonnes'),     # ARE -> IND: crude oil
    (26, 7, 20, 11.0, 53000.0, 'kg'),      # ARE -> IND: gold bullion
    (7, 26, 14, 8.5, 760.0, 'tonnes'),     # IND -> ARE: refined petroleum
    (7, 26, 1, 3.8, 280.0, 'items'),       # IND -> ARE: smartphones
    (7, 16, 14, 5.2, 750.0, 'tonnes'),     # IND -> SAU: refined petroleum

    # Intra-Europe (Germany <-> France, Italy, Netherlands, Spain, Poland, Sweden)
    (3, 6, 5, 18.0, 42000.0, 'vehicles'),  # DEU -> FRA: passenger cars
    (3, 6, 13, 9.5, 820.0, 'parts'),       # DEU -> FRA: auto parts
    (6, 3, 19, 14.5, 1.3e8, 'aircraft'),   # FRA -> DEU: Airbus aerostructures
    (6, 3, 11, 8.2, 160.0, 'doses'),       # FRA -> DEU: medicaments
    (3, 13, 5, 14.0, 39000.0, 'vehicles'), # DEU -> ITA: passenger cars
    (3, 13, 13, 8.8, 810.0, 'parts'),      # DEU -> ITA: auto parts
    (13, 3, 13, 11.5, 790.0, 'parts'),     # ITA -> DEU: precision auto parts
    (13, 3, 11, 7.2, 150.0, 'doses'),      # ITA -> DEU: medicaments
    (15, 3, 14, 22.0, 750.0, 'tonnes'),    # NLD -> DEU: refined fuels (Rotterdam)
    (15, 3, 18, 9.5, 2800.0, 'devices'),   # NLD -> DEU: medical technology
    (3, 15, 5, 11.0, 41000.0, 'vehicles'), # DEU -> NLD: passenger cars
    (3, 14, 13, 6.5, 780.0, 'parts'),      # DEU -> ESP: auto parts
    (14, 3, 5, 9.2, 27000.0, 'vehicles'),  # ESP -> DEU: passenger cars
    (29, 3, 13, 8.2, 620.0, 'parts'),      # POL -> DEU: auto parts
    (3, 29, 5, 7.8, 36000.0, 'vehicles'),  # DEU -> POL: passenger cars
    (30, 3, 5, 5.5, 46000.0, 'vehicles'),  # SWE -> DEU: Volvo cars & trucks

    # Switzerland <-> USA, Germany, China
    (20, 1, 11, 24.0, 240.0, 'doses'),     # CHE -> USA: pharmaceuticals (Novartis/Roche)
    (20, 1, 18, 5.5, 3800.0, 'devices'),   # CHE -> USA: precision medical devices
    (20, 3, 11, 16.5, 230.0, 'doses'),     # CHE -> DEU: medicaments
    (20, 2, 20, 12.0, 54000.0, 'kg'),      # CHE -> CHN: refined gold bullion
    (20, 7, 20, 8.5, 54000.0, 'kg'),       # CHE -> IND: refined gold

    # Russia <-> China & India
    (25, 2, 6, 38.0, 480.0, 'tonnes'),     # RUS -> CHN: crude petroleum
    (25, 2, 7, 11.5, 360.0, 'tonnes'),     # RUS -> CHN: pipeline gas / LNG
    (25, 7, 6, 26.0, 470.0, 'tonnes'),     # RUS -> IND: crude petroleum
    (25, 2, 8, 4.2, 240.0, 'tonnes'),      # RUS -> CHN: wheat

    # South Africa <-> China & USA
    (22, 2, 16, 8.5, 108.0, 'tonnes'),     # ZAF -> CHN: iron ore & manganese
    (22, 1, 20, 6.2, 53000.0, 'kg'),       # ZAF -> USA: platinum & gold
    (22, 3, 5, 4.5, 38000.0, 'vehicles'),  # ZAF -> DEU: assembled BMW/Mercedes cars

    # Argentina <-> China & Brazil
    (23, 2, 15, 7.8, 410.0, 'tonnes'),     # ARG -> CHN: soybeans & soy oil
    (23, 8, 5, 5.2, 24000.0, 'vehicles'),  # ARG -> BRA: motor vehicles
    (23, 8, 8, 3.8, 255.0, 'tonnes'),      # ARG -> BRA: wheat
    (8, 23, 5, 6.5, 25000.0, 'vehicles'),  # BRA -> ARG: motor vehicles
    (8, 23, 13, 3.5, 610.0, 'parts'),      # BRA -> ARG: auto parts

    # Indonesia <-> China & Japan
    (19, 2, 7, 9.5, 380.0, 'tonnes'),      # IDN -> CHN: LNG gas
    (19, 2, 16, 7.2, 105.0, 'tonnes'),     # IDN -> CHN: nickel & mineral ores
    (19, 4, 7, 5.8, 390.0, 'tonnes'),      # IDN -> JPN: LNG gas

    # Singapore <-> Malaysia, China, USA (Southeast Asia High-Tech Corridor)
    (17, 2, 2, 22.0, 48.0, 'chips'),       # SGP -> CHN: semiconductor distribution
    (17, 1, 2, 14.5, 52.0, 'chips'),       # SGP -> USA: semiconductor distribution
    (17, 27, 14, 8.8, 750.0, 'tonnes'),    # SGP -> MYS: refined petroleum
    (27, 1, 2, 18.5, 44.0, 'chips'),       # MYS -> USA: semiconductor packaging
    (27, 2, 2, 16.0, 42.0, 'chips'),       # MYS -> CHN: semiconductor packaging
    (27, 1, 17, 4.2, 76.0, 'items'),       # MYS -> USA: solar panels

    # Thailand <-> Japan, USA, Australia
    (28, 4, 13, 6.8, 720.0, 'parts'),      # THA -> JPN: auto parts
    (28, 11, 5, 5.5, 26000.0, 'vehicles'), # THA -> AUS: 1-ton pickup trucks
    (28, 1, 4, 7.5, 480.0, 'items'),       # THA -> USA: hard drives & computers
]

# Yearly Economic Trend Multipliers (2018-2023)
YEAR_MULTIPLIERS = {
    2018: 1.000,
    2019: 0.985,  # US-China tariffs began biting, tech adjustment
    2020: 0.920,  # COVID lockdowns, auto factory stops, consumer electronics surge
    2021: 1.150,  # Post-COVID global supply chain rebound & inflation
    2022: 1.280,  # High energy prices (oil & gas peaks), electronics demand normalization
    2023: 1.220,  # Balanced sustained high volume
}

def generate_trade_observations() -> List[dict]:
    observations = []
    # Deterministic pseudo-random seed
    rng = random.Random(42)

    for spec in TRADE_FLOW_SPECS:
        exp_id, imp_id, prod_id, base_b, unit_price, unit_name = spec

        for year in [2018, 2019, 2020, 2021, 2022, 2023]:
            # Year factor
            y_mult = YEAR_MULTIPLIERS[year]

            # Product specific nuances:
            # - Electronics (1, 2, 4): high in 2020 & 2021
            # - Crude & Gas (6, 7): lower in 2020, huge in 2022
            # - Autos (5, 13): dipped in 2020, recovered 2022-2023
            prod_factor = 1.0
            if prod_id in [1, 2, 4]:
                if year == 2020: prod_factor = 1.14
                elif year == 2021: prod_factor = 1.18
            elif prod_id in [6, 7]:
                if year == 2020: prod_factor = 0.75
                elif year == 2022: prod_factor = 1.45
            elif prod_id in [5, 13]:
                if year == 2020: prod_factor = 0.82
                elif year == 2023: prod_factor = 1.12

            # Route specific nuances:
            # US-China trade friction shifted volume to Vietnam & Mexico from 2019 onwards
            route_factor = 1.0
            if (exp_id == 2 and imp_id == 1) or (exp_id == 1 and imp_id == 2):
                if year >= 2019: route_factor = 0.92
            elif (exp_id == 18 and imp_id == 1) or (exp_id == 12 and imp_id == 1):
                if year >= 2019: route_factor = 1.18

            # Small realistic noise (+/- 2.5%)
            jitter = 1.0 + rng.uniform(-0.025, 0.025)

            val_usd = round(base_b * 1e9 * y_mult * prod_factor * route_factor * jitter, 2)
            quantity = round(val_usd / unit_price, 2)
            # Estimated net weight in kg (dependent on product class)
            net_weight_kg = None
            if unit_name == 'tonnes':
                net_weight_kg = round(quantity * 1000.0, 2)
            elif unit_name == 'kg':
                net_weight_kg = quantity
            elif unit_name in ['vehicles', 'items', 'devices']:
                # Approximate weight per unit
                wt_map = {'vehicles': 1600.0, 'items': 0.35, 'devices': 8.5}
                net_weight_kg = round(quantity * wt_map.get(unit_name, 1.0), 2)

            # 1. EXPORT observation from exporter perspective (FOB)
            observations.append({
                'reporter_country_id': exp_id,
                'partner_country_id': imp_id,
                'product_id': prod_id,
                'period_year': year,
                'flow_direction': 'EXPORT',
                'trade_value_usd': val_usd,
                'quantity': quantity,
                'quantity_unit': unit_name,
                'net_weight_kg': net_weight_kg,
                'source_id': 1,
                'batch_id': 101,
            })

            # 2. Symmetrical IMPORT observation from importer perspective (CIF convention, +3.5% shipping/insurance)
            cif_val_usd = round(val_usd * 1.035, 2)
            observations.append({
                'reporter_country_id': imp_id,
                'partner_country_id': exp_id,
                'product_id': prod_id,
                'period_year': year,
                'flow_direction': 'IMPORT',
                'trade_value_usd': cif_val_usd,
                'quantity': quantity,
                'quantity_unit': unit_name,
                'net_weight_kg': net_weight_kg,
                'source_id': 1,
                'batch_id': 101,
            })

    return observations

# ---------------------------------------------------------------------------
# 7. Tariff Policies (Statutory MFN & Preferential Trade Agreements)
# ---------------------------------------------------------------------------
def generate_tariff_policies() -> List[dict]:
    tariffs = []

    # 1. General Baseline MFN rates across all 20 products
    # Importer=NULL is general, or explicit country MFN
    mfn_rates = {
        1: 0.000,   # 8517 phones (WTO ITA)
        2: 0.000,   # 8542 semiconductors (WTO ITA)
        3: 0.025,   # 8528 monitors
        4: 0.000,   # 8471 computers (WTO ITA)
        5: 0.050,   # 8703 cars general
        6: 0.015,   # 2709 crude oil
        7: 0.010,   # 2711 LNG
        8: 0.050,   # 1001 wheat
        9: 0.040,   # 1005 corn
        10: 0.120,  # 6109 clothing
        11: 0.000,  # 3004 pharma
        12: 0.035,  # 7208 steel
        13: 0.040,  # 8708 auto parts
        14: 0.025,  # 2710 refined fuels
        15: 0.030,  # 1201 soybeans
        16: 0.000,  # 2601 iron ore
        17: 0.020,  # 8541 solar cells
        18: 0.000,  # 9018 medical devices
        19: 0.000,  # 8802 civil aircraft
        20: 0.000,  # 7108 gold
    }

    # Major importers general MFN schedules
    for imp_id in [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]:
        for prod_id, rate in mfn_rates.items():
            # Country-specific MFN calibrations
            actual_rate = rate
            if prod_id == 5: # Cars
                if imp_id == 1: actual_rate = 0.025       # USA car MFN: 2.5%
                elif imp_id in [3, 6, 13, 14, 15]: actual_rate = 0.100 # EU car MFN: 10%
                elif imp_id == 7: actual_rate = 0.700     # India car BCD: 70%
                elif imp_id == 4: actual_rate = 0.000     # Japan car MFN: 0%
                elif imp_id == 10: actual_rate = 0.080    # Korea car MFN: 8%
            elif prod_id == 1 and imp_id == 7: # India phones
                actual_rate = 0.200 # 20% to incentivize local assembly
            elif prod_id == 10 and imp_id == 1: # USA apparel
                actual_rate = 0.165 # 16.5% MFN rate

            tariffs.append({
                'importer_country_id': imp_id,
                'exporter_country_id': None, # MFN
                'product_id': prod_id,
                'tariff_type': 'AD_VALOREM',
                'tariff_rate': actual_rate,
                'rate_unit': '% ad valorem',
                'effective_from': '2016-01-01',
                'effective_to': None,
                'source_id': 2,
                'batch_id': 102,
                'agreement_id': None,
                'policy_note': 'Statutory Most-Favoured-Nation (MFN) Applied Tariff',
            })

    # 2. Section 301 US Tariffs on China (Historical progression)
    # Smartphones (Product 1)
    tariffs.extend([
        {
            'importer_country_id': 1, 'exporter_country_id': 2, 'product_id': 1,
            'tariff_type': 'AD_VALOREM', 'tariff_rate': 0.000, 'rate_unit': '% ad valorem',
            'effective_from': '2016-01-01', 'effective_to': '2018-07-05',
            'source_id': 3, 'batch_id': 103, 'agreement_id': None,
            'policy_note': 'Pre-trade war baseline rate (WTO ITA)',
        },
        {
            'importer_country_id': 1, 'exporter_country_id': 2, 'product_id': 1,
            'tariff_type': 'AD_VALOREM', 'tariff_rate': 0.100, 'rate_unit': '% ad valorem',
            'effective_from': '2018-07-06', 'effective_to': '2019-05-09',
            'source_id': 3, 'batch_id': 103, 'agreement_id': None,
            'policy_note': 'Section 301 List 3 tariff tranche (10%)',
        },
        {
            'importer_country_id': 1, 'exporter_country_id': 2, 'product_id': 1,
            'tariff_type': 'AD_VALOREM', 'tariff_rate': 0.150, 'rate_unit': '% ad valorem',
            'effective_from': '2019-05-10', 'effective_to': None,
            'source_id': 3, 'batch_id': 103, 'agreement_id': None,
            'policy_note': 'Section 301 List 4A / Phase 1 agreement in-force rate (15%)',
        },
        # Semiconductors (Product 2)
        {
            'importer_country_id': 1, 'exporter_country_id': 2, 'product_id': 2,
            'tariff_type': 'AD_VALOREM', 'tariff_rate': 0.000, 'rate_unit': '% ad valorem',
            'effective_from': '2016-01-01', 'effective_to': '2018-07-05',
            'source_id': 3, 'batch_id': 103, 'agreement_id': None,
            'policy_note': 'Pre-trade war ITA semiconductor rate',
        },
        {
            'importer_country_id': 1, 'exporter_country_id': 2, 'product_id': 2,
            'tariff_type': 'AD_VALOREM', 'tariff_rate': 0.250, 'rate_unit': '% ad valorem',
            'effective_from': '2018-07-06', 'effective_to': None,
            'source_id': 3, 'batch_id': 103, 'agreement_id': None,
            'policy_note': 'Section 301 List 1 punitive tariff (25%)',
        },
        # Computers & Servers (Product 4)
        {
            'importer_country_id': 1, 'exporter_country_id': 2, 'product_id': 4,
            'tariff_type': 'AD_VALOREM', 'tariff_rate': 0.250, 'rate_unit': '% ad valorem',
            'effective_from': '2018-08-23', 'effective_to': None,
            'source_id': 3, 'batch_id': 103, 'agreement_id': None,
            'policy_note': 'Section 301 List 2 computer data processing tariff (25%)',
        },
        # Solar Cells (Product 17)
        {
            'importer_country_id': 1, 'exporter_country_id': 2, 'product_id': 17,
            'tariff_type': 'AD_VALOREM', 'tariff_rate': 0.300, 'rate_unit': '% ad valorem',
            'effective_from': '2018-02-07', 'effective_to': '2022-02-06',
            'source_id': 3, 'batch_id': 103, 'agreement_id': None,
            'policy_note': 'Section 201 Safeguard tariff on solar photovoltaic cells (30%)',
        },
        {
            'importer_country_id': 1, 'exporter_country_id': 2, 'product_id': 17,
            'tariff_type': 'AD_VALOREM', 'tariff_rate': 0.145, 'rate_unit': '% ad valorem',
            'effective_from': '2022-02-07', 'effective_to': None,
            'source_id': 3, 'batch_id': 103, 'agreement_id': None,
            'policy_note': 'Section 201 Safeguard step-down rate (14.5%)',
        },
        # Steel (Product 12)
        {
            'importer_country_id': 1, 'exporter_country_id': 2, 'product_id': 12,
            'tariff_type': 'AD_VALOREM', 'tariff_rate': 0.250, 'rate_unit': '% ad valorem',
            'effective_from': '2018-03-23', 'effective_to': None,
            'source_id': 3, 'batch_id': 103, 'agreement_id': None,
            'policy_note': 'Section 232 National Security steel tariff (25%)',
        },
        # Passenger cars from China (Product 5)
        {
            'importer_country_id': 1, 'exporter_country_id': 2, 'product_id': 5,
            'tariff_type': 'AD_VALOREM', 'tariff_rate': 0.275, 'rate_unit': '% ad valorem',
            'effective_from': '2018-07-06', 'effective_to': None,
            'source_id': 3, 'batch_id': 103, 'agreement_id': None,
            'policy_note': '2.5% MFN + 25% Section 301 tariff on Chinese vehicles',
        },
    ])

    # 3. China Retaliatory Tariffs on USA
    tariffs.extend([
        # Passenger cars (Product 5)
        {
            'importer_country_id': 2, 'exporter_country_id': 1, 'product_id': 5,
            'tariff_type': 'AD_VALOREM', 'tariff_rate': 0.400, 'rate_unit': '% ad valorem',
            'effective_from': '2018-07-06', 'effective_to': '2018-12-31',
            'source_id': 3, 'batch_id': 103, 'agreement_id': None,
            'policy_note': 'Retaliatory tariff tranche on US-manufactured vehicles (40%)',
        },
        {
            'importer_country_id': 2, 'exporter_country_id': 1, 'product_id': 5,
            'tariff_type': 'AD_VALOREM', 'tariff_rate': 0.150, 'rate_unit': '% ad valorem',
            'effective_from': '2019-01-01', 'effective_to': None,
            'source_id': 3, 'batch_id': 103, 'agreement_id': None,
            'policy_note': 'Suspended retaliatory tariff rate on US automotive (15%)',
        },
        # Soybeans (Product 15)
        {
            'importer_country_id': 2, 'exporter_country_id': 1, 'product_id': 15,
            'tariff_type': 'AD_VALOREM', 'tariff_rate': 0.280, 'rate_unit': '% ad valorem',
            'effective_from': '2018-07-06', 'effective_to': '2020-02-14',
            'source_id': 3, 'batch_id': 103, 'agreement_id': None,
            'policy_note': 'Retaliatory 25% duty + 3% base on US agricultural soybeans',
        },
        {
            'importer_country_id': 2, 'exporter_country_id': 1, 'product_id': 15,
            'tariff_type': 'AD_VALOREM', 'tariff_rate': 0.030, 'rate_unit': '% ad valorem',
            'effective_from': '2020-02-15', 'effective_to': None,
            'source_id': 3, 'batch_id': 103, 'agreement_id': None,
            'policy_note': 'Tariff waiver exclusion under Phase 1 trade agreement (3%)',
        },
    ])

    # 4. USMCA Preferential Tariffs (USA, Canada, Mexico) -> 0% duty across key goods
    for (imp_c, exp_c) in [(1, 9), (9, 1), (1, 12), (12, 1), (9, 12), (12, 9)]:
        for p in [5, 6, 7, 8, 9, 13, 14]:
            tariffs.append({
                'importer_country_id': imp_c,
                'exporter_country_id': exp_c,
                'product_id': p,
                'tariff_type': 'AD_VALOREM',
                'tariff_rate': 0.000,
                'rate_unit': '% ad valorem (USMCA)',
                'effective_from': '2020-07-01',
                'effective_to': None,
                'source_id': 3,
                'batch_id': 103,
                'agreement_id': 1,
                'policy_note': 'USMCA preferential tariff schedule: duty-free originating treatment',
            })

    # 5. EU Single Market Intra-Trade (DEU, FRA, ITA, ESP, NLD, POL, SWE) -> 0%
    eu_members = [3, 6, 13, 14, 15, 29, 30]
    for imp_c in [3, 6, 13, 15]:
        for exp_c in eu_members:
            if imp_c == exp_c: continue
            for p in [5, 11, 13, 14, 18]:
                tariffs.append({
                    'importer_country_id': imp_c,
                    'exporter_country_id': exp_c,
                    'product_id': p,
                    'tariff_type': 'AD_VALOREM',
                    'tariff_rate': 0.000,
                    'rate_unit': '% ad valorem (EU)',
                    'effective_from': '1993-01-01',
                    'effective_to': None,
                    'source_id': 3,
                    'batch_id': 103,
                    'agreement_id': 2,
                    'policy_note': 'European Union Customs Union zero internal customs duty',
                })

    # 6. KORUS (USA <-> South Korea)
    for (imp_c, exp_c) in [(1, 10), (10, 1)]:
        for p in [2, 4, 5, 13]:
            tariffs.append({
                'importer_country_id': imp_c,
                'exporter_country_id': exp_c,
                'product_id': p,
                'tariff_type': 'AD_VALOREM',
                'tariff_rate': 0.000,
                'rate_unit': '% ad valorem (KORUS)',
                'effective_from': '2016-01-01',
                'effective_to': None,
                'source_id': 3,
                'batch_id': 103,
                'agreement_id': 7,
                'policy_note': 'KORUS bilateral preferential duty-free tariff schedule',
            })

    # 7. CPTPP Preferential Rates
    cptpp_members = [4, 9, 11, 12, 17, 18, 27]
    for (imp_c, exp_c) in [(4, 11), (11, 4), (4, 9), (9, 4), (11, 18), (18, 11)]:
        for p in [1, 2, 8, 16]:
            tariffs.append({
                'importer_country_id': imp_c,
                'exporter_country_id': exp_c,
                'product_id': p,
                'tariff_type': 'AD_VALOREM',
                'tariff_rate': 0.000,
                'rate_unit': '% ad valorem (CPTPP)',
                'effective_from': '2018-12-30',
                'effective_to': None,
                'source_id': 3,
                'batch_id': 103,
                'agreement_id': 5,
                'policy_note': 'CPTPP Annex 2-D preferential tariff elimination',
            })

    return tariffs

# ---------------------------------------------------------------------------
# 8. Scenario Templates
# ---------------------------------------------------------------------------
SCENARIOS = [
    (1, 'India Electronics Tariff Hike', 'What-if scenario: India raises tariff on Chinese smartphones from 20% to 30%. Baseline year 2022.', 2022, 'READY'),
    (2, 'US Section 301 Semiconductor Escalation', 'Simulation of US increasing tariffs on Chinese electronic integrated circuits from 25% to 40% (baseline 2022).', 2022, 'READY'),
    (3, 'EU Automotive Reciprocal Tariff', 'Simulation of EU raising import tariff on passenger motor vehicles from US from 10% to 20% (baseline 2023).', 2023, 'READY'),
    (4, 'USMCA Automotive Content Penalty', 'Proposed tariff hike on non-compliant automotive parts imported from Mexico to US from 0% to 12.5% (baseline 2022).', 2022, 'READY'),
]

SCENARIO_TARIFFS = [
    (1, 7, 2, 1, 0.300),   # India on China phones -> 30%
    (2, 1, 2, 2, 0.400),   # USA on China semiconductors -> 40%
    (3, 3, 1, 5, 0.200),   # Germany/EU on USA cars -> 20%
    (4, 1, 12, 13, 0.125), # USA on Mexico auto parts -> 12.5%
]

def build_sql() -> str:
    lines = []
    lines.append("-- =============================================================================")
    lines.append("-- Comprehensive Global Trade Analytics & Tariff Simulation Dataset")
    lines.append("-- Sources: UN Comtrade, World Bank WITS, WTO Tariff Schedules (2018-2023)")
    lines.append("-- Generated by etl/generate_comprehensive_datasets.py")
    lines.append("-- =============================================================================")
    lines.append("")
    lines.append("BEGIN;")
    lines.append("")

    # Data Sources
    lines.append("-- 1. Data Sources")
    lines.append("INSERT INTO data_source (source_id, source_name, source_url, retrieved_at, license_or_usage_note, source_version)")
    lines.append("VALUES")
    src_rows = []
    for s in DATA_SOURCES:
        src_rows.append(f"  ({s[0]}, '{s[1]}', '{s[2]}', '{s[3]}', '{s[4]}', '{s[5]}')")
    lines.append(",\n".join(src_rows))
    lines.append("ON CONFLICT (source_id) DO UPDATE SET")
    lines.append("  source_name = EXCLUDED.source_name, source_url = EXCLUDED.source_url;")
    lines.append("")

    # Countries
    lines.append("-- 2. Countries (30 Sovereign Economies)")
    lines.append("INSERT INTO country (country_id, iso3, iso2, country_name, region, income_group)")
    lines.append("VALUES")
    c_rows = []
    for c in COUNTRIES:
        c_rows.append(f"  ({c[0]}, '{c[1]}', '{c[2]}', '{c[3]}', '{c[4]}', '{c[5]}')")
    lines.append(",\n".join(c_rows))
    lines.append("ON CONFLICT (country_id) DO UPDATE SET")
    lines.append("  iso3 = EXCLUDED.iso3, iso2 = EXCLUDED.iso2, country_name = EXCLUDED.country_name, region = EXCLUDED.region, income_group = EXCLUDED.income_group;")
    lines.append("")

    # Products
    lines.append("-- 3. Products (20 HS2017 Codes)")
    lines.append("INSERT INTO product (product_id, hs_code, hs_version, product_description, hs_chapter)")
    lines.append("VALUES")
    p_rows = []
    for p in PRODUCTS:
        desc = p[3].replace("'", "''")
        p_rows.append(f"  ({p[0]}, '{p[1]}', '{p[2]}', '{desc}', '{p[4]}')")
    lines.append(",\n".join(p_rows))
    lines.append("ON CONFLICT (product_id) DO UPDATE SET")
    lines.append("  product_description = EXCLUDED.product_description, hs_chapter = EXCLUDED.hs_chapter;")
    lines.append("")

    # Ingestion Batches
    lines.append("-- 4. Ingestion Batches")
    lines.append("INSERT INTO ingestion_batch (batch_id, source_id, started_at, completed_at, batch_status, input_record_count, loaded_record_count, rejected_record_count, error_summary)")
    lines.append("VALUES")
    b_rows = []
    for b in BATCHES:
        b_rows.append(f"  ({b[0]}, {b[1]}, '{b[2]}', '{b[3]}', '{b[4]}', {b[5]}, {b[6]}, {b[7]}, '{b[8]}')")
    lines.append(",\n".join(b_rows))
    lines.append("ON CONFLICT (batch_id) DO NOTHING;")
    lines.append("")

    # Trade Agreements
    lines.append("-- 5. Trade Agreements")
    lines.append("INSERT INTO trade_agreement (agreement_id, agreement_name, effective_from, official_ref, notes)")
    lines.append("VALUES")
    ta_rows = []
    for ta in TRADE_AGREEMENTS:
        notes = ta[5].replace("'", "''")
        ta_rows.append(f"  ({ta[0]}, '{ta[1]}', '{ta[2]}', '{ta[4]}', '{notes}')")
    lines.append(",\n".join(ta_rows))
    lines.append("ON CONFLICT (agreement_id) DO UPDATE SET")
    lines.append("  agreement_name = EXCLUDED.agreement_name, official_ref = EXCLUDED.official_ref, notes = EXCLUDED.notes;")
    lines.append("")

    # Agreement Members
    lines.append("-- Agreement Members")
    lines.append("INSERT INTO agreement_member (agreement_id, country_id) VALUES")
    am_rows = [f"  ({am[0]}, {am[1]})" for am in AGREEMENT_MEMBERS]
    lines.append(",\n".join(am_rows))
    lines.append("ON CONFLICT DO NOTHING;")
    lines.append("")

    # Trade Observations
    obs = generate_trade_observations()
    lines.append(f"-- 6. Trade Observations ({len(obs)} Bilateral Multi-Year Observations 2018-2023)")
    lines.append("INSERT INTO trade_observation (reporter_country_id, partner_country_id, product_id, period_year, flow_direction, trade_value_usd, quantity, quantity_unit, net_weight_kg, source_id, batch_id)")
    lines.append("VALUES")
    obs_rows = []
    for o in obs:
        qty_str = f"{o['quantity']}" if o['quantity'] is not None else "NULL"
        wt_str = f"{o['net_weight_kg']}" if o['net_weight_kg'] is not None else "NULL"
        unit_str = f"'{o['quantity_unit']}'" if o['quantity_unit'] else "NULL"
        obs_rows.append(f"  ({o['reporter_country_id']}, {o['partner_country_id']}, {o['product_id']}, {o['period_year']}, '{o['flow_direction']}', {o['trade_value_usd']}, {qty_str}, {unit_str}, {wt_str}, {o['source_id']}, {o['batch_id']})")
    lines.append(",\n".join(obs_rows))
    lines.append("ON CONFLICT (reporter_country_id, partner_country_id, product_id, period_year, flow_direction, source_id)")
    lines.append("DO UPDATE SET")
    lines.append("  trade_value_usd = EXCLUDED.trade_value_usd, quantity = EXCLUDED.quantity, net_weight_kg = EXCLUDED.net_weight_kg;")
    lines.append("")

    # Tariff Policies
    tpolicies = generate_tariff_policies()
    lines.append(f"-- 7. Tariff Policies ({len(tpolicies)} Statutory MFN & Preferential Schedule Records)")
    lines.append("INSERT INTO tariff_policy (importer_country_id, exporter_country_id, product_id, tariff_type, tariff_rate, rate_unit, effective_from, effective_to, source_id, batch_id, agreement_id, policy_note)")
    lines.append("VALUES")
    tp_rows = []
    for tp in tpolicies:
        exp_str = f"{tp['exporter_country_id']}" if tp['exporter_country_id'] is not None else "NULL"
        to_str = f"'{tp['effective_to']}'" if tp['effective_to'] is not None else "NULL"
        agr_str = f"{tp['agreement_id']}" if tp['agreement_id'] is not None else "NULL"
        note = tp['policy_note'].replace("'", "''")
        tp_rows.append(f"  ({tp['importer_country_id']}, {exp_str}, {tp['product_id']}, '{tp['tariff_type']}', {tp['tariff_rate']}, '{tp['rate_unit']}', '{tp['effective_from']}', {to_str}, {tp['source_id']}, {tp['batch_id']}, {agr_str}, '{note}')")
    lines.append(",\n".join(tp_rows))
    lines.append("ON CONFLICT DO NOTHING;")
    lines.append("")

    # Scenarios
    lines.append("-- 8. Pre-Configured Analytical Simulation Scenarios")
    lines.append("INSERT INTO tariff_scenario (scenario_id, scenario_name, description, baseline_period, scenario_status)")
    lines.append("VALUES")
    sc_rows = []
    for sc in SCENARIOS:
        desc = sc[2].replace("'", "''")
        sc_rows.append(f"  ({sc[0]}, '{sc[1]}', '{desc}', {sc[3]}, '{sc[4]}')")
    lines.append(",\n".join(sc_rows))
    lines.append("ON CONFLICT (scenario_id) DO UPDATE SET")
    lines.append("  scenario_name = EXCLUDED.scenario_name, description = EXCLUDED.description, baseline_period = EXCLUDED.baseline_period, scenario_status = EXCLUDED.scenario_status;")
    lines.append("")

    lines.append("INSERT INTO scenario_tariff (scenario_id, importer_country_id, exporter_country_id, product_id, proposed_tariff_rate)")
    lines.append("VALUES")
    st_rows = [f"  ({st[0]}, {st[1]}, {st[2]}, {st[3]}, {st[4]})" for st in SCENARIO_TARIFFS]
    lines.append(",\n".join(st_rows))
    lines.append("ON CONFLICT DO NOTHING;")
    lines.append("")

    # Reset Sequences
    lines.append("-- 9. Synchronize Primary Key Sequences")
    for tbl, col in [
        ('country', 'country_id'),
        ('product', 'product_id'),
        ('data_source', 'source_id'),
        ('ingestion_batch', 'batch_id'),
        ('trade_agreement', 'agreement_id'),
        ('trade_observation', 'trade_id'),
        ('tariff_policy', 'tariff_policy_id'),
        ('tariff_scenario', 'scenario_id')
    ]:
        lines.append(f"SELECT setval(pg_get_serial_sequence('{tbl}', '{col}'), coalesce(max({col}), 1)) FROM {tbl};")

    lines.append("")
    lines.append("COMMIT;")
    return "\n".join(lines)

if __name__ == '__main__':
    sql_text = build_sql()
    out_path = os.path.join(os.path.dirname(__file__), '..', 'database', 'comprehensive_trade_data.sql')
    out_path = os.path.abspath(out_path)
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(sql_text)
    print(f"Comprehensive dataset SQL successfully written to: {out_path}")
