// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { ElMessage } from 'element-plus'
import AtomicTaskTypeCenter from './AtomicTaskTypeCenter.vue'

const mocks = vi.hoisted(() => ({
  listSchemas: vi.fn(),
  listConfigs: vi.fn(),
  createConfig: vi.fn(),
  writeText: vi.fn(),
  tenant: { tenantId: 'tenant-a' },
}))

vi.mock('@/api/atomicTaskTypes', () => ({ listAtomicTaskTypeSchemas: mocks.listSchemas }))
vi.mock('@/api/atomicTaskConfigs', () => ({
  atomicTaskConfigsApi: { list: mocks.listConfigs, create: mocks.createConfig },
}))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ hasPermission: () => true }) }))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => mocks.tenant }))
vi.mock('@/composables/useTenantReload', () => ({ useTenantReload: () => {} }))
vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key, te: () => false }),
}))
vi.mock('element-plus', async (importOriginal) => ({
  ...(await importOriginal<typeof import('element-plus')>()),
  ElMessage: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}))

enableAutoUnmount(afterEach)

const slotStub = { template: '<div><slot /></div>' }
const stubs = {
  PageContainer: slotStub,
  PageHeader: slotStub,
  SectionCard: slotStub,
  HelpLabel: slotStub,
  AtomicRuntimePanel: true,
  SensitiveFieldAlert: true,
  JsonPreview: {
    props: ['data'],
    template: '<pre data-test="preview">{{ JSON.stringify(data) }}</pre>',
  },
  EmptyState: true,
  ElAlert: true,
  ElSkeleton: true,
  ElTable: true,
  ElSelect: true,
  ElTabs: slotStub,
  ElTabPane: slotStub,
  ElForm: slotStub,
  ElFormItem: { props: ['label'], template: '<label :data-label="label"><slot /></label>' },
  ElButton: {
    props: ['disabled'],
    template:
      '<button type="button" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
  ElInput: {
    props: ['modelValue'],
    template:
      '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  ElInputNumber: {
    props: ['modelValue'],
    template:
      '<input :value="modelValue" @input="$emit(\'update:modelValue\', Number($event.target.value))" />',
  },
}

describe('AtomicTaskTypeCenter timeout validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('navigator', { clipboard: { writeText: mocks.writeText } })
    mocks.listSchemas.mockResolvedValue([
      {
        taskType: 'sql',
        displayName: 'SQL',
        enabledByDefault: true,
        parameters: [
          { name: 'sql', type: 'string', required: true, description: '' },
          { name: 'statementTimeoutSeconds', type: 'number', required: false, description: '' },
        ],
        securityGates: [],
      },
    ])
    mocks.listConfigs.mockResolvedValue([])
    mocks.createConfig.mockResolvedValue({})
    mocks.writeText.mockResolvedValue(undefined)
  })

  afterEach(() => vi.unstubAllGlobals())

  it('blocks invalid timeout before save and submits a valid integer', async () => {
    const wrapper = mount(AtomicTaskTypeCenter, { global: { stubs } })
    await flushPromises()
    await wrapper.get('[data-label="sql"] input').setValue('select 1')
    await wrapper.get('[data-label="statementTimeoutSeconds"] input').setValue('1.5')
    await wrapper.get('[data-label="atomicTaskTypeCenter.savedConfigName"] input').setValue('cfg')
    const save = wrapper
      .findAll('button')
      .find((button) => button.text().includes('atomicTaskTypeCenter.savedConfigSave'))
    expect(save).toBeDefined()
    await save!.trigger('click')
    expect(mocks.createConfig).not.toHaveBeenCalled()
    expect(ElMessage.error).toHaveBeenCalledWith(
      'atomicTaskTypeCenter.savedConfigInvalidParameterTypes',
    )

    await wrapper.get('[data-label="statementTimeoutSeconds"] input').setValue('1')
    await save!.trigger('click')
    await flushPromises()
    expect(mocks.createConfig).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      taskType: 'sql',
      name: 'cfg',
      parameters: { sql: 'select 1', statementTimeoutSeconds: 1 },
    })
  })

  it.each([
    ['stored_proc', 'inParams', 'list', '[1,"x"]', [1, 'x']],
    ['http', 'headers', 'map', '{"Accept":"application/json"}', { Accept: 'application/json' }],
  ])('%s 的 %s 预览和复制使用解析后的类型', async (taskType, field, type, input, expected) => {
    mocks.listSchemas.mockResolvedValueOnce([
      {
        taskType,
        displayName: taskType,
        enabledByDefault: true,
        parameters: [{ name: field, type, required: false, description: '' }],
        securityGates: [],
      },
    ])
    const wrapper = mount(AtomicTaskTypeCenter, { global: { stubs } })
    await flushPromises()
    await wrapper.get(`[data-label="${field}"] input`).setValue(input)
    const preview = JSON.parse(wrapper.get('[data-test="preview"]').text())
    expect(preview[field]).toEqual(expected)
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('atomicTaskTypeCenter.btnCopyJson'))!
      .trigger('click')
    expect(JSON.parse(mocks.writeText.mock.calls[0][0])[field]).toEqual(expected)
  })

  it('列表参数无法解析时不提供可复制的参数预览', async () => {
    mocks.listSchemas.mockResolvedValueOnce([
      {
        taskType: 'stored_proc',
        displayName: 'stored_proc',
        enabledByDefault: true,
        parameters: [{ name: 'inParams', type: 'list', required: false, description: '' }],
        securityGates: [],
      },
    ])
    const wrapper = mount(AtomicTaskTypeCenter, { global: { stubs } })
    await flushPromises()
    await wrapper.get('[data-label="inParams"] input').setValue('[invalid')
    const copy = wrapper
      .findAll('button')
      .find((button) => button.text().includes('atomicTaskTypeCenter.btnCopyJson'))!
    expect(copy.attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-test="preview"]').exists()).toBe(false)
  })
})
