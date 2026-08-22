# P0 Lifecycle Acceptance Checklist

- [ ] Save updates an existing draft instead of creating a new engineering version on every click.
- [ ] A working draft never replaces `designs.active_version_id`.
- [ ] `get_design_context` returns explicit draft, active and working versions.
- [ ] Consumers select an explicit `active_layout_id`.
- [ ] Directional setbacks survive save -> refresh -> load unchanged.
- [ ] Auto Layout remains available and uses persisted configuration.
- [ ] Finalization is required before engineering acceptance.
- [ ] Geometry, electrical, simulation provenance and engineering validation all pass before acceptance.
- [ ] Proposal/BOM downstream operations consume only an accepted design version.
- [ ] Existing manual editing and authenticated persistence E2E remain green.
