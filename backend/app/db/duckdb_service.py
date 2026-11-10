"""
DuckDB Embedded Columnar OLAP Service.
Provides ultra-fast in-process analytical aggregations for global trade flows,
market concentration indices (HHI), and supply chain matrix computations.
"""
import time
from typing import Dict, Any, List
import duckdb
from sqlalchemy.orm import Session
from app.db.models import TradeObservation, Country, Product

# In-memory DuckDB analytical engine
_duckdb_conn: duckdb.DuckDBPyConnection = duckdb.connect(database=':memory:')

def get_duckdb_connection() -> duckdb.DuckDBPyConnection:
    return _duckdb_conn

def sync_from_postgres(db: Session) -> Dict[str, Any]:
    """
    Sync normalized relational data from PostgreSQL into DuckDB's columnar in-memory store.
    """
    start_time = time.perf_counter()
    conn = get_duckdb_connection()

    # Fetch trade observations with joins
    rows = db.query(
        TradeObservation.trade_id,
        TradeObservation.period_year,
        TradeObservation.reporter_country_id,
        TradeObservation.partner_country_id,
        TradeObservation.product_id,
        TradeObservation.flow_direction,
        TradeObservation.trade_value_usd,
        TradeObservation.quantity,
    ).all()

    # Fetch countries and products for dimensional lookup
    countries = db.query(Country.country_id, Country.iso3, Country.country_name, Country.region).all()
    products = db.query(Product.product_id, Product.hs_code, Product.product_description).all()

    # Create / Replace DuckDB columnar tables
    conn.execute("DROP TABLE IF EXISTS dim_country;")
    conn.execute("""
        CREATE TABLE dim_country (
            country_id INTEGER PRIMARY KEY,
            iso3 VARCHAR,
            country_name VARCHAR,
            region VARCHAR
        );
    """)
    if countries:
        conn.executemany("INSERT INTO dim_country VALUES (?, ?, ?, ?)", [(c.country_id, c.iso3, c.country_name, c.region) for c in countries])

    conn.execute("DROP TABLE IF EXISTS dim_product;")
    conn.execute("""
        CREATE TABLE dim_product (
            product_id INTEGER PRIMARY KEY,
            hs_code VARCHAR,
            product_description VARCHAR
        );
    """)
    if products:
        conn.executemany("INSERT INTO dim_product VALUES (?, ?, ?)", [(p.product_id, p.hs_code, p.product_description) for p in products])

    conn.execute("DROP TABLE IF EXISTS fact_trade;")
    conn.execute("""
        CREATE TABLE fact_trade (
            trade_id INTEGER PRIMARY KEY,
            period_year INTEGER,
            reporter_country_id INTEGER,
            partner_country_id INTEGER,
            product_id INTEGER,
            flow_direction VARCHAR,
            trade_value_usd DOUBLE,
            quantity DOUBLE
        );
    """)
    if rows:
        conn.executemany(
            "INSERT INTO fact_trade VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [
                (
                    r.trade_id,
                    r.period_year,
                    r.reporter_country_id,
                    r.partner_country_id,
                    r.product_id,
                    r.flow_direction,
                    float(r.trade_value_usd) if r.trade_value_usd else 0.0,
                    float(r.quantity) if r.quantity else None,
                )
                for r in rows
            ]
        )

    elapsed_ms = (time.perf_counter() - start_time) * 1000.0

    count = conn.execute("SELECT COUNT(*) FROM fact_trade").fetchone()[0]
    return {
        "status": "synchronized",
        "duckdb_version": duckdb.__version__,
        "rows_loaded": count,
        "sync_time_ms": round(elapsed_ms, 2),
    }

def compute_market_concentration(country_id: int, flow: str = "IMPORT") -> Dict[str, Any]:
    """
    Computes the Herfindahl-Hirschman Index (HHI) of market concentration.
    HHI = sum((market_share_i * 100)^2)
    HHI < 1500 = Diversified / Competitive
    1500 <= HHI <= 2500 = Moderately Concentrated
    HHI > 2500 = Highly Concentrated / Vulnerable to Supply Shocks
    """
    conn = get_duckdb_connection()
    
    # Check if table exists
    tables = [t[0] for t in conn.execute("SHOW TABLES").fetchall()]
    if "fact_trade" not in tables:
        return {"error": "DuckDB store not initialized. Run sync first."}

    start_time = time.perf_counter()
    sql = """
        WITH total AS (
            SELECT SUM(trade_value_usd) AS grand_total
            FROM fact_trade
            WHERE reporter_country_id = ? AND flow_direction = ?
        ),
        partner_shares AS (
            SELECT 
                f.partner_country_id,
                c.country_name AS partner_name,
                c.iso3 AS partner_iso3,
                SUM(f.trade_value_usd) AS partner_total,
                (SUM(f.trade_value_usd) / t.grand_total) * 100.0 AS market_share_pct
            FROM fact_trade f
            CROSS JOIN total t
            JOIN dim_country c ON c.country_id = f.partner_country_id
            WHERE f.reporter_country_id = ? AND f.flow_direction = ?
            GROUP BY f.partner_country_id, c.country_name, c.iso3, t.grand_total
        )
        SELECT 
            partner_country_id,
            partner_name,
            partner_iso3,
            partner_total,
            market_share_pct,
            POW(market_share_pct, 2) AS hhi_component
        FROM partner_shares
        ORDER BY partner_total DESC;
    """
    results = conn.execute(sql, [country_id, flow, country_id, flow]).fetchall()
    elapsed_ms = (time.perf_counter() - start_time) * 1000.0

    total_hhi = sum(r[5] for r in results) if results else 0.0

    if total_hhi < 1500:
        risk_level = "Low (Diversified Partners)"
    elif total_hhi <= 2500:
        risk_level = "Moderate Concentration"
    else:
        risk_level = "High Concentration (Vulnerable to Shocks)"

    partners = [
        {
            "partner_id": r[0],
            "partner_name": r[1],
            "partner_iso3": r[2],
            "trade_value_usd": round(r[3], 2),
            "market_share_pct": round(r[4], 2),
            "hhi_component": round(r[5], 2),
        }
        for r in results
    ]

    return {
        "country_id": country_id,
        "flow": flow,
        "hhi_score": round(total_hhi, 2),
        "risk_level": risk_level,
        "partner_breakdown": partners,
        "query_execution_time_ms": round(elapsed_ms, 3),
        "engine": "DuckDB Columnar SIMD Vectorized",
    }
