"""
Admin / ingestion batch endpoints.
"""
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import IngestionBatch, DataSource

router = APIRouter()


@router.get("/admin/ingestion-batches", tags=["Admin"])
def list_batches(db: Session = Depends(get_db)):
    """Return all ingestion batches with source metadata."""
    rows = (
        db.query(IngestionBatch, DataSource)
        .join(DataSource, IngestionBatch.source_id == DataSource.source_id)
        .order_by(IngestionBatch.started_at.desc())
        .all()
    )
    out = []
    for batch, src in rows:
        out.append({
            "batch_id": batch.batch_id,
            "source_name": src.source_name,
            "source_url": src.source_url,
            "started_at": batch.started_at,
            "completed_at": batch.completed_at,
            "batch_status": batch.batch_status,
            "input_record_count": batch.input_record_count,
            "loaded_record_count": batch.loaded_record_count,
            "rejected_record_count": batch.rejected_record_count,
            "rejection_rate_pct": (
                round(100.0 * batch.rejected_record_count / batch.input_record_count, 2)
                if batch.input_record_count else None
            ),
            "error_summary": batch.error_summary,
        })
    return out
