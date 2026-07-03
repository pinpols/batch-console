# Frontend Usability And Design Audit

Date: 2026-06-25

Scope: batch-console desktop web app plus a quick mobile spot check. Evidence was captured from the running local frontend at `http://127.0.0.1:5173` against local backend services.

User goal: as an admin/operator, maintain tenants and jobs, operate job runs, inspect logs, and understand whether the platform is healthy.

Accessibility target: practical WCAG 2.2 AA risk review from screenshots and DOM signals only. This is not a full keyboard/screen-reader audit.

## Evidence

Screenshots:

1. `screenshots/01-ops-summary.png` - desktop operations summary.
2. `screenshots/02-job-definitions-list.png` - job definition list.
3. `screenshots/03-job-wizard.png` - new job wizard.
4. `screenshots/04-job-detail.png` - job detail tabs.
5. `screenshots/05-job-instances-list.png` - job instance operations list.
6. `screenshots/06-tenant-list.png` - tenant management.
7. `screenshots/07-execution-logs.png` - observability execution logs.
8. `screenshots/08-worker-management.png` - worker management.
9. `screenshots/09-mobile-ops-summary-retry.png` - mobile operations summary.
10. `screenshots/09-mobile-ops-summary-fullpage.png` - mobile operations summary full-page.
11. `screenshots/10-mobile-jobs-list-retry.png` - mobile job instances.

## Step Health

| Step | Screen | Health | Notes |
|---|---|---|---|
| 1 | Ops summary | Medium | Main metrics are clear, but all cards look equally clickable/important and worker empty state conflicts with backend health expectations. |
| 2 | Job definition list | Medium | High-density table is operationally useful, but search/filter/action hierarchy is crowded and mixed language lowers clarity. |
| 3 | New job wizard | Good | 8-step structure is understandable and progressive. First step is visually heavy but workable. |
| 4 | Job detail | Medium | 9-tab consolidation is coherent. Dense label/value tables and mixed raw field names make scanning slower. |
| 5 | Job instance list | Good | Strong operator workflow: filters, status, trace, SLA, and row actions are visible. Main issue is dense controls competing for attention. |
| 6 | Tenant list | Good | Tenant lifecycle actions are discoverable. Current tenant state is visible both in stats and row tag. |
| 7 | Execution logs | Medium | Trace-first workflow is useful. Log summary renders escaped JSON fragments, which hurts readability and trust. |
| 8 | Worker management | Medium | Page structure is simple, but "实时" plus "暂无数据" gives no explanation of whether there are no workers, filtered results, or a backend issue. |
| 9 | Mobile summary | Medium | Mobile cards are legible and task-oriented, but light app/nav bars against black content feel visually inconsistent. |
| 10 | Mobile job list | Good | Mobile list is readable, compact, and action-oriented. Console warning indicates implementation cleanup is needed. |

## Strengths

- The product has a coherent operator model: summary -> definition -> run -> logs -> worker/tenant management.
- The 9-tab job detail design is a good base for complex job governance; related config is not scattered across separate pages.
- The new job wizard is a meaningful usability improvement over a large one-shot form.
- Tables expose the right operational pivots: status, trace ID, job code, SLA, biz date, worker group, and row actions.
- Mobile has a separate card-first experience instead of merely shrinking desktop tables.

## UX Risks

### P0 - Mobile layout emits unresolved component warnings

Evidence: while loading `/m/ops/summary` and `/m/jobs`, console repeatedly logged:

`Failed to resolve component: MInstallHint`

Relevant files:

- `src/layout-mobile/MobileLayout.vue`
- `src/layout-mobile/MInstallHint.vue`

Why it matters: even if the screen renders, unresolved component warnings indicate a registration/import issue or compiler resolution issue. In a mobile access scenario this weakens confidence, and future changes can turn the warning into a visible break.

Recommendation: explicitly import `MInstallHint` in `MobileLayout.vue`, then add a small smoke assertion for `/m/ops/summary` that fails on Vue warn/error during render.

### P1 - Worker page empty state is not explanatory enough

Evidence: `screenshots/08-worker-management.png` shows a green realtime dot and "暂无数据". Backend services are healthy, but the table has no visible explanation.

Why it matters: operations users need to distinguish four states: no workers registered, current filters empty, backend not returning registry data, or tenant mismatch.

Recommendation: replace generic empty text with a diagnostic empty state:

- "当前租户暂无 Worker 注册记录"
- show active filters if any
- show "最后刷新时间"
- offer "查看注册链路 / 刷新 / 清空筛选"

