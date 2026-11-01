// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import MobileTabBar from './MobileTabBar.vue'

const mocks = vi.hoisted(() => ({
  permission: { visibleGroups: [] as Array<{ children: Array<{ path: string }> }> },
}))
vi.mock('@/stores/permission', () => ({ usePermissionStore: () => mocks.permission }))
vi.mock('@/stores/mobileBadges', () => ({ useMobileBadgesStore: () => ({ approvalsBadge: 0, alertsBadge: 0, jobsBadge: 0, criticalAlerts: 0, openAlerts: 0 }) }))
vi.mock('vue-router', () => ({ useRoute: () => ({ path: '/m/ops/summary' }) }))
vi.mock('vue-i18n', async (original) => ({ ...(await original<typeof import('vue-i18n')>()), useI18n: () => ({ t: (key: string) => key }) }))

describe('mobile navigation permissions', () => {
  it('shows only tabs with a permitted desktop business entry and hides all while the profile is unconfirmed', async () => {
    mocks.permission = reactive({ visibleGroups: [{ children: [{ path: '/ops/summary' }, { path: '/monitor/job-instances' }] }] })
    const wrapper = mount(MobileTabBar, { global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' }, ElIcon: { template: '<span><slot /></span>' } } } })
    expect(wrapper.findAll('a').map((link) => link.attributes('href'))).toEqual(['/m/ops/summary', '/m/jobs'])
    expect(wrapper.find('nav').attributes('style')).toContain('repeat(2, 1fr)')
    mocks.permission.visibleGroups = []
    await wrapper.vm.$nextTick()
    expect(wrapper.find('nav').exists()).toBe(false)
  })
})
