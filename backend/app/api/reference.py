"""
API routers — countries and products.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import Country, Product
from app.schemas.schemas import CountryOut, ProductOut

router = APIRouter()


# ---------------------------------------------------------------------------
# Countries
# ---------------------------------------------------------------------------
@router.get("/countries", response_model=List[CountryOut], tags=["Reference Data"])
def list_countries(
    search: Optional[str] = Query(None, description="Filter by country name or ISO3"),
    db: Session = Depends(get_db),
):
    """Return all countries, optionally filtered by name or ISO3 code."""
    q = db.query(Country)
    if search:
        like = f"%{search.upper()}%"
        q = q.filter(
            (Country.iso3.ilike(like)) | (Country.country_name.ilike(f"%{search}%"))
        )
    return q.order_by(Country.country_name).all()


@router.get("/countries/{country_id}", response_model=CountryOut, tags=["Reference Data"])
def get_country(country_id: int, db: Session = Depends(get_db)):
    obj = db.query(Country).filter(Country.country_id == country_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Country not found")
    return obj


# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------
@router.get("/products", response_model=List[ProductOut], tags=["Reference Data"])
def list_products(
    search: Optional[str] = Query(None, description="Filter by HS code or description"),
    chapter: Optional[str] = Query(None, description="Filter by HS chapter (2-digit)"),
    db: Session = Depends(get_db),
):
    """Return all products, optionally filtered."""
    q = db.query(Product)
    if search:
        q = q.filter(
            (Product.hs_code.ilike(f"%{search}%")) |
            (Product.product_description.ilike(f"%{search}%"))
        )
    if chapter:
        q = q.filter(Product.hs_chapter == chapter)
    return q.order_by(Product.hs_code).all()


@router.get("/products/{product_id}", response_model=ProductOut, tags=["Reference Data"])
def get_product(product_id: int, db: Session = Depends(get_db)):
    obj = db.query(Product).filter(Product.product_id == product_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Product not found")
    return obj
