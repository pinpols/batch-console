# Frontend Design Audit

Date: 2026-06-08

Scope:
- `01-ops-summary.png`: control dashboard
- `02-tenant-package.png`: tenant package import wizard
- `03-job-definitions.png`: dense list and query page
- `04-workflow-designer.png`: workflow DAG designer

Findings:

1. Overall shell is already directionally right for an operations console.
   The fixed sidebar/header/main-card layout is stable, dense, and avoids marketing-style composition.

2. Dark mode needs fewer accidental bright surfaces.
   The workflow designer minimap rendered as a white block on a dark canvas, which pulled attention away from the editor. This was fixed in `DagCanvas.vue` by styling the minimap and its X6 internals with theme tokens.

3. Loading between heavy pages can briefly look blank.
   During route changes to job definitions / workflow designer, the viewport showed only the dark background and top progress line before content appeared. A compact skeleton or centered route-loading state would make this feel more deliberate.

4. The header is functional but visually busy.
   Current page title, tab chip, notification, command shortcut, tools, tenant switcher, role, and user controls compete in one line. Consider making the center tab chip quieter or hiding it when there is only one active tab.

5. Dense list pages are usable, but action columns dominate.
   On job definitions, every row shows several outlined action buttons. This improves discoverability but makes the table feel button-heavy. Consider keeping the primary row action visible and moving secondary actions into the existing "more" menu.

6. Tenant package import wizard has clear steps, but the upload step is spatially split.
   The download/export actions sit far left while the file picker sits right, leaving a large empty middle. Grouping related import actions closer to the upload area would make the first task path faster to scan.

Accessibility notes:
- No blocking contrast issue was obvious from screenshots, but dark-mode secondary text is close to the lower comfort bound in tables and helper copy.
- Screenshot-only audit cannot verify keyboard focus order, screen reader labels, or dynamic loading announcements.
