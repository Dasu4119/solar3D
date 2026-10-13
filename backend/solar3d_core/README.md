# Solar3D Pro Core Engine — first vertical slice

This package adds an isolated Python/FastAPI backend alongside the existing Next.js application. It does not replace the frontend or migrate existing Supabase code. MongoDB Atlas is the intended persistence layer for core-engine metadata.

## Current scope

- FastAPI liveness and database-readiness endpoints.
- MongoDB connection boundary and initial tenant-scoped indexes.
- Strict Pydantic request models using metres and roof-local XY coordinates.
- Deterministic, grid-based panel placement on one planar roof polygon.
- Geometric setback and obstacle exclusions.
- Unit tests for deterministic output and invalid geometry.

## Not yet production-ready

This is only a foundation. It does not yet implement 3D import adapters, true 3D roof planes, solar position, ray-traced shadows, irradiance, PV electrical modelling, finance, authentication/tenant authorization, durable jobs, or persisted immutable analysis runs. The preview endpoint must not be used as a construction/permit design.

## Run locally

Requires Python 3.11+ and MongoDB.

```bash
cd backend/solar3d_core
python -m venv .venv
# Linux/macOS: source .venv/bin/activate
# Windows: .venv\\Scripts\\activate
pip install -e '.[test]'
cp .env.example .env
uvicorn solar3d_core.main:app --reload
pytest
```

- Liveness: `GET /health/live`
- Readiness: `GET /health/ready` (checks MongoDB and creates required indexes)
- Layout preview: `POST /api/v1/engine/layout/preview`
- OpenAPI: `/docs`

Set `SOLAR3D_MONGODB_URI` to a private development or Atlas connection string. Never commit secrets. Readiness currently initializes indexes; production should move index creation to a controlled migration/release task.
