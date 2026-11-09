"""
Pydantic schemas for request/response validation.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Country
# ---------------------------------------------------------------------------
class CountryBase(BaseModel):
    iso3: str = Field(..., min_length=3, max_length=3)
    iso2: Optional[str] = None
    country_name: str
    region: Optional[str] = None
    income_group: Optional[str] = None


class CountryOut(CountryBase):
    country_id: int

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Product
# ---------------------------------------------------------------------------
class ProductBase(BaseModel):
    hs_code: str
    hs_version: str
    product_description: str
    hs_chapter: Optional[str] = None


class ProductOut(ProductBase):
    product_id: int

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Trade Observation
# ---------------------------------------------------------------------------
class TradeObservationOut(BaseModel):
    trade_id: int
    reporter_country_id: int
    partner_country_id: int
    product_id: int
    period_year: int
    flow_direction: str
    trade_value_usd: Decimal
    quantity: Optional[Decimal] = None
    quantity_unit: Optional[str] = None
    source_id: int

    class Config:
        from_attributes = True


class TradeObservationCreate(BaseModel):
    reporter_country_id: int
    partner_country_id: int
    product_id: int
    period_year: int = Field(..., ge=1900, le=2100)
    flow_direction: str = Field(..., pattern="^(IMPORT|EXPORT)$")
    trade_value_usd: Decimal = Field(..., ge=0)
    quantity: Optional[Decimal] = None
    quantity_unit: Optional[str] = None
    net_weight_kg: Optional[Decimal] = None
    source_id: int


# ---------------------------------------------------------------------------
# Tariff Policy
# ---------------------------------------------------------------------------
class TariffPolicyOut(BaseModel):
    tariff_policy_id: int
    importer_country_id: int
    exporter_country_id: Optional[int] = None
    product_id: int
    tariff_type: str
    tariff_rate: Decimal
    tariff_rate_pct: Optional[Decimal] = None
    rate_unit: Optional[str] = None
    effective_from: date
    effective_to: Optional[date] = None
    policy_note: Optional[str] = None

    @field_validator("tariff_rate_pct", mode="before")
    @classmethod
    def compute_pct(cls, v, info):
        if v is None and "tariff_rate" in info.data:
            return round(float(info.data["tariff_rate"]) * 100, 4)
        return v

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Tariff Scenario
# ---------------------------------------------------------------------------
class ScenarioTariffIn(BaseModel):
    importer_country_id: int
    exporter_country_id: int
    product_id: int
    proposed_tariff_rate: Decimal = Field(..., ge=0)

    class Config:
        from_attributes = True


class ScenarioCreate(BaseModel):
    scenario_name: str = Field(..., min_length=1, max_length=300)
    description: Optional[str] = None
    created_by: Optional[str] = None
    baseline_period: int = Field(..., ge=1900, le=2100)
    tariffs: List[ScenarioTariffIn] = Field(..., min_length=1)


class ScenarioOut(BaseModel):
    scenario_id: int
    scenario_name: str
    description: Optional[str] = None
    created_by: Optional[str] = None
    baseline_period: int
    scenario_status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ScenarioDetailOut(ScenarioOut):
    tariffs: List[ScenarioTariffIn] = []

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Simulation
# ---------------------------------------------------------------------------
class RunSimulationRequest(BaseModel):
    elasticity_assumption: Decimal = Field(
        default=Decimal("-0.5"),
        ge=Decimal("-5"),
        le=Decimal("0"),
        description="Import-demand price elasticity (non-positive). Default -0.5."
    )
    model_version: str = Field(default="1.0", max_length=50)


class SimulationRunOut(BaseModel):
    run_id: int
    scenario_id: int
    model_name: str
    model_version: str
    elasticity_assumption: Optional[Decimal] = None
    baseline_period: int
    run_at: datetime
    run_status: str
    warnings: Optional[str] = None

    class Config:
        from_attributes = True


class SimulationResultOut(BaseModel):
    result_id: int
    run_id: int
    importer_country_id: int
    exporter_country_id: int
    product_id: int
    baseline_import_value: Optional[Decimal] = None
    current_tariff_rate: Optional[Decimal] = None
    current_tariff_pct: Optional[Decimal] = None
    proposed_tariff_rate: Optional[Decimal] = None
    proposed_tariff_pct: Optional[Decimal] = None
    estimated_import_value_after: Optional[Decimal] = None
    estimated_revenue_before: Optional[Decimal] = None
    estimated_revenue_after: Optional[Decimal] = None
    estimated_import_change_pct: Optional[Decimal] = None
    result_status: Optional[str] = None
    result_warning: Optional[str] = None

    @field_validator("current_tariff_pct", mode="before")
    @classmethod
    def set_current_pct(cls, v, info):
        if v is None and "current_tariff_rate" in info.data and info.data["current_tariff_rate"] is not None:
            return round(float(info.data["current_tariff_rate"]) * 100, 4)
        return v

    @field_validator("proposed_tariff_pct", mode="before")
    @classmethod
    def set_proposed_pct(cls, v, info):
        if v is None and "proposed_tariff_rate" in info.data and info.data["proposed_tariff_rate"] is not None:
            return round(float(info.data["proposed_tariff_rate"]) * 100, 4)
        return v

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------
class TopPartnerOut(BaseModel):
    partner_country: str
    partner_iso3: str
    total_value_usd: Decimal
    partner_rank: Optional[int] = None


class TradeBalanceOut(BaseModel):
    period_year: int
    exports_usd: Decimal
    imports_usd: Decimal
    trade_balance_usd: Decimal


class YoYGrowthOut(BaseModel):
    period_year: int
    trade_value_usd: Decimal
    previous_year_value: Optional[Decimal] = None
    yoy_change_pct: Optional[Decimal] = None


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------
class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list