### P1 - Log summaries show escaped JSON instead of readable evidence

Evidence: `screenshots/07-execution-logs.png` shows strings like `{&quot;totalCount&quot;...}` in the summary column.

Why it matters: logs are a trust surface. Escaped entities make users question whether data is corrupted and slow down incident triage.

Recommendation: decode and render safe plain text or structured key/value preview. Keep raw JSON available in detail drawer with copy.

### P1 - Mixed Chinese and raw backend field names slow scanning

Evidence:

- `screenshots/04-job-detail.png` mixes `jobCode`, `jobName`, `scheduleExpr`, `workerGroup` with Chinese section headings.
- `screenshots/02-job-definitions-list.png` mixes English column names with Chinese action labels.

Why it matters: the system looks more like an internal database console than a polished admin product. Operators have to translate field names while making decisions.

Recommendation: use Chinese business labels as primary text and keep raw API keys as secondary/copyable metadata where needed. Example: `作业编码 jobCode`, `调度表达式 scheduleExpr`.

### P1 - Top tenant switcher looks like a normal text input

Evidence: all desktop screenshots show top-right `租户 ta` inside a text-field-like control.

Why it matters: tenant context is global and high-impact. It should feel like a context selector, not a free text input. Accidental edits or unclear affordance can cause users to work in the wrong tenant.

Recommendation: render as a compact global context switcher with dropdown affordance, recent tenants, current tenant badge, and a confirmation/clear state when switching across tenant boundaries.

### P2 - Desktop density is useful but hierarchy is too flat

Evidence: list pages have query controls, table toolbar, row actions, and nav controls packed into a single visual band.

Why it matters: expert users benefit from density, but new or stressed operators need stronger grouping. Current pages make search, reset, refresh, create, column settings, and row operations compete visually.

Recommendation:

- Keep dense layout, but split "primary task" from "maintenance tools".
- Use one primary action per page area.
- Move secondary controls such as column settings and refresh into a consistent toolbar position.

### P2 - Dashboard metric cards lack severity grouping

Evidence: `screenshots/01-ops-summary.png` shows cards in a uniform grid. Failed tasks and outbox failures are colored, but the layout itself does not guide incident order.

Why it matters: for operations, first-glance triage should prioritize failing and time-sensitive states.

Recommendation: group cards into "Needs attention", "Running capacity", and "Backlog / outbox". Consider sorting non-zero severe metrics first.

### P2 - Mobile visual language diverges from desktop

Evidence: mobile screenshots show black content, light gray app bar and tab bar, and blue iOS-style icons. Desktop uses a dark, glassy shell.

Why it matters: the mobile product feels like a separate prototype rather than the same system. This can be acceptable, but currently the contrast between bars and content is abrupt.

Recommendation: either fully embrace iOS light chrome with grouped dark cards, or align mobile chrome with the desktop dark shell. Avoid mixed chrome unless intentionally documented in tokens.

## Accessibility Risks

- Low-contrast secondary labels are likely risky in dark mode. Several labels and placeholders appear gray-on-dark with small font sizes.
- Icon-only desktop sidebar needs reliable accessible labels and active-state naming. The visible screenshot only shows icons, not text.
- Many table row actions are small pill buttons; touch target size is acceptable on desktop but may be tight under zoom.
- Form required state is visible through red asterisks, but some validation instructions are low contrast.
- Mobile bottom tab labels are small on a light translucent bar; check contrast and 200% zoom.
- Screenshot review cannot confirm keyboard tab order, focus ring visibility, screen-reader table semantics, or live-region announcements.

## Recommended Fix Order

1. Fix mobile `MInstallHint` warning and add a no-console-error mobile smoke.
2. Improve Worker empty state with explicit reason, last refresh, active filters, and recovery actions.
3. Decode execution log summaries and add structured preview/copy.
4. Normalize field labels on job list/detail: Chinese primary, raw key secondary.
5. Redesign tenant switcher as a global context selector.
6. Rebalance list-page toolbar hierarchy.
7. Tune dark-mode contrast for secondary labels, placeholders, and disabled text.
8. Align mobile app/tab bar color system with the rest of the product.

## Verification Gaps

- No full keyboard-only pass was performed.
- No screen-reader pass was performed.
- No color contrast tooling was run; contrast observations are visual risk calls.
- Only one desktop viewport and one mobile viewport were captured.
- Data states were based on current local seed and runtime, not production traffic.
