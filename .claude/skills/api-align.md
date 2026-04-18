# API Layer Alignment

Generate or update the API layer (`src/api/*.ts`) to align with the OpenAPI spec.

## Source of Truth

- **OpenAPI yaml**: `file-batch-system/docs/api/console-api.openapi.yaml` — the ONLY authority for parameter names, types, and paths
- **Protocol doc**: `file-batch-system/docs/api/console-api-protocol.md` — human-readable reference only; if it conflicts with the yaml, follow the yaml

## Project Conventions

### HTTP Client (`src/api/client.ts`)
- Exports `get`, `post`, `put`, `del` — generic typed wrappers around axios
- All interceptors (auth, tenant header, idempotency key) are already wired

### Pagination Adapter (`src/api/adapters.ts`)
- `fetchAllPageItems<T>(url, params)` — aggregates all pages into `T[]`
- `toPageResult<T>(items, page, pageSize)` — slices a full array into `PageResult<T>`

### Query Functions (`src/api/queries/*.ts`)
- Pure functions that call `get` / `fetchAllPageItems`
- Accept `tenantId` as the first required param; optional filters after
- Spread optional params conditionally: `...(param != null ? { param } : {})`

### API Modules (`src/api/*.ts`)
- Export an `xxxApi` object with methods: `list`, `detail`, `create`, `update`, `remove`, `toggle`, etc.
- **Dual-path pagination pattern**:
  - No filters → server-side pagination via `get<PageResponse<T>>(url, { tenantId, pageNo, pageSize })`
  - Has filters → `fetchAllPageItems` + client-side `toPageResult`
  - Client-side filter always does a fallback check even when params are sent to backend

### Types (`src/types/console-api.ts`)
- Re-export from `api.generated.ts` (OpenAPI codegen output)
- Only add type aliases here; never hand-write response shapes

## Checklist When Aligning

1. Read the OpenAPI yaml for the endpoint's `parameters` section
2. Match param names EXACTLY (e.g. `startDate` not `fromTime`, `acknowledged` not `status`)
3. Use the correct HTTP method from the yaml
4. For query endpoints (`/api/console/query/*`), prefer `fetchAllPageItems` unless the endpoint is known to support server-side filtering well
5. For mutation endpoints, use `post`/`put`/`del` directly
6. After changes, run `npx vue-tsc --noEmit` and `npx vite build` to verify