// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { ElMessage } from 'element-plus'
import AtomicTaskTypeCenter from './AtomicTaskTypeCenter.vue'

const mocks = vi.hoisted(() => ({
  listSchemas: vi.fn(),
  listConfigs: vi.fn(),
  createConfig: vi.fn(),
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
  JsonPreview: true,
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
  })

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
})
