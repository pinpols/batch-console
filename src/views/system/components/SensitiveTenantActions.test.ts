// @vitest-environment jsdom
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ConfigSecretsTab from './ConfigSecretsTab.vue'
import SelfServiceRerunTab from './SelfServiceRerunTab.vue'
import SelfServiceCompensationTab from './SelfServiceCompensationTab.vue'

const state = vi.hoisted(() => ({
  tenant: null as unknown as { tenantId: string },
  confirm: vi.fn(),
  prompt: vi.fn(),
  validate: vi.fn(),
  rotate: vi.fn(),
  revoke: vi.fn(),
  rerun: vi.fn(),
  compensate: vi.fn(),
  row: {
    id: 1,
    tenantId: 'tenant-a',
    secretRef: 'shared-secret',
    versionNo: 1,
    secretStatus: 'ACTIVE',
  },
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => state.tenant }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ hasPermission: () => true }) }))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('element-plus', async (original) => ({
  ...(await original<typeof import('element-plus')>()),
  ElMessage: { success: vi.fn() },
  ElMessageBox: { prompt: state.prompt },
}))
vi.mock('@/composables/useDangerConfirm', () => ({ confirmDanger: state.confirm }))
vi.mock('@/api/configReleases', () => ({
  listSecrets: async () => [state.row],
  getSecretVersion: vi.fn(),
  rotateSecret: state.rotate,
  revokeSecretVersion: state.revoke,
}))
vi.mock('@/api/selfServiceJobs', () => ({
  selfServiceRerunRequest: state.rerun,
  selfServiceCompensationRequest: state.compensate,
}))
vi.mock('@/composables/useFormValidate', async () => {
  const { ref } = await import('vue')
  return {
    useFormValidate: () => ({ formRef: ref(null), validate: state.validate }),
    rules: { required: () => ({}) },
  }
})
vi.mock('@/composables/useJobCodeSearch', async () => {
  const { ref } = await import('vue')
  return {
    useJobCodeSearch: () => ({
      jobCodeLoading: ref(false),
      jobCodeOptions: ref([]),
      loadDefaultJobCodes: vi.fn(),
      queryJobCodes: vi.fn(),
      clearOptions: vi.fn(),
    }),
  }
})
vi.mock('@/composables/useInstanceNoSearch', async () => {
  const { ref } = await import('vue')
  return {
    useInstanceNoSearch: () => ({
      instanceLoading: ref(false),
      instanceOptions: ref([]),
      loadInstances: vi.fn(),
      queryInstances: vi.fn(),
      clearOptions: vi.fn(),
    }),
  }
})

const stubs = {
  DataState: { template: '<div><slot /></div>' },
  ElTable: { template: '<div><slot /></div>' },
  ElTableColumn: { setup: () => ({ row: state.row }), template: '<div><slot :row="row" /></div>' },
  RowActions: {
    props: ['actions'],
    template:
      '<div><button v-for="action in actions" :key="action.key" @click="action.onClick()">{{ action.key }}</button></div>',
  },
  ElDrawer: true,
  ListPageQueryBar: true,
  TablePagerBar: true,
  CopyableText: true,
  DatetimeColumn: true,
  JsonPreview: true,
  ElTag: true,
  ElButton: true,
  ElSelect: true,
  ElOption: true,
  ElDatePicker: true,
  ElInput: true,
  ElForm: { setup: () => ({ clearValidate: vi.fn() }), template: '<form><slot /></form>' },
  ElFormItem: { template: '<label><slot /></label>' },
}

describe('sensitive actions retain their tenant target', () => {
  beforeEach(() => {
    state.tenant = reactive({ tenantId: 'tenant-a' })
    state.confirm.mockReset().mockResolvedValue(undefined)
    state.prompt.mockReset().mockResolvedValue({ value: '{}' })
    state.validate.mockReset().mockResolvedValue(true)
    for (const fn of [state.rotate, state.revoke, state.rerun, state.compensate])
      fn.mockReset().mockResolvedValue(undefined)
  })

  it.each([
    { action: 'rotate', api: state.rotate },
    { action: 'revoke', api: state.revoke },
  ])('does not $action an A secret after the prompt resolves in B', async ({ action, api }) => {
    let resolvePrompt!: (result: { value: string }) => void
    state.prompt.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePrompt = resolve
      }),
    )
    const wrapper = mount(ConfigSecretsTab, { global: { stubs } })
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === action)!
      .trigger('click')
    await flushPromises()
    state.tenant.tenantId = 'tenant-b'
    await nextTick()
    resolvePrompt({ value: '{}' })
    await flushPromises()
    expect(api).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it.each([
    { name: 'rerun', component: SelfServiceRerunTab, api: state.rerun },
    { name: 'compensation', component: SelfServiceCompensationTab, api: state.compensate },
  ])(
    'does not submit an A $name request in B after delayed validation',
    async ({ component, api }) => {
      let resolveValidation!: (value: boolean) => void
      state.validate.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveValidation = resolve
        }),
      )
      const wrapper = mount(component, {
        global: { stubs, directives: { 'track-click': () => {} } },
      })
      await flushPromises()
      await wrapper.get('form').trigger('submit')
      state.tenant.tenantId = 'tenant-b'
      await nextTick()
      resolveValidation(true)
      await flushPromises()
      expect(api).not.toHaveBeenCalled()
      wrapper.unmount()
    },
  )
})
