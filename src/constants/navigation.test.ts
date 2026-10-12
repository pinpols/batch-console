import { describe, expect, it } from 'vitest'
import { navigationGroups } from './navigation'
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
      '跟踪运行',
      '处理异常',
      '准备作业',
      '核对文件',
      '安排批次',
      '平台管理',
    ])
    expect(item('/jobs/definitions').path).toBe('/jobs/definitions')
    expect(item('/ops/batch-day-replay').path).toBe('/ops/batch-day-replay')
    expect(item('/files/list').path).toBe('/files/list')
    expect(item('/observability/audits').path).toBe('/observability/audits')
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
    expect(item('/system/users').authorities).toEqual([...authorityRoles])
  })

  it('作业监控策略只对平台管理员和租户管理员开放', () => {
    expect(item('/observability/job-monitoring-policies').authorities).toEqual([
      'ROLE_ADMIN',
      'ROLE_TENANT_ADMIN',
    ])
  })
})
