"""
SQLAlchemy ORM models mirroring the PostgreSQL schema.
"""
from datetime import date, datetime
from typing import Optional
from sqlalchemy import (
    BigInteger, Boolean, CheckConstraint, Column, Date, DateTime,
    ForeignKey, Integer, Numeric, SmallInteger, String, Text,
    UniqueConstraint, func
)
from sqlalchemy.orm import relationship
from app.db.database import Base


class Country(Base):
    __tablename__ = "country"
    country_id   = Column(Integer, primary_key=True)
    iso3         = Column(String(3), nullable=False, unique=True)
    iso2         = Column(String(2))
    country_name = Column(String(200), nullable=False)
    region       = Column(String(100))
    income_group = Column(String(60))
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), server_default=func.now())

    # relationships
    reported_trades = relationship("TradeObservation", foreign_keys="TradeObservation.reporter_country_id", back_populates="reporter")
    partner_trades  = relationship("TradeObservation", foreign_keys="TradeObservation.partner_country_id", back_populates="partner")
    tariff_imports  = relationship("TariffPolicy",     foreign_keys="TariffPolicy.importer_country_id")


class Product(Base):
    __tablename__ = "product"
    __table_args__ = (
        UniqueConstraint("hs_code", "hs_version", name="uq_product_code_version"),
    )
    product_id          = Column(Integer, primary_key=True)
    hs_code             = Column(String(20), nullable=False)
    hs_version          = Column(String(20), nullable=False)
    product_description = Column(Text, nullable=False)
    hs_chapter          = Column(String(10))
    parent_hs_code      = Column(String(20))
    created_at          = Column(DateTime(timezone=True), server_default=func.now())
    updated_at          = Column(DateTime(timezone=True), server_default=func.now())


class DataSource(Base):
    __tablename__ = "data_source"
    source_id             = Column(Integer, primary_key=True)
    source_name           = Column(String(200), nullable=False)
    source_url            = Column(Text)
    retrieved_at          = Column(Date)
    license_or_usage_note = Column(Text)
    source_version        = Column(String(100))
    created_at            = Column(DateTime(timezone=True), server_default=func.now())


class IngestionBatch(Base):
    __tablename__ = "ingestion_batch"
    batch_id              = Column(Integer, primary_key=True)
    source_id             = Column(Integer, ForeignKey("data_source.source_id"), nullable=False)
    started_at            = Column(DateTime(timezone=True), server_default=func.now())
    completed_at          = Column(DateTime(timezone=True))
    batch_status          = Column(String(30), nullable=False, default="RUNNING")
    input_record_count    = Column(Integer)
    loaded_record_count   = Column(Integer)
    rejected_record_count = Column(Integer)
    error_summary         = Column(Text)


class TradeObservation(Base):
    __tablename__ = "trade_observation"
    __table_args__ = (
        UniqueConstraint(
            "reporter_country_id", "partner_country_id", "product_id",
            "period_year", "flow_direction", "source_id",
            name="uq_trade_observation"
        ),
    )
    trade_id            = Column(Integer, primary_key=True)
    reporter_country_id = Column(Integer, ForeignKey("country.country_id"), nullable=False)
    partner_country_id  = Column(Integer, ForeignKey("country.country_id"), nullable=False)
    product_id          = Column(Integer, ForeignKey("product.product_id"), nullable=False)
    period_year         = Column(SmallInteger, nullable=False)
    flow_direction      = Column(String(10), nullable=False)
    trade_value_usd     = Column(Numeric(20, 4), nullable=False)
    quantity            = Column(Numeric(20, 4))
    quantity_unit       = Column(String(50))
    net_weight_kg       = Column(Numeric(20, 4))
    source_id           = Column(Integer, ForeignKey("data_source.source_id"), nullable=False)
    batch_id            = Column(Integer, ForeignKey("ingestion_batch.batch_id"))
    reported_at         = Column(DateTime(timezone=True), server_default=func.now())

    reporter = relationship("Country", foreign_keys=[reporter_country_id], back_populates="reported_trades")
    partner  = relationship("Country", foreign_keys=[partner_country_id],  back_populates="partner_trades")
    product  = relationship("Product")


class TariffPolicy(Base):
    __tablename__ = "tariff_policy"
    tariff_policy_id    = Column(Integer, primary_key=True)
    importer_country_id = Column(Integer, ForeignKey("country.country_id"), nullable=False)
    exporter_country_id = Column(Integer, ForeignKey("country.country_id"))
    product_id          = Column(Integer, ForeignKey("product.product_id"), nullable=False)
    tariff_type         = Column(String(30), nullable=False, default="AD_VALOREM")
    tariff_rate         = Column(Numeric(10, 6), nullable=False)
    rate_unit           = Column(String(50))
    effective_from      = Column(Date, nullable=False)
    effective_to        = Column(Date)
    source_id           = Column(Integer, ForeignKey("data_source.source_id"), nullable=False)
    batch_id            = Column(Integer, ForeignKey("ingestion_batch.batch_id"))
    agreement_id        = Column(Integer, ForeignKey("trade_agreement.agreement_id"))
    policy_note         = Column(Text)


