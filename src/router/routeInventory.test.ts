// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import type { RouteRecordRaw } from 'vue-router'
import { navigationGroups } from '@/constants/navigation'
import { routes } from './index'

function joinPath(parent: string, child: string): string {
  if (child.startsWith('/')) return child
  return `${parent.replace(/\/$/, '')}/${child}`.replace(/\/+/g, '/')
}

function flatten(
  records: readonly RouteRecordRaw[],
  parent = '',
): Array<{ path: string; route: RouteRecordRaw }> {
  return records.flatMap((route) => {
    const path = joinPath(parent, route.path)
    return [{ path, route }, ...flatten(route.children ?? [], path)]
  })
}

describe('route inventory', () => {
  it('作业包向导权限与后端管理员入口一致', () => {
    const wizard = flatten(routes).find((item) => item.path === '/jobs/definitions/new')?.route
    expect(wizard?.meta?.permissions).toEqual(['ROLE_ADMIN'])
  })

  const inventory = flatten(routes)
  const routePaths = new Set(
    inventory.flatMap((item) => [item.path, item.path.replace(/\/:\w+\?$/, '')]),
  )

  it('暴露有权限的资源治理入口并保留各自权限', () => {
    const items = navigationGroups.flatMap((group) => group.children)
    for (const path of ['/governance/queues', '/governance/windows', '/governance/calendars']) {
      expect(items.find((item) => item.path === path)?.hidden).not.toBe(true)
    }
    expect(items.find((item) => item.path === '/governance/queues')?.minRole).toBe('ADMIN')
    expect(items.find((item) => item.path === '/governance/windows')?.minRole).toBe('ADMIN')
    expect(items.find((item) => item.path === '/governance/calendars')?.authorities).toEqual([
      'ROLE_ADMIN',
      'ROLE_TENANT_ADMIN',
    ])
  })

  it('旧路径重定向保留查询参数并落到目标页签', () => {
    const cases: Array<{ from: string; toPath: string; tab: string }> = [
      { from: '/config/sync', toPath: '/config/management', tab: 'sync' },
      { from: '/observability/audits', toPath: '/observability/audit', tab: 'file' },
      { from: '/observability/operation-audits', toPath: '/observability/audit', tab: 'operation' },
      {
        from: '/ops/asset-freshness',
        toPath: '/observability/job-monitoring-policies',
        tab: 'freshness',
      },
      { from: '/system/event-catalog', toPath: '/system/notifications', tab: 'eventCatalog' },
      { from: '/ops/capacity-profile', toPath: '/observability/usage', tab: 'capacity' },
      { from: '/ops/worker-fingerprints', toPath: '/workers/management', tab: 'fingerprints' },
      { from: '/ops/custom-task-types', toPath: '/workers/management', tab: 'customTaskTypes' },
      { from: '/ops/tenant-placements', toPath: '/ops/shard-catalog', tab: 'placements' },
      { from: '/system/users', toPath: '/system/me', tab: 'permissions' },
    ]

    for (const item of cases) {
      const redirect = inventory.find((entry) => entry.path === item.from)?.route.redirect
      expect(typeof redirect, `${item.from} redirect`).toBe('function')
      expect(
        (redirect as (to: unknown) => unknown)({ query: { tenantId: 'tenant-a', tab: 'old' } }),
      ).toEqual({
        path: item.toPath,
        query: { tenantId: 'tenant-a', tab: item.tab },
      })
    }

    const runsRedirect = inventory.find((entry) => entry.path === '/runs')?.route.redirect
    expect(typeof runsRedirect, '/runs redirect').toBe('function')
    expect((runsRedirect as (to: unknown) => unknown)({ query: { status: 'FAILED' } })).toEqual({
      path: '/monitor/job-instances',
      query: { status: 'FAILED' },
    })
  })

  it('新合并的中心页路由均指向可加载组件', async () => {
    const centerPaths = [
      '/observability/job-monitoring-policies',
      '/observability/audit',
      '/observability/usage',
      '/system/settings',
      '/ops/shard-catalog',
    ]
    for (const path of centerPaths) {
      const route = inventory.find((entry) => entry.path === path)?.route
      expect(typeof route?.component, `${path} lazy loader`).toBe('function')
      const loaded = await (route!.component as () => Promise<unknown>)()
      expect(loaded).toBeTruthy()
    }
  })

  it('keeps every backend-menu path backed by a frontend route', () => {
    const navigationItems = navigationGroups.flatMap((group) => group.children)
    const navigationPaths = navigationItems.map((item) => item.path)

    expect(navigationPaths).toHaveLength(48)
    expect(navigationItems.filter((item) => !item.hidden)).toHaveLength(32)
    expect(navigationItems.filter((item) => item.hidden)).toHaveLength(16)
    expect(navigationPaths).not.toContain('/runs')
    expect(navigationPaths.filter((path) => !routePaths.has(path))).toEqual([])
    expect(navigationPaths).not.toContain('/jobs/pipelines')
    expect(inventory.find((item) => item.path === '/jobs/pipelines')).toBeUndefined()
  })

  it('keeps secondary and detail routes titled and attached to their parent menu', () => {
    const secondaryPaths = [
      '/jobs/definitions/:id',
      '/monitor/job-instances/:id',
      '/monitor/job-instances/:id/partitions',
      '/monitor/workflow-runs/:id',
      '/workflow/viewer/:id',
      '/workflow/designer/:id?',
      '/files/pipeline-obs',
      '/governance/windows',
      '/governance/calendars',
    ]

    for (const path of secondaryPaths) {
      const target = inventory.find((item) => item.path === path)?.route
      expect(target, `${path} must exist`).toBeDefined()
      expect(target?.meta?.title, `${path} must have a title`).toBeTruthy()
      expect(target?.meta?.activeMenu, `${path} must define activeMenu`).toBeTruthy()
    }
  })

  it('keeps shared-component pages highlighted by their real route', () => {
    const expected: Record<string, { activeMenu: string; fallback: string[] }> = {
      '/files/channels': {
        activeMenu: '/files/channels',
        fallback: ['/files/templates'],
      },
      '/governance/windows': {
        activeMenu: '/governance/windows',
        fallback: ['/governance/queues'],
      },
      '/governance/calendars': {
        activeMenu: '/governance/calendars',
        fallback: ['/governance/queues'],
      },
      '/system/maintenance': {
        activeMenu: '/system/maintenance',
        fallback: ['/system/parameters'],
      },
    }

    for (const [path, config] of Object.entries(expected)) {
      const target = inventory.find((item) => item.path === path)?.route
      expect(target?.meta?.activeMenu).toBe(config.activeMenu)
      expect(target?.meta?.menuAccessFallbacks).toEqual(config.fallback)
    }
  })
})
