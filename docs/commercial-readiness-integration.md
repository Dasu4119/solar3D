# Commercial Readiness Integration

## PM decision

Commercial readiness is an authoritative product workflow, not a decorative status panel. The UI must reflect backend lineage and must never infer BOM or proposal readiness from local editor state.

## Canonical lineage

`Design Version → Engineering Acceptance → Simulation → Financial Run → BOM Run → Proposal Run`

## Product rules

1. Draft or unaccepted designs cannot generate BOM or proposal outputs.
2. Engineering acceptance is required before downstream commercial generation.
3. Simulation and financial results must match the active design version and its content hash.
4. BOM and proposal records are immutable snapshots and must retain upstream lineage.
5. Reference-yield simulations are visibly labeled as reference estimates.
6. Site-weather simulations expose provider, source, coordinates and observation period.
7. Stale or mismatched downstream outputs remain blocked.
8. Every commercial action must invoke an authoritative backend contract; disabled/dead placeholder actions are not acceptable.
9. Readiness must survive refresh because it is derived from persisted backend state.
10. Accessibility: readiness status uses semantic labels, actionable blockers, keyboard-accessible controls and does not rely on color alone.

## Integration boundary

`DesignWorkspace` consumes a single readiness view-model from the commercial-readiness domain. It does not calculate readiness itself.

The readiness view-model should expose:

- design status
- engineering status
- simulation status and provenance
- financial status
- BOM status
- proposal status
- blockers
- warnings
- actionable next step

## Release gate

A commercial proposal is ready only when all required upstream records are present, immutable, current, and lineage-compatible with the active engineering design version.
