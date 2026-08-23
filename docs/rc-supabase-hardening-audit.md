# Solar3D RC — Supabase hardening audit

Date: 2026-08-23
Project: `dprsjuqcmfiroilrpvkw`

## Scope

This audit covers the release-candidate workstream in issue #44. It is intentionally limited to changes that can be completed without upgrading the Supabase plan.

## RLS review

The live `public` schema was inspected for RLS policies. The application data policies consistently gate project-derived records through `private.is_org_member(p.organization_id)`. The simulation write policy additionally requires `created_by = auth.uid()` and organization membership.

The catalog tables (`batteries`, `inverters`, `solar_modules`) expose only active rows to authenticated users. `solar_design_defaults` is intentionally readable by authenticated users.

No policy was changed during this audit because changing RLS semantics without an authenticated cross-organization test fixture would create unnecessary production risk.

## Foreign-key index review

The live schema was compared against its foreign keys and indexes. The current schema already has covering single-column indexes for the material foreign-key access paths used by Solar3D:

- `bom_items.design_version_id`
- `design_versions.design_id`
- `designs.project_id`, `designs.site_id`
- `electrical_strings.design_version_id`, `electrical_strings.inverter_id`
- `engineering_results.design_version_id`, `engineering_results.source_simulation_run_id`
- `jobs.design_id`, `jobs.design_version_id`, `jobs.project_id`
- `organization_members.organization_id` (covered by the composite unique index)
- `panel_layouts.design_version_id`, `module_id`, `roof_id`
- `panel_placements.panel_layout_id`
- `projects.customer_id`, `projects.organization_id`
- `proposals.design_version_id`, `proposals.project_id`
- `roof_obstacles.roof_id`
- `roofs.design_id`
- `simulation_runs.design_version_id`
- `sites.project_id`
- `solar_design_defaults.default_module_id`

**Decision:** no new foreign-key indexes are justified from schema inspection alone. We will not add redundant indexes simply to silence an advisor warning.

## Duplicate indexes

The schema already contains a migration that removes the duplicate simulation-run sequence index. No additional duplicate index was identified from the current `pg_indexes` inventory.

## Unused indexes

Supabase may report unused indexes. This audit does **not** remove them. An unused-index observation is not sufficient evidence that an index is safe to delete, particularly for a new application whose production workload is not yet representative.

Deletion should require query statistics from a representative workload and a before/after performance comparison.

## Security finding that remains plan-dependent

Supabase Auth still reports leaked-password protection as a plan-dependent production security item. This cannot be replaced with a database migration without changing the authentication architecture.

Therefore it remains a **production-launch gate**, but it does not block completion of the code/database hardening work in this issue.

## Release decision

The database/RLS work that can be safely completed without Pro is now documented. The next validation gate is authenticated cross-organization E2E plus the existing large-layout performance benchmark.

### Acceptance status

- [x] RLS policy inventory completed
- [x] Foreign-key/index inventory completed
- [x] No evidence-backed missing FK index identified
- [x] Duplicate-index inventory reviewed
- [x] Unused indexes explicitly deferred pending representative workload
- [ ] Cross-organization authenticated E2E
- [ ] Full RC CI gate
- [ ] Supabase Auth leaked-password protection (production-plan gate)
