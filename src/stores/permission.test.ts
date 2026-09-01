import { describe, expect, it } from 'vitest'
import { filterNavigationByBackendMenus } from './permission'
import { navigationGroups } from '@/constants/navigation'
import type { MenuGroup } from '@/types'

describe('permission navigation filtering', () => {
  it('keeps local menu copy when backend menus only define visibility', () => {
    const backendMenus: MenuGroup[] = [
      {
        key: 'workspace',
        title: 'Workspace',
        icon: 'Box',
        minRole: 'VIEWER',
        children: [
          {
            title: 'Dashboard',
            path: '/ops/summary',
            icon: 'Box',
            minRole: 'VIEWER',
          },
        ],
      },
    ]

    const result = filterNavigationByBackendMenus(navigationGroups, backendMenus)

    expect(result).toHaveLength(1)
    expect(result[0].key).toBe('workspace')
    expect(result[0].title).toBe('工作台')
    expect(result[0].children).toHaveLength(1)
    expect(result[0].children[0].title).toBe('控制面板')
  })

  it('drops backend-visible paths that are not in local navigation', () => {
    const backendMenus: MenuGroup[] = [
      {
        key: 'workspace',
        title: '工作台',
        icon: 'Histogram',
        minRole: 'VIEWER',
        children: [
          {
            title: 'Unknown',
            path: '/unknown',
            icon: 'Box',
            minRole: 'VIEWER',
          },
        ],
      },
    ]

    expect(filterNavigationByBackendMenus(navigationGroups, backendMenus)).toEqual([])
  })

  it('allows local IA regrouping while preserving backend path visibility', () => {
    const backendMenus: MenuGroup[] = [
      {
        key: 'system',
        title: 'System',
        icon: 'Setting',
        minRole: 'OPERATOR',
        children: [
          {
            title: 'Notifications',
            path: '/system/notifications',
            icon: 'Bell',
            minRole: 'OPERATOR',
          },
        ],
      },
    ]

    const result = filterNavigationByBackendMenus(navigationGroups, backendMenus)

    expect(result).toHaveLength(1)
    // IA v3(7 组):后端仍可把 path 放在 system,前端按设计归入"告警与投递"组
    expect(result[0].key).toBe('alerting')
    expect(result[0].title).toBe('告警与投递')
    expect(result[0].children.map((c) => c.path)).toEqual(['/system/notifications'])
    expect(result[0].children[0].title).toBe('通知与投递')
  })

  it('keeps compatibility paths while consolidating sidebar ownership', () => {
    const groupFor = (key: string) => navigationGroups.find((group) => group.key === key)
    const definitions = groupFor('definitions')
    const scheduling = groupFor('scheduling')
    const system = groupFor('system')

    expect(definitions?.children.map((item) => item.path)).toEqual([
      '/jobs/definitions',
      '/jobs/pipelines',
      '/workflow/definitions',
      '/workflow/designer',
    ])
    expect(scheduling?.children.map((item) => item.path)).toContain('/ops/capacity-profile')
    expect(scheduling?.children.map((item) => item.path)).toContain('/ops/asset-freshness')
    expect(system?.children.map((item) => item.path)).toContain('/config/tenant-package')

    const runs = groupFor('monitor')?.children.find((item) => item.path === '/runs')
    expect(runs?.hidden).toBe(true)

    const visiblePaths = navigationGroups.flatMap((group) =>
      group.children.filter((item) => !item.hidden).map((item) => item.path),
    )
    expect(new Set(visiblePaths).size).toBe(visiblePaths.length)
  })
})
