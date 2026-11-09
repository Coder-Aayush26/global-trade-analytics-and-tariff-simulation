"""
ETL: Validate and load trade/tariff data from CSV files into PostgreSQL.

Usage:
    python load_postgres.py --file data/trade_data.csv --type trade
    python load_postgres.py --file data/tariff_data.csv --type tariff

Expected CSV columns for trade:
    reporter_iso3, partner_iso3, hs_code, hs_version, period_year,
    flow_direction, trade_value_usd, [quantity, quantity_unit, net_weight_kg]

Expected CSV columns for tariff:
    importer_iso3, exporter_iso3 (blank=MFN), hs_code, hs_version,
    tariff_type, tariff_rate_pct, effective_from, [effective_to]
"""

import argparse
import logging
import os
import sys
from datetime import datetime, timezone
from typing import Optional

import pandas as pd
import psycopg2
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/trade_db")
SOURCE_ID    = int(os.getenv("ETL_SOURCE_ID", "1"))   # default: UN Comtrade


def get_conn():
    import re
    # parse DATABASE_URL
    m = re.match(r"postgresql://([^:]+):([^@]+)@([^:/]+):?(\d+)?/(.+)", DATABASE_URL)
    if not m:
        raise ValueError(f"Cannot parse DATABASE_URL: {DATABASE_URL}")
    user, password, host, port, dbname = m.groups()
    return psycopg2.connect(
        host=host, port=int(port or 5432), dbname=dbname, user=user, password=password
    )


def lookup_country_id(cur, iso3: str) -> Optional[int]:
    cur.execute("SELECT country_id FROM country WHERE iso3 = %s", (iso3.upper(),))
    row = cur.fetchone()
    return row[0] if row else None


def lookup_product_id(cur, hs_code: str, hs_version: str) -> Optional[int]:
    cur.execute("SELECT product_id FROM product WHERE hs_code = %s AND hs_version = %s",
                (hs_code.strip(), hs_version.strip()))
    row = cur.fetchone()
    return row[0] if row else None


def create_batch(cur, source_id: int, input_count: int) -> int:
    cur.execute("""
        INSERT INTO ingestion_batch (source_id, batch_status, input_record_count)
        VALUES (%s, 'RUNNING', %s)
        RETURNING batch_id
    """, (source_id, input_count))
    return cur.fetchone()[0]


def complete_batch(cur, batch_id: int, loaded: int, rejected: int, status="COMPLETED"):
    cur.execute("""
        UPDATE ingestion_batch
        SET completed_at = NOW(), batch_status = %s,
            loaded_record_count = %s, rejected_record_count = %s
        WHERE batch_id = %s
    """, (status, loaded, rejected, batch_id))


def load_trade(df: pd.DataFrame, conn) -> tuple[int, int]:
    loaded = rejected = 0
    cur = conn.cursor()
    batch_id = create_batch(cur, SOURCE_ID, len(df))
    conn.commit()

    for _, row in df.iterrows():
        try:
            reporter_id = lookup_country_id(cur, str(row["reporter_iso3"]))
            partner_id  = lookup_country_id(cur, str(row["partner_iso3"]))
            product_id  = lookup_product_id(cur, str(row["hs_code"]), str(row["hs_version"]))

            if not reporter_id:
                raise ValueError(f"Unknown reporter ISO3: {row['reporter_iso3']}")
            if not partner_id:
                raise ValueError(f"Unknown partner ISO3: {row['partner_iso3']}")
            if not product_id:
                raise ValueError(f"Unknown product: {row['hs_code']} / {row['hs_version']}")

            value = float(row["trade_value_usd"])
            if value < 0:
                raise ValueError("Negative trade value")

            flow = str(row["flow_direction"]).upper()
            if flow not in ("IMPORT", "EXPORT"):
                raise ValueError(f"Invalid flow: {flow}")

            cur.execute("""
                INSERT INTO trade_observation
                    (reporter_country_id, partner_country_id, product_id,
                     period_year, flow_direction, trade_value_usd,
                     quantity, quantity_unit, net_weight_kg, source_id, batch_id)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT ON CONSTRAINT uq_trade_observation DO NOTHING
            """, (
                reporter_id, partner_id, product_id,
                int(row["period_year"]), flow, value,
                row.get("quantity") or None,
                row.get("quantity_unit") or None,
                row.get("net_weight_kg") or None,
                SOURCE_ID, batch_id,
            ))
            loaded += cur.rowcount
        except Exception as e:
            log.warning("REJECTED row %s: %s", _, e)
            rejected += 1

    complete_batch(cur, batch_id, loaded, rejected)
    conn.commit()
    cur.close()
    return loaded, rejected


def load_tariff(df: pd.DataFrame, conn) -> tuple[int, int]:
    loaded = rejected = 0
    cur = conn.cursor()
    batch_id = create_batch(cur, SOURCE_ID, len(df))
    conn.commit()

    for _, row in df.iterrows():
        try:
            importer_id = lookup_country_id(cur, str(row["importer_iso3"]))
            if not importer_id:
                raise ValueError(f"Unknown importer: {row['importer_iso3']}")

            exporter_id = None
            if pd.notna(row.get("exporter_iso3")) and str(row["exporter_iso3"]).strip():
                exporter_id = lookup_country_id(cur, str(row["exporter_iso3"]))
                if not exporter_id:
                    raise ValueError(f"Unknown exporter: {row['exporter_iso3']}")

            product_id = lookup_product_id(cur, str(row["hs_code"]), str(row["hs_version"]))
            if not product_id:
                raise ValueError(f"Unknown product: {row['hs_code']} / {row['hs_version']}")

            rate_pct = float(row["tariff_rate_pct"])
            rate_dec = rate_pct / 100.0
            if rate_dec < 0:
                raise ValueError("Negative tariff rate")

            effective_from = pd.to_datetime(row["effective_from"]).date()
            effective_to   = (
                pd.to_datetime(row["effective_to"]).date()
                if pd.notna(row.get("effective_to")) and str(row.get("effective_to")).strip()
                else None
            )

            cur.execute("""
                INSERT INTO tariff_policy
                    (importer_country_id, exporter_country_id, product_id,
                     tariff_type, tariff_rate, rate_unit,
                     effective_from, effective_to, source_id, batch_id)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """, (
                importer_id, exporter_id, product_id,
                str(row.get("tariff_type", "AD_VALOREM")).upper(),
                rate_dec, row.get("rate_unit", "% ad valorem"),
                effective_from, effective_to,
                SOURCE_ID, batch_id,
            ))
            loaded += 1
        except Exception as e:
            log.warning("REJECTED tariff row %s: %s", _, e)
            rejected += 1

    complete_batch(cur, batch_id, loaded, rejected)
    conn.commit()
    cur.close()
    return loaded, rejected


def main():
    parser = argparse.ArgumentParser(description="Load trade or tariff CSV into PostgreSQL.")
    parser.add_argument("--file", required=True, help="Path to CSV file")
    parser.add_argument("--type", required=True, choices=["trade", "tariff"])
    args = parser.parse_args()

    df = pd.read_csv(args.file, dtype=str)
    log.info("Loaded %d rows from %s", len(df), args.file)

    conn = get_conn()
    try:
        if args.type == "trade":
            loaded, rejected = load_trade(df, conn)
        else:
            loaded, rejected = load_tariff(df, conn)

        log.info("Done. Loaded: %d | Rejected: %d", loaded, rejected)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
