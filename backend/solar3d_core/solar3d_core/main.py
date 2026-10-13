from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException

from solar3d_core.database import mongo_store
from solar3d_core.layout import preview_layout
from solar3d_core.models import LayoutPreviewRequest, LayoutPreviewResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    # MongoDB is not required to execute pure geometry functions, but readiness
    # remains false until the configured database is reachable.
    mongo_store.connect()
    yield
    mongo_store.close()


app = FastAPI(
    title="Solar3D Pro Core Engine",
    version="0.1.0",
    description="Versioned engineering API for Solar3D Pro.",
    lifespan=lifespan,
)


@app.get("/health/live", tags=["health"])
def liveness() -> dict[str, str]:
    return {"status": "alive"}


@app.get("/health/ready", tags=["health"])
def readiness() -> dict[str, str]:
    if not mongo_store.ping():
        raise HTTPException(status_code=503, detail={"code": "MONGODB_UNAVAILABLE"})
    try:
        mongo_store.ensure_indexes()
    except Exception as exc:
        raise HTTPException(status_code=503, detail={"code": "DATABASE_INDEX_INITIALIZATION_FAILED"}) from exc
    return {"status": "ready", "database": "mongodb"}


@app.post("/api/v1/engine/layout/preview", response_model=LayoutPreviewResponse, tags=["layout"])
def create_layout_preview(request: LayoutPreviewRequest) -> LayoutPreviewResponse:
    try:
        return preview_layout(request)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail={"code": "INVALID_GEOMETRY", "message": str(exc)}) from exc