class TradeAgreement(Base):
    __tablename__ = "trade_agreement"
    agreement_id   = Column(Integer, primary_key=True)
    agreement_name = Column(String(300), nullable=False)
    effective_from = Column(Date)
    effective_to   = Column(Date)
    official_ref   = Column(String(200))
    notes          = Column(Text)

    members = relationship("AgreementMember", back_populates="agreement")


class AgreementMember(Base):
    __tablename__ = "agreement_member"
    agreement_id = Column(Integer, ForeignKey("trade_agreement.agreement_id"), primary_key=True)
    country_id   = Column(Integer, ForeignKey("country.country_id"), primary_key=True)

    agreement = relationship("TradeAgreement", back_populates="members")
    country   = relationship("Country")


class TariffScenario(Base):
    __tablename__ = "tariff_scenario"
    scenario_id     = Column(Integer, primary_key=True)
    scenario_name   = Column(String(300), nullable=False)
    description     = Column(Text)
    created_by      = Column(String(200))
    baseline_period = Column(SmallInteger, nullable=False)
    scenario_status = Column(String(20), nullable=False, default="DRAFT")
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), server_default=func.now())

    tariffs = relationship("ScenarioTariff", back_populates="scenario")
    runs    = relationship("SimulationRun",  back_populates="scenario")


class ScenarioTariff(Base):
    __tablename__ = "scenario_tariff"
    scenario_id           = Column(Integer, ForeignKey("tariff_scenario.scenario_id", ondelete="CASCADE"), primary_key=True)
    importer_country_id   = Column(Integer, ForeignKey("country.country_id"), primary_key=True)
    exporter_country_id   = Column(Integer, ForeignKey("country.country_id"), primary_key=True)
    product_id            = Column(Integer, ForeignKey("product.product_id"), primary_key=True)
    proposed_tariff_rate  = Column(Numeric(10, 6), nullable=False)

    scenario = relationship("TariffScenario", back_populates="tariffs")


class SimulationRun(Base):
    __tablename__ = "simulation_run"
    run_id                = Column(Integer, primary_key=True)
    scenario_id           = Column(Integer, ForeignKey("tariff_scenario.scenario_id"), nullable=False)
    model_name            = Column(String(100), nullable=False, default="constant_elasticity_v1")
    model_version         = Column(String(50), nullable=False, default="1.0")
    elasticity_assumption = Column(Numeric(8, 4))
    baseline_period       = Column(SmallInteger, nullable=False)
    run_at                = Column(DateTime(timezone=True), server_default=func.now())
    run_status            = Column(String(20), nullable=False, default="PENDING")
    warnings              = Column(Text)
    execution_notes       = Column(Text)

    scenario = relationship("TariffScenario", back_populates="runs")
    results  = relationship("SimulationResult", back_populates="run")


class SimulationResult(Base):
    __tablename__ = "simulation_result"
    result_id                    = Column(Integer, primary_key=True)
    run_id                       = Column(Integer, ForeignKey("simulation_run.run_id"), nullable=False)
    importer_country_id          = Column(Integer, ForeignKey("country.country_id"), nullable=False)
    exporter_country_id          = Column(Integer, ForeignKey("country.country_id"), nullable=False)
    product_id                   = Column(Integer, ForeignKey("product.product_id"), nullable=False)
    baseline_import_value        = Column(Numeric(20, 4))
    current_tariff_rate          = Column(Numeric(10, 6))
    proposed_tariff_rate         = Column(Numeric(10, 6))
    estimated_import_value_after = Column(Numeric(20, 4))
    estimated_revenue_before     = Column(Numeric(20, 4))
    estimated_revenue_after      = Column(Numeric(20, 4))
    estimated_import_change_pct  = Column(Numeric(10, 4))
    result_status                = Column(String(30), default="OK")
    result_warning               = Column(Text)

    run = relationship("SimulationRun", back_populates="results")


class TariffAudit(Base):
    __tablename__ = "tariff_audit"
    audit_id         = Column(Integer, primary_key=True)
    tariff_policy_id = Column(Integer, nullable=False)
    operation        = Column(String(1), nullable=False)
    old_tariff_rate  = Column(Numeric(10, 6))
    new_tariff_rate  = Column(Numeric(10, 6))
    old_effective_from = Column(Date)
    new_effective_from = Column(Date)
    old_effective_to   = Column(Date)
    new_effective_to   = Column(Date)
    changed_by       = Column(String(200))
    changed_at       = Column(DateTime(timezone=True), server_default=func.now())
    reason           = Column(Text)
