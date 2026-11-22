# batch-console

**English** | [中文](README.md)

> Self-hosted operations console for File Batch System: a desktop and mobile interface that unifies configuration → orchestration → execution → observability → governance for a multi-tenant batch platform.

[![PR Gate](https://github.com/pinpols/batch-console/actions/workflows/pr-gate.yml/badge.svg)](https://github.com/pinpols/batch-console/actions/workflows/pr-gate.yml)
[![Full CI](https://github.com/pinpols/batch-console/actions/workflows/full-ci-gate.yml/badge.svg)](https://github.com/pinpols/batch-console/actions/workflows/full-ci-gate.yml)
[![CodeQL](https://github.com/pinpols/batch-console/actions/workflows/codeql.yml/badge.svg)](https://github.com/pinpols/batch-console/actions/workflows/codeql.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node.js-24-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org/)

[User guide](docs/user-guide/README.md) · [Quick start](#quick-start) · [Capabilities](#capabilities) · [Project structure](#project-structure) · [Documentation index](docs/README.md) · [Contributing](CONTRIBUTING.md) · [Backend](https://github.com/pinpols/file-batch-system)

## What is this?

Batch Console (BC) is the **control-plane frontend** of [File Batch System](https://github.com/pinpols/file-batch-system). It manages platform configuration and run operations through `batch-console-api`, and does not schedule tasks, execute workers, or persist run state:

- Configuration, publishing, replay, and approval entry points for jobs, workflows, file pipelines, and batch days;
- Aggregated instances, alerts, Outbox, workers, capacity, and audit information, with cross-page Trace ID troubleshooting;
- A complete desktop console and a lightweight mobile surface within tenant and permission boundaries;
- API types generated from the backend OpenAPI spec, with CI drift checks and integration flows kept in sync.

## Capabilities

| Area | Capabilities |
| ---- | ------------ |
| Configuration & orchestration | Jobs, DAG workflows, pipelines, file channels, resource queues, and tenant configuration packages |
| Runs & handling | Instance queries, triggering, retry, cancel, batch day replay, approvals, and compensation |
| Observability | Run overview, alerts, Outbox, Trace ID, worker fingerprints, capacity, and file arrival progress |
| Platform governance | Multi-tenant permissions, audit, configuration sync, secret management, internationalization, and theme switching |
| Engineering delivery | OpenAPI type generation, Vitest, Playwright, visual regression, Docker/Nginx, and layered CI |

## Quick start

### Requirements

- Node.js 24; local, CI, and images all use the version pinned in `.node-version` / `.nvmrc`
- Backend repository for integration: `../file-batch-system`
- Default Console API address: `http://localhost:18080`

### Install and run

```bash
npm ci
npm run dev
```

The dev server runs at `http://localhost:5173`. Vite proxies `/api` to the backend; override the target with `VITE_DEV_PROXY_TARGET` in `.env.development`. Date/time values use the browser IANA timezone by default; set `VITE_DISPLAY_TIMEZONE=Asia/Shanghai` to pin them, and saved user preferences take precedence.

Makefile targets: `make help`; `make install` runs `npm ci` per the lockfile; `make lint` only checks, `make lint-fix` applies fixes; `make dev-all` starts Vite and the docs process only and does not stop Docker frontend containers.

Common commands:

```bash
npm run gen:api        # Regenerate src/types/api.generated.ts from the backend OpenAPI
npm run typecheck      # vue-tsc type check
npm run build          # Type check + production build
npm run build:fast     # Vite build only
npm run test:unit      # Vitest
npm run test:e2e       # Playwright regular suite, excluding @slow
npm run test:e2e:all   # Full release acceptance suite
npm run dev:all        # Build docs and serve them from the same origin at /docs/
npm run check:health   # Integration health check (BE actuator + OpenAPI drift + preview port); alias: make health
npm run check:architecture # API layering and circular dependencies
npm run check:docs     # Current document links and local path drift
npm run verify:local   # Complete local gate without a backend
```

For local work, `npm run dev:all` builds the docs and starts the console so the unified documentation site is served at `http://localhost:5173/docs/`. Override the frontend and backend docs sources with `FRONTEND_DOCS_ROOT` and `BACKEND_DOCS_ROOT`; see [Unified documentation site](docs/engineering/unified-documentation-site.md).

> **Run `make health` first when integration looks odd** — it probes console-api / trigger / orchestrator at the protocol level and checks API drift.
> Staging: override `BE_CONSOLE_URL` / `BE_TRIGGER_URL` / `BE_ORCH_URL` to point at the remote hosts.
> See the header of [`scripts/local/health-check.sh`](scripts/local/health-check.sh).

## API and contracts

- The authoritative OpenAPI source lives in the backend repository: `../file-batch-system/docs/api/console-api.openapi.yaml`
- Generated frontend types: `src/types/api.generated.ts`
- Business type exports: `src/types/console-api.ts`
- Authentication endpoints live under `/api/console/auth/*` in `../file-batch-system/batch-console-api`

When changing an API, update the backend contract first and regenerate the frontend types; do not hand-write DTOs that diverge from OpenAPI.

## Project structure

```text
src/
├── api/                 # Thin Console API wrappers, interceptors, query adapters
├── charts/              # ECharts registration entry
├── components/
│   ├── common/          # PageHeader, SectionCard, StatusTag, CommandPalette, etc.
│   └── table/           # ProTable, ListPageQueryBar, pagination and skeletons
├── composables/         # Tenant reload, auto refresh, route filters, confirmation dialogs
├── constants/           # Navigation, page metadata, status, theme, and density constants
├── directives/          # Permission, hover-tab, safe-html, and other directives
├── layout/              # Desktop app shell, sidebar, header, tabs
├── layout-mobile/       # Mobile app shell and shared styles
├── locales/             # zh-CN / en-US messages
├── router/              # Desktop and /m/* mobile routes
├── stores/              # Pinia stores for auth, tenant, permission, tabs, app
├── styles/              # Design tokens, reset, Element Plus overrides
├── types/               # Generated OpenAPI types and business type exports
├── utils/               # Request, safe HTML, logging, time, formatting utilities
├── views/               # Desktop business pages
└── views-mobile/        # Mobile business pages
```

Desktop pages are grouped by business domain under `views/`; the mobile app uses separate `/m/*` routes and shares API, stores, and composables.

## Frontend conventions

- Desktop views that depend on `tenant.tenantId` use `useTenantReload(loadFn)`; TanStack Query callers put `tenant.tenantId` in the `queryKey`.
- Every rendered HTML string must go through `v-safe-html` or `purifyHtml()`; do not use raw `v-html` or un-sanitized `innerHTML`.
- Page titles, descriptions, and navigation copy live in `pageMeta.ts` and `locales/`; update both when adding a page.
- Sidebar copy, icons, and order follow the frontend `navigationGroups`; the backend `/auth/me` menu only controls visibility.
- Mobile `/m/*` pages do not get automated tests by default unless they add independent business logic or capture a desktop-uncovered regression.

See [AGENTS.md](./AGENTS.md) for cross-repository collaboration rules.

## Documentation

Product usage starts from the [role-based user guide](./docs/user-guide/README.md), which covers the four formal roles, onboarding, jobs and workflows, runs and approvals, file imports, observability, and platform governance. The engineering documentation entry is [docs/README.md](./docs/README.md), and [Convention and CI periodic review](./docs/engineering/convention-drift-review.md) covers frontend/backend drift that gates cannot detect automatically. Before adding or revising a document, decide whether it is a product manual, long-term design, stage report, or archived material, and avoid maintaining the same fact in several places.

## Contributing

Frontend contributions go beyond page development: they also cover API contract sync, interaction and accessibility, tests, documentation, and delivery governance. Before editing, confirm the authoritative entry point for the change type:

| Change type | Read first | Minimum delivery |
| ----------- | ---------- | ---------------- |
| Pages, components, interaction | `src/views/`, `src/components/`, `src/styles/` | Reuse existing design tokens and components; keep zh/en messages in sync; add desktop tests proportional to risk |
| API, permissions, tenant logic | Backend OpenAPI, `src/api/`, `src/types/api.generated.ts` | Follow the backend contract, run `npm run gen:api`, never hand-write generated types or bypass the shared client |
| State, pagination, polling | `src/composables/`, `src/stores/`, `src/api/queries/` | Keep tenant switching, cache keys, cancellation, and error states consistent; do not duplicate data-flow logic per page |
| Tests and CI | [Testing guide](./docs/testing/README.md), [CI runbook](./docs/runbook/ci.md) | Separate unit, mocked E2E, and real-backend acceptance; never report SKIP or unrun checks as passing |
