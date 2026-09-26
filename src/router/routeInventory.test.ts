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
  const inventory = flatten(routes)
  const routePaths = new Set(
    inventory.flatMap((item) => [item.path, item.path.replace(/\/:\w+\?$/, '')]),
  )

  it('keeps every backend-menu path backed by a frontend route', () => {
    const navigationItems = navigationGroups.flatMap((group) => group.children)
    const navigationPaths = navigationItems.map((item) => item.path)

    expect(navigationPaths).toHaveLength(54)
    expect(navigationItems.filter((item) => !item.hidden)).toHaveLength(25)
    expect(navigationItems.filter((item) => item.hidden)).toHaveLength(29)
    expect(navigationPaths.filter((path) => !routePaths.has(path))).toEqual([])
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
})
