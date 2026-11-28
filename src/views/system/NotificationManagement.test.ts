// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import NotificationManagement from './NotificationManagement.vue'

const state = vi.hoisted(() => ({
  query: {} as Record<string, string>,
  replace: vi.fn(),
  openWebhook: vi.fn(),
  canManageNotifications: true,
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ hasPermission: () => state.canManageNotifications }),
}))
vi.mock('@/stores/permission', () => ({
  usePermissionStore: () => ({ canAccessRole: () => state.canManageNotifications }),
}))
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: state.query }),
  useRouter: () => ({ replace: state.replace, push: vi.fn() }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))

const slot = { template: '<div><slot name="actions" /><slot /></div>' }
const webhooksTab = {
  setup(_: unknown, { expose }: { expose: (exposed: Record<string, unknown>) => void }) {
    expose({ openWebhookCreate: state.openWebhook })
  },
  template: '<div class="webhooks-tab" />',
}

function mountPage() {
  return mount(NotificationManagement, {
    global: {
      stubs: {
        PageContainer: slot,
        PageHeader: slot,
        ElAlert: true,
        ElTabs: slot,
        ElTabPane: slot,
        ElButton: {
          emits: ['click'],
          template: '<button class="create" @click="$emit(\'click\')"><slot /></button>',
        },
        NotificationChannelsTab: true,
        NotificationRulesTab: true,
        NotificationWebhooksTab: webhooksTab,
        NotificationDeliveryLogsTab: true,
        NotificationTerminalDeliveriesTab: true,
        NotificationRoutePreview: true,
        EventCatalog: { template: '<div class="event-catalog-tab" />' },
      },
    },
  })
}

afterEach(() => {
  state.query = {}
  state.canManageNotifications = true
  vi.clearAllMocks()
})

describe('通知与投递页签与新增入口', () => {
  it('按 URL 中的 tab 打开对应页签，新增按钮作用于该页签', async () => {
    state.query = { tab: 'webhooks' }
    const wrapper = mountPage()
    await flushPromises()
    const create = wrapper.findAll('button').find((b) => b.text().includes('dialogTitleCreate'))!
    expect(create.text()).toBe('notificationWebhooksTab.dialogTitleCreate')
    await create.trigger('click')
    expect(state.openWebhook).toHaveBeenCalledOnce()
  })

  it('未知 tab 回落到通知渠道', async () => {
    state.query = { tab: 'unknown' }
    const wrapper = mountPage()
    await flushPromises()
    const create = wrapper.findAll('button').find((b) => b.text().includes('dialogTitleCreate'))!
    expect(create.text()).toBe('notificationChannelsTab.dialogTitleCreate')
  })

  it('只读角色仅能看到事件目录页签，不显示通知配置页签和新增按钮', async () => {
    state.canManageNotifications = false
    state.query = { tab: 'webhooks' }
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.find('.event-catalog-tab').exists()).toBe(true)
    expect(wrapper.find('.webhooks-tab').exists()).toBe(false)
    expect(
      wrapper.findAll('button').filter((b) => b.text().includes('dialogTitleCreate')),
    ).toHaveLength(0)
  })
})
