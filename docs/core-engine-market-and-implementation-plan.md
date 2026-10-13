# Solar3D Pro Core Engine — market-informed implementation plan

Status: engineering plan; market research is a public-source desk review, not a customer survey or independent accuracy benchmark.

## Product signals from public documentation

- OpenSolar describes interactive customer-facing 3D proposals with shading/irradiance views and system-option comparisons. Source: https://support.opensolar.com/hc/en-us/articles/17311904509711-3D-Design-in-Proposal-Sharing-an-Interactive-3D-Proposal-with-Your-Customer
- OpenSolar describes automated 3D design, pitch/azimuth/shading calculation, bill of materials and annual shading analysis. Source: https://www.opensolar.com/auto-design/
- Aurora Solar promotes automated 3D design, shading analysis, financing and customer proposal workflows. Source: https://www.aurorasolar.com/aurora-ai/
- HelioScope promotes commercial rooftop and storage design, automatic layouts and production simulation. Source: https://helioscope.aurorasolar.com/design-solutions/
- PVsyst documentation distinguishes irradiance shading from electrical mismatch and describes detailed module-layout calculations. Source: https://www.pvsyst.com/help/project-design/shadings/electrical-shadings-module-layout/calculation-in-the-simulation.html
- MNRE publishes official rooftop solar programme and scheme material. Rules and rates must be checked against the current applicable official notification before any quote is issued. Source: https://mnre.gov.in/en/grid-connected-solar-rooftop-programme/

## Product requirements implied by this review

1. Fast initial design, with explicit user review of uncertain roof geometry.
2. Customer-friendly 3D output backed by traceable engineering calculations.
3. Residential and commercial workflows; commercial scale must be measured with realistic benchmark scenes.
4. Distinguish geometric shade, irradiance loss and electrical mismatch loss.
5. India-first tariff, incentive, equipment and regulatory data with provenance, effective dates and review/publish gates.
6. Reports must state assumptions, input quality, engine/model versions and uncertainty.
7. Historical designs and proposals must remain reproducible after catalogues or models change.

## Target architecture

- Frontend: existing Next.js/React/Three.js application.
- API and numerical core: Python + FastAPI + Pydantic.
- Persistence: MongoDB Atlas for project metadata, immutable revisions, catalogues, job metadata and analysis provenance.
- Binary assets: private object storage; do not store large meshes, CAD files or PDFs as MongoDB documents.
- Compute: isolated workers for import, geometry, shadow/energy simulation and report generation.
- Reliability: idempotent jobs, bounded retries, correlation IDs, tenant isolation, tested restore and independent calculation fixtures.

## Delivery sequence and exit criteria

### Stage 0 — Foundation (current branch)
- Add isolated Python package and FastAPI application.
- Add MongoDB configuration and initial index definitions.
- Add strict metre-based roof-local polygon contracts.
- Add deterministic layout preview with setbacks and obstacle exclusions.
- Test deterministic output and invalid geometry.

Exit: unit tests pass in CI; API contract reviewed; no secret or production data committed.

### Stage 1 — Canonical geometry
- Canonical scene schema with stable IDs, units, north, transform matrix, source checksum and adapter version.
- Geometry validation and diagnostics.
- One import adapter selected from pilot evidence (DXF or glTF/GLB; IFC only if the first pilot requires it).
- Revision snapshots and scene hashes.

Exit: known-dimension fixtures, save/reload round trip, invalid geometry tests, import fidelity/loss report.

### Stage 2 — Solar position and geometric shadow
- Select and review a licensed solar-position implementation.
- Explicit latitude, longitude, timezone, date/time and north convention.
- Ray/triangle intersection with deterministic handling of grazing and coplanar cases.
- Separate geometric shaded fraction from irradiance and electrical losses.

Exit: independently reviewed solar-position instants and analytic no-obstacle/full-obstruction/partial-shade fixtures.

### Stage 3 — Irradiance and energy
- Versioned weather/irradiance adapters and data provenance.
- Plane-of-array irradiance, temperature and performance model.
- Loss waterfall and uncertainty reporting.
- Independent comparison against a selected reference model.

Exit: documented tolerances by model/input type; missing-data behavior is explicit.

### Stage 4 — Electrical validation
- Module/inverter specifications and effective-dated catalogues.
- String sizing, cold/hot voltage, current limits, MPPT constraints, DC/AC ratio.
- Later-stage module/string-level shading mismatch only when validated models and required inputs exist.

Exit: manufacturer datasheet fixtures, boundary tests and electrical reviewer sign-off.

### Stage 5 — Financial and India workflows
- Cash-flow model with decimal-safe money.
- Self-consumption and export value separated.
- Financing vs unlevered economics, NPV, payback, IRR edge cases and sensitivity.
- State/DISCOM-specific tariffs, subsidy/incentive data and approval workflow.

Exit: hand-calculated fixtures and current official source references for each published assumption.

### Stage 6 — Production hardening
- Authenticated tenant-scoped API and authorization tests.
- Durable asynchronous jobs, cancellation, idempotency and dead-letter handling.
- Asset scanning, quotas, worker isolation, telemetry, restore drills and rollout gates.

Exit: security tests, load/performance targets, restore evidence and reviewed release checklist.

## Non-negotiable engineering rules

- MongoDB stores evidence and state; it is not the numerical computation engine.
- Do not use binary floating-point for exact currency arithmetic.
- Never silently rewrite issued proposals or historical analysis.
- Never report a shaded-area fraction as an energy-loss percentage.
- Never publish an India tariff/subsidy assumption without source, effective date, region and verification status.
- Any material calculation change increments a model version and runs the regression corpus.
- No claim of bankability, regulatory compliance or construction readiness without a documented validation programme.
