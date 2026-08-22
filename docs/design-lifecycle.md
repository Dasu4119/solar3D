# Solar3D Design Lifecycle

## Purpose

This document defines the canonical lifecycle for a solar design and the authority boundaries between editor state, persisted design data, engineering validation, simulation, and commercial outputs.

## Lifecycle

`DRAFT -> GEOMETRY_VALID -> LAYOUT_VALID -> ELECTRICAL_VALID -> SIMULATION_VALID -> ENGINEERING_ACCEPTED -> PROPOSAL_READY`

A design may move forward only when the preceding gate is satisfied. Downstream outputs must not silently consume an earlier or different design revision.

## Authority rules

- Supabase-backed design context is the authority for project, site, roof, module, obstacles, setbacks, placements, electrical configuration, and persisted layout configuration.
- The editor store is UI state plus the current editable draft; it is not an independent engineering source of truth.
- A design version is an immutable engineering snapshot. Ordinary editor saves must not create accepted engineering versions.
- The active design version must be selected explicitly. Consumers must not rely on array ordering such as `versions[0]` or `layouts[0]`.
- An accepted design version is the only version eligible for simulation-backed commercial outputs such as BOM and proposal generation.
- Auto Layout remains a supported product capability. Its inputs are persisted design/layout configuration rather than frontend-only constants.

## Layout configuration

Directional setbacks must be preserved as four independent values:

- north
- east
- south
- west

Other generation inputs such as row spacing and orientation must be stored with the generated layout or its draft configuration so a layout can be reproduced and audited.

## Version semantics

Recommended conceptual separation:

1. **Draft** — editable working state.
2. **Revision** — persisted draft snapshot used for recovery/history.
3. **Engineering version** — immutable validated snapshot.
4. **Accepted version** — explicit engineering version approved for downstream use.

The schema/API implementation should preserve this distinction rather than treating every Save click as an accepted engineering version.

## Downstream gating

Production and financial calculations should reference an explicit design version/simulation input snapshot. BOM and proposal generation must require an accepted design version and should record the accepted version and simulation provenance they used.

## Regression requirements

The implementation must preserve:

- manual panel editing
- Auto Layout
- save/load persistence
- module identity on placements
- roof metadata
- authenticated access control

Tests should cover refresh/reload, explicit active-version selection, rejection of non-accepted downstream generation, and reproduction of an accepted layout from persisted configuration.
