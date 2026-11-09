"""
Trade observation and analytics endpoints.
"""
from typing import List, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import TradeObservation, Country, Product
from app.schemas.schemas import (
    TradeObservationOut, TradeObservationCreate,
    TopPartnerOut, TradeBalanceOut, YoYGrowthOut,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Trade Observations
# ---------------------------------------------------------------------------
@router.get("/trade", response_model=List[TradeObservationOut], tags=["Trade"])
def list_trade_observations(
    reporter_id: Optional[int] = Query(None),
    partner_id:  Optional[int] = Query(None),
    product_id:  Optional[int] = Query(None),
    flow:        Optional[str] = Query(None, pattern="^(IMPORT|EXPORT)$"),
    year_from:   Optional[int] = Query(None),
    year_to:     Optional[int] = Query(None),
    page:        int = Query(1, ge=1),
    page_size:   int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Filtered and paginated trade observations."""
    q = db.query(TradeObservation)
    if reporter_id: q = q.filter(TradeObservation.reporter_country_id == reporter_id)
    if partner_id:  q = q.filter(TradeObservation.partner_country_id  == partner_id)
    if product_id:  q = q.filter(TradeObservation.product_id          == product_id)
    if flow:        q = q.filter(TradeObservation.flow_direction       == flow)
    if year_from:   q = q.filter(TradeObservation.period_year         >= year_from)
    if year_to:     q = q.filter(TradeObservation.period_year         <= year_to)
    offset = (page - 1) * page_size
    return q.order_by(TradeObservation.period_year.desc()).offset(offset).limit(page_size).all()


@router.post("/trade", response_model=TradeObservationOut, status_code=201, tags=["Trade"])
def create_trade_observation(payload: TradeObservationCreate, db: Session = Depends(get_db)):
    """Insert a new trade observation (enforces unique business key via DB constraint)."""
    obj = TradeObservation(**payload.model_dump())
    try:
        db.add(obj)
        db.commit()
        db.refresh(obj)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"Constraint violation: {exc.args[0][:200]}")
    return obj


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------
@router.get("/analytics/top-partners", response_model=List[TopPartnerOut], tags=["Analytics"])
def top_partners(
    reporter_id: int = Query(..., description="Reporter country ID"),
    flow:        str = Query(..., pattern="^(IMPORT|EXPORT)$"),
    year_from:   int = Query(..., ge=1900),
    year_to:     int = Query(..., le=2100),
    product_id:  Optional[int] = Query(None),
    limit:       int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Top N partner countries by trade value for a reporter, flow, and period."""
    sql = text("""
        SELECT
            par.country_name AS partner_country,
            par.iso3         AS partner_iso3,
            SUM(t.trade_value_usd) AS total_value_usd,
            RANK() OVER (ORDER BY SUM(t.trade_value_usd) DESC) AS partner_rank
        FROM trade_observation AS t
        JOIN country AS par ON par.country_id = t.partner_country_id
        WHERE t.reporter_country_id = :reporter_id
          AND t.flow_direction = :flow
          AND t.period_year BETWEEN :year_from AND :year_to
          AND (:product_id IS NULL OR t.product_id = :product_id)
        GROUP BY par.country_name, par.iso3
        ORDER BY total_value_usd DESC
        LIMIT :lim
    """)
    rows = db.execute(sql, {
        "reporter_id": reporter_id, "flow": flow,
        "year_from": year_from, "year_to": year_to,
        "product_id": product_id, "lim": limit,
    }).mappings().all()
    return [TopPartnerOut(**r) for r in rows]


@router.get("/analytics/trade-balance", response_model=List[TradeBalanceOut], tags=["Analytics"])
def trade_balance(
    country_id: int = Query(...),
    year_from:  int = Query(..., ge=1900),
    year_to:    int = Query(..., le=2100),
    db: Session = Depends(get_db),
):
    """Annual reported trade balance for a country."""
    sql = text("""
        SELECT
            t.period_year,
            SUM(CASE WHEN t.flow_direction = 'EXPORT'
                     THEN t.trade_value_usd ELSE 0 END) AS exports_usd,
            SUM(CASE WHEN t.flow_direction = 'IMPORT'
                     THEN t.trade_value_usd ELSE 0 END) AS imports_usd,
            SUM(CASE WHEN t.flow_direction = 'EXPORT'
                     THEN t.trade_value_usd ELSE 0 END)
          - SUM(CASE WHEN t.flow_direction = 'IMPORT'
                     THEN t.trade_value_usd ELSE 0 END) AS trade_balance_usd
        FROM trade_observation AS t
        WHERE t.reporter_country_id = :country_id
          AND t.period_year BETWEEN :year_from AND :year_to
        GROUP BY t.period_year
        ORDER BY t.period_year
    """)
    rows = db.execute(sql, {"country_id": country_id, "year_from": year_from, "year_to": year_to}).mappings().all()
    return [TradeBalanceOut(**r) for r in rows]


@router.get("/analytics/yoy-growth", response_model=List[YoYGrowthOut], tags=["Analytics"])
def yoy_growth(
    country_id: int = Query(...),
    flow:       str = Query(..., pattern="^(IMPORT|EXPORT)$"),
    product_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Year-over-year trade growth using the get_yoy_growth stored function."""
    sql = text("SELECT * FROM get_yoy_growth(:cid, :flow, :pid)")
    rows = db.execute(sql, {"cid": country_id, "flow": flow, "pid": product_id}).mappings().all()
    return [YoYGrowthOut(**r) for r in rows]
