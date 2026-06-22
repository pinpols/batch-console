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
    // IA v4(7→5 组):/system/notifications 归入"运行监控"组(原"告警与投递"已并入)
    expect(result[0].key).toBe('runtime')
    expect(result[0].title).toBe('运行监控')
    expect(result[0].children.map((c) => c.path)).toEqual(['/system/notifications'])
    expect(result[0].children[0].title).toBe('通知与投递')
  })
})
