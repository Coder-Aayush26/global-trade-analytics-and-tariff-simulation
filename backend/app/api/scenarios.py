"""
Scenario management and simulation endpoints.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import bindparam, text
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import TariffScenario, ScenarioTariff, SimulationRun, SimulationResult
from app.schemas.schemas import (
    ScenarioCreate, ScenarioOut, ScenarioDetailOut,
    RunSimulationRequest, SimulationRunOut, SimulationResultOut,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Scenarios
# ---------------------------------------------------------------------------
@router.post("/scenarios", response_model=ScenarioOut, status_code=201, tags=["Scenarios"])
def create_scenario(payload: ScenarioCreate, db: Session = Depends(get_db)):
    """
    Create a scenario with its proposed tariff rows atomically.
    Rolls back entirely if any constraint fails.
    """
    try:
        scenario = TariffScenario(
            scenario_name   = payload.scenario_name,
            description     = payload.description,
            created_by      = payload.created_by,
            baseline_period = payload.baseline_period,
            scenario_status = "DRAFT",
        )
        db.add(scenario)
        db.flush()  # get scenario_id before committing

        for t in payload.tariffs:
            row = ScenarioTariff(
                scenario_id           = scenario.scenario_id,
                importer_country_id   = t.importer_country_id,
                exporter_country_id   = t.exporter_country_id,
                product_id            = t.product_id,
                proposed_tariff_rate  = t.proposed_tariff_rate,
            )
            db.add(row)

        db.commit()
        db.refresh(scenario)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)[:300])
    return scenario


@router.get("/scenarios", response_model=List[ScenarioOut], tags=["Scenarios"])
def list_scenarios(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(TariffScenario)
    if status:
        q = q.filter(TariffScenario.scenario_status == status.upper())
    return q.order_by(TariffScenario.created_at.desc()).all()


# ---------------------------------------------------------------------------
# Scenario Comparison (must be before /scenarios/{scenario_id})
# ---------------------------------------------------------------------------
@router.get("/scenarios/compare", tags=["Simulation"])
def compare_scenarios(
    run_ids: str = Query(..., description="Comma-separated run IDs, e.g. 1,2,3"),
    db: Session = Depends(get_db),
):
    """Compare results across multiple simulation runs."""
    try:
        ids = [int(x.strip()) for x in run_ids.split(",")]
    except ValueError:
        raise HTTPException(status_code=400, detail="run_ids must be comma-separated integers")

    if not ids:
        return {"warnings": [], "results": []}

    sql = text("""
        SELECT *
        FROM vw_scenario_comparison
        WHERE run_id IN :ids
        ORDER BY run_id, hs_code
    """).bindparams(bindparam("ids", expanding=True))
    rows = db.execute(sql, {"ids": tuple(ids)}).mappings().all()

    # Warn if runs use incompatible baselines
    runs = db.query(SimulationRun).filter(SimulationRun.run_id.in_(ids)).all()
    baselines = {r.baseline_period for r in runs}
    models    = {r.model_version   for r in runs}
    warnings  = []
    if len(baselines) > 1:
        warnings.append(f"Runs use different baseline periods: {baselines}. Comparison may be misleading.")
    if len(models) > 1:
        warnings.append(f"Runs use different model versions: {models}.")

    return {"warnings": warnings, "results": [dict(r) for r in rows]}


@router.get("/scenarios/{scenario_id}", response_model=ScenarioDetailOut, tags=["Scenarios"])
def get_scenario(scenario_id: int, db: Session = Depends(get_db)):
    obj = db.query(TariffScenario).filter(TariffScenario.scenario_id == scenario_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return obj


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
@router.get("/scenarios/{scenario_id}/validate", tags=["Scenarios"])
def validate_scenario(scenario_id: int, db: Session = Depends(get_db)):
    """Pre-flight validation using the validate_scenario DB function."""
    sql = text("SELECT * FROM validate_scenario(:sid)")
    rows = db.execute(sql, {"sid": scenario_id}).mappings().all()
    return {"scenario_id": scenario_id, "issues": [dict(r) for r in rows]}


# ---------------------------------------------------------------------------
# Simulation Runs
# ---------------------------------------------------------------------------
@router.post("/scenarios/{scenario_id}/runs", response_model=SimulationRunOut, status_code=201, tags=["Simulation"])
def run_simulation(
    scenario_id: int,
    payload: RunSimulationRequest,
    db: Session = Depends(get_db),
):
    """
    Run the constant-elasticity tariff simulation via the PostgreSQL stored function.
    Creates a new simulation_run + simulation_result rows atomically.
    """
    # Verify scenario exists
    if not db.query(TariffScenario).filter(TariffScenario.scenario_id == scenario_id).first():
        raise HTTPException(status_code=404, detail="Scenario not found")

    try:
        sql = text("SELECT run_tariff_scenario(:sid, :eps, :mv) AS run_id")
        result = db.execute(sql, {
            "sid": scenario_id,
            "eps": float(payload.elasticity_assumption),
            "mv":  payload.model_version,
        })
        run_id = result.scalar()
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)[:300])

    run = db.query(SimulationRun).filter(SimulationRun.run_id == run_id).first()
    return run


@router.get("/scenarios/{scenario_id}/runs", response_model=List[SimulationRunOut], tags=["Simulation"])
def list_runs(scenario_id: int, db: Session = Depends(get_db)):
    return (
        db.query(SimulationRun)
        .filter(SimulationRun.scenario_id == scenario_id)
        .order_by(SimulationRun.run_at.desc())
        .all()
    )


@router.get("/runs/{run_id}/results", response_model=List[SimulationResultOut], tags=["Simulation"])
def get_results(run_id: int, db: Session = Depends(get_db)):
    results = db.query(SimulationResult).filter(SimulationResult.run_id == run_id).all()
    out = []
    for r in results:
        d = {c.name: getattr(r, c.name) for c in r.__table__.columns}
        # compute pct fields
        if d.get("current_tariff_rate") is not None:
            d["current_tariff_pct"]  = round(float(d["current_tariff_rate"])  * 100, 4)
        if d.get("proposed_tariff_rate") is not None:
            d["proposed_tariff_pct"] = round(float(d["proposed_tariff_rate"]) * 100, 4)
        out.append(SimulationResultOut(**d))
    return out



