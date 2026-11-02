// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/locales'
import TenantFormDialog from './TenantFormDialog.vue'
import NotificationRulesTab from './NotificationRulesTab.vue'
import NotificationChannelsTab from './NotificationChannelsTab.vue'
import UserAccountList from '../UserAccountList.vue'

const accountRows = vi.hoisted(() => ({ items: [] as Array<Record<string, unknown>> }))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => ({ tenantId: 'sample' }) }))
vi.mock('@/composables/useTenantChangeGuard', () => ({ useTenantChangeGuard: () => {} }))
vi.mock('@/composables/queries/useConsoleMeta', async () => {
  const { ref } = await import('vue')
  return { useConsoleMetaEnumsQuery: () => ({ data: ref([]) }) }
})
vi.mock('@/composables/useWriteAvailability', async () => {
  const { ref } = await import('vue')
  return {
    useWriteAvailability: () => ({ writesFrozen: ref(false), ensureWriteAvailable: () => true }),
  }
})
vi.mock('@/api/notifications', () => ({
  listNotificationChannels: vi.fn(async () => []),
  listNotificationRules: vi.fn(async () => []),
  createNotificationChannel: vi.fn(),
  updateNotificationChannel: vi.fn(),
  deleteNotificationChannel: vi.fn(),
  testNotificationChannel: vi.fn(),
  createNotificationRule: vi.fn(),
  updateNotificationRule: vi.fn(),
  deleteNotificationRule: vi.fn(),
}))
vi.mock('@/api/tenants', () => ({ createTenant: vi.fn(), updateTenant: vi.fn() }))
vi.mock('@/api/userAccounts', () => ({
  listUsers: vi.fn(async () => ({
    total: accountRows.items.length,
    pageNo: 1,
    pageSize: 15,
    items: accountRows.items,
  })),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  enableUser: vi.fn(),
  disableUser: vi.fn(),
  resetUserPassword: vi.fn(),
}))

const wrappers: Array<{ unmount: () => void }> = []
const scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'scrollIntoView',
)
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  })
})
afterAll(() => {
  if (scrollIntoViewDescriptor) {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scrollIntoViewDescriptor)
  } else {
    delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView
  }
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  accountRows.items = []
  document.body.replaceChildren()
})

async function checkOpenAndValidation(open: () => Promise<void>) {
  await open()
  await vi.waitFor(() => {
    const drawer = document.querySelector<HTMLElement>('.el-drawer')
    expect(drawer).not.toBeNull()
    expect(document.activeElement?.tagName).toBe('INPUT')
    expect(drawer?.querySelector('.el-form-item__error')).toBeNull()
  })
  const drawer = document.querySelector<HTMLElement>('.el-drawer')!
  const buttons = drawer.querySelectorAll<HTMLButtonElement>('.el-drawer__footer button')
  buttons[buttons.length - 1]!.click()
  await flushPromises()
  await vi.waitFor(() => expect(drawer.querySelector('.el-form-item__error')).not.toBeNull())
}

describe('表单打开与必填校验', () => {
  it('新建租户打开时不提前报错，空提交仍校验', async () => {
    const wrapper = mount(TenantFormDialog, {
      attachTo: document.body,
      props: { modelValue: false, initial: null },
      global: {
        plugins: [
          createPinia(),
          createRouter({ history: createMemoryHistory(), routes: [] }),
          i18n,
          ElementPlus,
        ],
        stubs: { transition: false },
      },
    })
    wrappers.push(wrapper)
    await checkOpenAndValidation(async () => {
      await wrapper.setProps({ modelValue: true })
    })
  })

  it('新建通知规则打开时不提前报错，空提交仍校验', async () => {
    const wrapper = mount(NotificationRulesTab, {
      attachTo: document.body,
      global: {
        plugins: [
          createPinia(),
          createRouter({ history: createMemoryHistory(), routes: [] }),
          i18n,
          ElementPlus,
        ],
        stubs: { transition: false },
      },
    })
    wrappers.push(wrapper)
    await checkOpenAndValidation(async () => {
      await (wrapper.vm as unknown as { openRuleCreate: () => Promise<void> }).openRuleCreate()
    })
  })

  it('新建通知渠道打开时不提前报错，空提交仍校验', async () => {
    const wrapper = mount(NotificationChannelsTab, {
      attachTo: document.body,
      global: {
        plugins: [
          createPinia(),
          createRouter({ history: createMemoryHistory(), routes: [] }),
          i18n,
          ElementPlus,
        ],
        stubs: { transition: false },
      },
    })
    wrappers.push(wrapper)
    await checkOpenAndValidation(async () => {
      ;(wrapper.vm as unknown as { openChannelCreate: () => void }).openChannelCreate()
    })
  })

  it('新建账户打开时不提前报错，空提交仍校验', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div />' } }],
    })
    await router.push('/')
    await router.isReady()
    const wrapper = mount(UserAccountList, {
      attachTo: document.body,
      global: {
        plugins: [createPinia(), router, i18n, ElementPlus],
        stubs: {
          transition: false,
          UserBatchProvisioningDialog: true,
          OidcIdentityBindingsDrawer: true,
          TenantSelect: { template: '<input disabled />' },
        },
      },
    })
    wrappers.push(wrapper)
    await checkOpenAndValidation(async () => {
      const addButton = wrapper
        .findAll('button')
        .find((button) => button.text().includes(i18n.global.t('userAccountList.headerCreate')))
      expect(addButton, wrapper.text()).toBeDefined()
      await addButton!.trigger('click')
    })
  })

  it('账户状态区分启用、停用及未知值', async () => {
    accountRows.items = [
      {
        id: 1,
        tenantId: 'sample',
        username: 'enabled',
        enabled: true,
        authoritiesCsv: 'ROLE_TENANT_USER,ROLE_CUSTOM',
      },
      { id: 2, tenantId: 'sample', username: 'disabled', enabled: false },
      { id: 3, tenantId: 'sample', username: 'unknown', enabled: null },
    ]
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div />' } }],
    })
    await router.push('/')
    await router.isReady()
    const wrapper = mount(UserAccountList, {
      attachTo: document.body,
      global: {
        plugins: [createPinia(), router, i18n, ElementPlus],
        stubs: {
          transition: false,
          UserBatchProvisioningDialog: true,
          OidcIdentityBindingsDrawer: true,
        },
      },
    })
    wrappers.push(wrapper)
    await flushPromises()
    const rows = wrapper.findAll('.el-table__body tbody tr')
    expect(rows).toHaveLength(3)
    expect(rows[0]!.text()).toContain(i18n.global.t('userAccountList.metricEnabled'))
    expect(rows[0]!.text()).toContain(
      `ROLE_TENANT_USER (${i18n.global.t('roleOptions.tenantUser')})`,
    )
    expect(rows[0]!.text()).toContain('ROLE_CUSTOM')
    expect(rows[1]!.text()).toContain(i18n.global.t('userAccountList.metricDisabled'))
    expect(rows[2]!.find('.cell-empty').text()).toBe('—')
  })
})
