"""
FastAPI application entry point.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api import reference, trade, tariffs, scenarios, admin

app = FastAPI(
    title=settings.APP_TITLE,
    version=settings.APP_VERSION,
    description=(
        "Relational Database System for Global Trade Analytics "
        "and Dynamic Tariff Policy Simulation. "
        "DBMS project — PostgreSQL-first design."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS (allow React dev server)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(reference.router,  prefix="/api")
app.include_router(trade.router,      prefix="/api")
app.include_router(tariffs.router,    prefix="/api")
app.include_router(scenarios.router,  prefix="/api")
app.include_router(admin.router,      prefix="/api")


@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "app": settings.APP_TITLE, "version": settings.APP_VERSION}


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}
