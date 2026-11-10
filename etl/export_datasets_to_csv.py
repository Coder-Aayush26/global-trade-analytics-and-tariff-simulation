"""
Export existing PostgreSQL dataset to standardized CSV files in data/
Provides official dataset CSV files ready for ETL ingestion or external analytics.
"""

import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/trade_db")

def export_to_csv():
    # Ensure data/ directory exists
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
    os.makedirs(out_dir, exist_ok=True)
    print(f"Exporting datasets to: {out_dir}")

    import re
    m = re.match(r"postgresql://([^:]+):([^@]+)@([^:/]+):?(\d+)?/(.+)", DATABASE_URL)
    user, password, host, port, dbname = m.groups()
    conn = psycopg2.connect(
        host=host, port=int(port or 5432), dbname=dbname, user=user, password=password
    )
    cur = conn.cursor()

    # 1. Export countries.csv
    c_path = os.path.join(out_dir, "countries.csv")
    with open(c_path, "w", encoding="utf-8") as f:
        cur.copy_expert(
            "COPY (SELECT country_id, iso3, iso2, country_name, region, income_group FROM country ORDER BY country_id) TO STDOUT WITH CSV HEADER;",
            f
        )
    print(f"Exported {c_path}")

    # 2. Export products.csv
    p_path = os.path.join(out_dir, "products.csv")
    with open(p_path, "w", encoding="utf-8") as f:
        cur.copy_expert(
            "COPY (SELECT product_id, hs_code, hs_version, product_description, hs_chapter FROM product ORDER BY product_id) TO STDOUT WITH CSV HEADER;",
            f
        )
    print(f"Exported {p_path}")

    # 3. Export trade_data.csv in etl/load_postgres.py format
    t_path = os.path.join(out_dir, "trade_data.csv")
    with open(t_path, "w", encoding="utf-8") as f:
        cur.copy_expert("""
            COPY (
                SELECT 
                    r.iso3 AS reporter_iso3,
                    p.iso3 AS partner_iso3,
                    pr.hs_code,
                    pr.hs_version,
                    t.period_year,
                    t.flow_direction,
                    t.trade_value_usd,
                    t.quantity,
                    t.quantity_unit,
                    t.net_weight_kg
                FROM trade_observation t
                JOIN country r ON r.country_id = t.reporter_country_id
                JOIN country p ON p.country_id = t.partner_country_id
                JOIN product pr ON pr.product_id = t.product_id
                ORDER BY t.period_year DESC, r.iso3, p.iso3, pr.hs_code
            ) TO STDOUT WITH CSV HEADER;
        """, f)
    print(f"Exported {t_path}")

    # 4. Export tariff_data.csv in etl/load_postgres.py format
    tf_path = os.path.join(out_dir, "tariff_data.csv")
    with open(tf_path, "w", encoding="utf-8") as f:
        cur.copy_expert("""
            COPY (
                SELECT 
                    imp.iso3 AS importer_iso3,
                    exp_c.iso3 AS exporter_iso3,
                    pr.hs_code,
                    pr.hs_version,
                    tp.tariff_type,
                    ROUND(tp.tariff_rate * 100.0, 4) AS tariff_rate_pct,
                    tp.effective_from,
                    tp.effective_to,
                    tp.rate_unit,
                    tp.policy_note
                FROM tariff_policy tp
                JOIN country imp ON imp.country_id = tp.importer_country_id
                LEFT JOIN country exp_c ON exp_c.country_id = tp.exporter_country_id
                JOIN product pr ON pr.product_id = tp.product_id
                ORDER BY imp.iso3, exp_c.iso3 NULLS FIRST, pr.hs_code, tp.effective_from DESC
            ) TO STDOUT WITH CSV HEADER;
        """, f)
    print(f"Exported {tf_path}")

    cur.close()
    conn.close()
    print("All dataset CSV files exported successfully!")

if __name__ == "__main__":
    export_to_csv()
