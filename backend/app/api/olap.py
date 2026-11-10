"""
DuckDB OLAP Analytics Endpoints.
Demonstrates High-Performance Hybrid Transactional/Analytical Processing (HTAP)
combining PostgreSQL 18 (OLTP) with DuckDB 2.0 (OLAP).
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db import duckdb_service

router = APIRouter(prefix="/olap", tags=["DuckDB OLAP Analytics"])

@router.get("/status")
def duckdb_status(db: Session = Depends(get_db)):
    """Check DuckDB in-process columnar database status and synchronize from PostgreSQL if needed."""
    res = duckdb_service.sync_from_postgres(db)
    return {
        "engine": "DuckDB Columnar Analytical Engine",
        "role": "OLAP & Supply Chain Risk Modeling",
        "sync_info": res,
    }

@router.post("/sync")
def trigger_sync(db: Session = Depends(get_db)):
    """Explicitly replicate PostgreSQL observations into DuckDB columnar memory."""
    return duckdb_service.sync_from_postgres(db)

@router.get("/concentration")
def market_concentration(
    country_id: int = Query(..., description="Reporting country ID (1-12)"),
    flow: str = Query("IMPORT", pattern="^(IMPORT|EXPORT)$"),
    db: Session = Depends(get_db),
):
    """
    Computes Herfindahl-Hirschman Index (HHI) for market dependency and concentration risk
    using DuckDB's vectorized columnar engine.
    """
    # Ensure DuckDB is populated
    duckdb_service.sync_from_postgres(db)
    result = duckdb_service.compute_market_concentration(country_id, flow)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result
