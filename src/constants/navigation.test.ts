import { describe, expect, it } from 'vitest'
import { navigationGroups, navigationItemTitleKey } from './navigation'
import { authorityRoles } from './role'

const navigationItems = navigationGroups.flatMap((group) => group.children)

function item(path: string) {
  const found = navigationItems.find((candidate) => candidate.path === path)
  expect(found, `navigation item ${path}`).toBeDefined()
  return found!
}

describe('navigation role authorities', () => {
  it('侧栏按核心用户任务命名且保留任务入口', () => {
    expect(navigationGroups.map((group) => group.title)).toEqual([
      '工作台',
      '作业编排',
      '文件管理',
      '调度资源',
      '运行监控',
      '告警投递',
      '平台管理',
    ])
    expect(item('/jobs/definitions').path).toBe('/jobs/definitions')
    expect(item('/ops/batch-day-replay').path).toBe('/ops/batch-day-replay')
    expect(item('/files/list').path).toBe('/files/list')
    expect(item('/observability/audit').hidden).not.toBe(true)
    expect(item('/system/settings').hidden).not.toBe(true)
    expect(item('/ops/diagnostic').hidden).not.toBe(true)
    expect(item('/governance/quota').hidden).not.toBe(true)
    expect(item('/system/maintenance').hidden).toBe(true)
    expect(navigationItems.find((candidate) => candidate.path === '/system/users')).toBeUndefined()
  })

  it('调度资源分组使用调度运行与资源规则两个小标题', () => {
    const scheduling = navigationGroups.find((group) => group.key === 'scheduling')!
    const visible = scheduling.children.filter((child) => !child.hidden)
    expect(
      visible.filter((child) => child.subGroup === 'schedulingRuntime').map((child) => child.path),
    ).toEqual([
      '/scheduler/snapshot',
      '/scheduler/batch-days',
      '/system/triggers',
      '/workers/management',
    ])
    expect(
      visible.filter((child) => child.subGroup === 'schedulingRules').map((child) => child.path),
    ).toEqual([
      '/governance/calendars',
      '/governance/windows',
      '/governance/queues',
      '/governance/quota',
    ])
  })

  it('长菜单使用简洁标题并保留原页面标题作为定位依据', () => {
    expect(item('/observability/job-monitoring-policies').titleKey).toBe('nav.menuJobMonitoring')
    expect(item('/system/notifications').titleKey).toBe('nav.menuNotificationDelivery')
    expect(item('/config/tenant-package').titleKey).toBe('nav.menuConfigurationImport')
  })

  it('导航分组 key 全部唯一', () => {
    const keys = navigationGroups.map((group) => group.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('带查询参数的菜单项优先使用显式标题 key', () => {
    expect(
      navigationItemTitleKey({
        title: 'Catch-up',
        path: '/approvals?tab=catch-up',
        titleKey: 'page.approvals.title',
      }),
    ).toBe('page.approvals.title')
  })

  it('所有精确白名单只引用四类正式角色', () => {
    const allowed = new Set<string>(authorityRoles)
    const configured = navigationItems.flatMap((candidate) => candidate.authorities ?? [])

    expect(configured.length).toBeGreaterThan(0)
    expect(configured.every((authority) => allowed.has(authority))).toBe(true)
  })

  it('高风险与自助入口使用明确角色边界', () => {
    expect(item('/approvals').authorities).toEqual(['ROLE_ADMIN', 'ROLE_TENANT_ADMIN'])
    expect(item('/self-service').authorities).toEqual([
      'ROLE_ADMIN',
      'ROLE_TENANT_ADMIN',
      'ROLE_TENANT_USER',
    ])
    expect(item('/system/api-keys').authorities).toEqual([
      'ROLE_ADMIN',
      'ROLE_TENANT_ADMIN',
      'ROLE_TENANT_USER',
    ])
    expect(item('/observability/audit').authorities).toEqual([
      'ROLE_ADMIN',
      'ROLE_TENANT_ADMIN',
      'ROLE_AUDITOR',
    ])
  })

  it('告警策略宿主路由对 OPERATOR 开放，由页签按原权限各自控制', () => {
    expect(item('/observability/job-monitoring-policies').minRole).toBe('OPERATOR')
  })
})
