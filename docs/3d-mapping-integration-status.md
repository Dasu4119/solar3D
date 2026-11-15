# 3D geographic mapping integration — implementation status

## Implemented in this branch

- A dedicated project route at `/projects/{projectId}/mapping`.
- An interactive Three.js / React Three Fiber engineering view using the existing project roof polygon and saved panel placements.
- WGS84 site-origin entry and validation.
- A server-side Next.js proxy for the backend coordinate conversion endpoint.
- Backend WGS84 geodetic ↔ local ENU conversion using the WGS84 ellipsoid.
- Explicit coordinate convention: X east, Y north, Z up.
- Unit and API contract tests for coordinate transforms.

## Important scope boundary

The repository did not contain a dedicated geographic map component to remove. The existing design workspace is an SVG-based 2D roof/panel editor, so this branch keeps it intact and adds a 3D view rather than deleting working design functionality.

This first implementation is an engineering 3D site/roof viewer, not a satellite basemap or photogrammetric roof-detection system. It does not claim that a roof model is geographically measured from imagery. A provider-backed CesiumJS / MapLibre geographic basemap, address geocoder, terrain/imagery licensing, and persistent site-origin storage remain a separately testable integration step. No paid mapping key is required by this implementation.

## Configuration

Set `SOLAR3D_CORE_API_URL` on the Next.js server to the reachable FastAPI core URL. Do not expose this as a `NEXT_PUBLIC_` variable.

## Verification still required

Run frontend typecheck/build and backend pytest in the actual CI/runtime environment. Verify the backend URL and deployment network route before enabling the coordinate validation action in a deployed environment.
