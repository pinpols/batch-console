// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LayoutSidebar from './LayoutSidebar.vue'
import { navigationGroups, type NavigationGroup } from '@/constants/navigation'

const state = vi.hoisted(() => ({
  collapsed: false,
  visibleGroups: [] as NavigationGroup[],
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({
    path: '/scheduler/snapshot',
    query: {},
    meta: { activeMenu: '/scheduler/snapshot' },
  }),
  useRouter: () => ({ resolve: () => ({ matched: [] }) }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key, te: () => true }),
}))
vi.mock('@/composables/useResponsive', () => ({
  useResponsive: () => ({ isCompact: ref(false) }),
}))
vi.mock('@/stores/app', () => ({
  useAppStore: () => ({
    get sidebarCollapsed() {
      return state.collapsed
    },
    setSidebarCollapsed: (v: boolean) => {
      state.collapsed = v
    },
    toggleSidebar: () => {
      state.collapsed = !state.collapsed
    },
    maintenance: { active: false, readOnly: false },
    isDegraded: false,
  }),
}))
vi.mock('@/stores/permission', () => ({
  usePermissionStore: () => ({
    get visibleGroups() {
      return state.visibleGroups
    },
  }),
}))

function mountSidebar() {
  return mount(LayoutSidebar, {
    global: {
      stubs: {
        ElAside: { template: '<aside><slot /></aside>' },
        ElIcon: { template: '<span><slot /></span>' },
        ElTooltip: { template: '<span><slot /></span>' },
        BatchMark: true,
        RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
      },
    },
  })
}

describe('LayoutSidebar 调度资源分组小标题', () => {
  beforeEach(() => {
    state.collapsed = false
    state.visibleGroups = navigationGroups
  })

  it('展开态在调度资源组内展示调度运行与资源规则两个小标题', () => {
    const wrapper = mountSidebar()
    const subTitles = wrapper.findAll('.nav__subgroup-title').map((el) => el.text())
    expect(subTitles).toEqual(['nav.subGroup.schedulingRuntime', 'nav.subGroup.schedulingRules'])
  })

  it('租户管理员视图下不包含批次窗口、资源队列和租户配额', () => {
    const scheduling = navigationGroups.find((g) => g.key === 'scheduling')!
    const tenantAdminScheduling = {
      ...scheduling,
      children: scheduling.children.filter(
        (item) =>
          item.minRole !== 'ADMIN' &&
          (!item.authorities || item.authorities.includes('ROLE_TENANT_ADMIN')),
      ),
    }
    state.visibleGroups = [tenantAdminScheduling]
    const wrapper = mountSidebar()
    const hrefs = wrapper.findAll('a').map((a) => a.attributes('href'))
    expect(hrefs).toContain('/governance/calendars')
    expect(hrefs).not.toContain('/governance/windows')
    expect(hrefs).not.toContain('/governance/queues')
    expect(hrefs).not.toContain('/governance/quota')
  })
})
