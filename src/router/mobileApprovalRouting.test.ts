// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import { resolveMobileTarget } from './index'

const route = (path: string, query: Record<string, string> = {}) =>
  ({ path, query }) as unknown as RouteLocationNormalized

describe('移动审批深链', () => {
  it('桌面补跑审批页签落到手机审批中心的补跑分段', () => {
    expect(resolveMobileTarget(route('/approvals', { tab: 'catch-up' }))).toBe(
      '/m/approvals?tab=catch-up',
    )
  })

  it('旧补跑审批地址与桌面同一落点', () => {
    expect(resolveMobileTarget(route('/scheduler/catch-up-approvals'))).toBe(
      '/m/approvals?tab=catch-up',
    )
  })

  it('普通审批仍落到手机审批中心默认分段', () => {
    expect(resolveMobileTarget(route('/approvals'))).toBe('/m/approvals')
    expect(resolveMobileTarget(route('/approvals', { tab: 'general' }))).toBe('/m/approvals')
  })
})
