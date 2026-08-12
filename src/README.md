# Solar3D Frontend

Frontend architecture for the Solar3D application.

## Architecture

- `app/` — Next.js routes and page composition
- `features/` — business workflows such as design, auto-layout, engineering, energy, financials, BOM, and proposal
- `entities/` — domain models
- `widgets/` — composed product UI such as the roof editor, panel canvas, and 3D viewer
- `engine/` — CAD, geometry, snapping, measurements, and 3D engine code
- `shared/` — API client, components, hooks, validation, types, and utilities

## Backend

Supabase remains the backend source of truth: Auth, Edge Functions, PostgreSQL, and Storage. No duplicate application backend is planned.
