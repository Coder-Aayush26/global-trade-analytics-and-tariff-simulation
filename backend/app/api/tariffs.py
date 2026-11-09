"""
Tariff history and lookup endpoints.
"""
from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.schemas import TariffPolicyOut

router = APIRouter()


@router.get("/tariffs", response_model=List[TariffPolicyOut], tags=["Tariffs"])
def get_tariffs(
    importer_id: int = Query(...),
    product_id:  int = Query(...),
    exporter_id: Optional[int] = Query(None, description="Omit for MFN/general rates"),
    as_of_date:  Optional[date] = Query(None, description="Effective date filter (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
):
    """
    Return tariff records for importer + product, optionally filtered
    by exporter and effective date. Preferential rates appear before MFN.
    """
    if as_of_date:
        # Use the stored function for date-effective lookup
        sql = text("""
            SELECT tariff_policy_id, tariff_type, tariff_rate,
                   ROUND(tariff_rate * 100, 4) AS tariff_rate_pct,
                   effective_from, effective_to, NULL AS rate_unit, NULL AS policy_note,
                   :importer_id AS importer_country_id,
                   :exporter_id AS exporter_country_id,
                   :product_id  AS product_id
            FROM get_effective_tariff_rate(:importer_id, :exporter_id, :product_id, :as_of)
        """)
        rows = db.execute(sql, {
            "importer_id": importer_id,
            "exporter_id": exporter_id,
            "product_id": product_id,
            "as_of": as_of_date,
        }).mappings().all()
    else:
        # Return full history
        sql = text("""
            SELECT
                tp.tariff_policy_id,
                tp.importer_country_id,
                tp.exporter_country_id,
                tp.product_id,
                tp.tariff_type,
                tp.tariff_rate,
                ROUND(tp.tariff_rate * 100, 4) AS tariff_rate_pct,
                tp.rate_unit,
                tp.effective_from,
                tp.effective_to,
                tp.policy_note
            FROM tariff_policy AS tp
            WHERE tp.importer_country_id = :importer_id
              AND tp.product_id = :product_id
              AND (:exporter_id IS NULL
                   OR tp.exporter_country_id = :exporter_id
                   OR tp.exporter_country_id IS NULL)
            ORDER BY
                (tp.exporter_country_id IS NULL) ASC,
                tp.effective_from DESC
        """)
        rows = db.execute(sql, {
            "importer_id": importer_id,
            "exporter_id": exporter_id,
            "product_id": product_id,
        }).mappings().all()

    return [TariffPolicyOut(**dict(r)) for r in rows]
