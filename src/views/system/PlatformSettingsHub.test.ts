// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlatformSettingsHub from './PlatformSettingsHub.vue'

const state = vi.hoisted(() => ({
  push: vi.fn(),
  allowedPaths: new Set<string>(),
}))

vi.mock('vue-router', () => ({ useRouter: () => ({ push: state.push }) }))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('@/composables/useRouteAccess', () => ({
  useRouteAccess: () => ({ canOpenPath: (path: string) => state.allowedPaths.has(path) }),
}))

const slot = { template: '<div><slot /></div>' }

function mountHub() {
  return mount(PlatformSettingsHub, {
    global: {
      stubs: {
        PageContainer: slot,
        PageHeader: true,
        SectionCard: slot,
        EmptyState: {
          props: ['description'],
          template: '<div class="empty">{{ description }}</div>',
        },
        ElIcon: slot,
      },
    },
  })
}

describe('PlatformSettingsHub 四角色卡片可见性', () => {
  beforeEach(() => {
    state.push.mockReset()
    state.allowedPaths = new Set()
  })

  it('平台管理员可见全部 5 张设置卡片并可点击跳转', async () => {
    state.allowedPaths = new Set([
      '/system/parameters',
      '/system/tags',
      '/system/atomic-task-types',
      '/system/maintenance',
      '/ops/shard-catalog',
    ])
    const wrapper = mountHub()
    const cards = wrapper.findAll('.settings-hub-card')
    expect(cards).toHaveLength(5)

    await cards[0]!.trigger('click')
    expect(state.push).toHaveBeenCalledWith('/system/parameters')
  })

  it('租户管理员仅可见标签管理与原子节点配置卡片', () => {
    state.allowedPaths = new Set(['/system/tags', '/system/atomic-task-types'])
    const wrapper = mountHub()
    const titles = wrapper.findAll('.settings-hub-card__title').map((node) => node.text())
    expect(titles).toEqual(['page.systemTags.title', 'page.systemAtomicTaskTypes.title'])
  })

  it('审计员与租户用户无权项时展示空态', () => {
    const wrapper = mountHub()
    expect(wrapper.findAll('.settings-hub-card')).toHaveLength(0)
    expect(wrapper.find('.empty').text()).toBe('platformSettingsHub.emptyDescription')
  })
})
