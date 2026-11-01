import type { LocationQuery } from 'vue-router'

interface SidebarGroup {
  key: string
  children: { path: string; hidden?: boolean }[]
}

// 隐藏入口关联到可见的任务入口；只在该入口确实有权限时高亮。
const hiddenParents: Record<string, string> = {
  '/files/channels': '/files/templates',
  '/files/arrival-groups': '/files/list',
  '/files/pipeline-obs': '/files/list',
  '/monitor/job-steps': '/monitor/job-instances',
  '/observability/lineage': '/observability/trace',
  '/workflow/designer': '/workflow/definitions',
  '/ops/batch-day-replay': '/scheduler/batch-days',
  '/observability/operation-audits': '/observability/audits',
}

export function resolveSidebarActiveMenu(
  path: string,
  query: LocationQuery,
  activeMenu: string | undefined,
  groups: SidebarGroup[],
): string | null {
  const visible = groups.flatMap((group) => group.children.filter((item) => !item.hidden))
  let best: string | null = null
  let score = -1
  for (const item of visible) {
    const [targetPath, queryString] = item.path.split('?', 2)
    if (path !== targetPath) continue
    const entries = [...new URLSearchParams(queryString).entries()]
    if (!entries.every(([key, value]) => String(query[key] ?? '') === value)) continue
    if (entries.length > score) {
      best = item.path
      score = entries.length
    }
  }
  if (best) return best
  const candidate = hiddenParents[path] ?? hiddenParents[activeMenu ?? ''] ?? activeMenu
  return visible.find((item) => item.path === candidate)?.path ?? null
}
