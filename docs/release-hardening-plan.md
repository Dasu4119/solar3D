# Release Hardening Plan

PM release gate: no production-release claim until security, RLS, performance, and authenticated E2E evidence are green.

## Security / Supabase

Audit and resolve:
- leaked-password protection
- foreign-key covering indexes
- RLS initialization-plan warnings
- overlapping/permissive RLS policies
- duplicate indexes
- unused indexes

For each finding: document impact, implement the smallest safe migration, add regression coverage where practical, and verify the resulting Supabase state.

## Performance

Measure—not estimate—the following workloads:

| Workload | 500 | 1,000 | 2,000 | 5,000 |
|---|---:|---:|---:|---:|
| Auto Layout | required | required | required | required |
| 3D render/update | required | required | required | required |
| Save | required | required | required | required |
| Load | required | required | required | required |
| Simulation | required | required | required | required |
| BOM generation | required | required | required | required |
| Peak memory | required | required | required | required |

The benchmark must record elapsed time and memory, not subjective observations. Include multiple roof planes, obstacles, rotations, and persistence round trips.

## Release decision

- Any unresolved release-blocking security finding: NO-GO.
- Missing authenticated commercial E2E evidence: NO-GO.
- Missing large-layout benchmark evidence: NO-GO.
- Any correctness regression in lineage/provenance: NO-GO.
