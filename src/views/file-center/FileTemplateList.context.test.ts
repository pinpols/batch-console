// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive, ref } from 'vue'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import FileTemplateList from './FileTemplateList.vue'

const mocks = vi.hoisted(() => ({
  context: null as unknown as { tenantId: string; username: string; writer: boolean; loggedIn: boolean; profileLoaded: boolean; session: number },
  createTemplate: vi.fn(), updateTemplate: vi.fn(), createChannel: vi.fn(), updateChannel: vi.fn(),
  toggleTemplate: vi.fn(), toggleChannel: vi.fn(),
  listTemplates: vi.fn(), listChannels: vi.fn(), success: vi.fn(),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => mocks.context }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({
  get userInfo() { return { username: mocks.context.username } },
  get isLoggedIn() { return mocks.context.loggedIn },
  get profileLoaded() { return mocks.context.profileLoaded },
}) }))
vi.mock('@/api/authSession', () => ({
  currentAuthSession: () => mocks.context.session,
  isSharedAuthRevisionCurrent: () => true,
}))
vi.mock('@/composables/usePermission', () => ({ usePermission: () => ({ canMutateConfig: computed(() => mocks.context.writer) }) }))
vi.mock('@/api/system', () => ({
  createFileTemplate: mocks.createTemplate, updateFileTemplate: mocks.updateTemplate,
  createFileChannel: mocks.createChannel, updateFileChannel: mocks.updateChannel,
  listFileTemplates: mocks.listTemplates, listFileChannels: mocks.listChannels,
  queryFileTemplateDetail: vi.fn(), toggleFileChannel: mocks.toggleChannel, toggleFileTemplate: mocks.toggleTemplate,
}))
vi.mock('@/api/meta', () => ({ getMetaBizTypes: vi.fn().mockResolvedValue([]) }))
vi.mock('@/composables/queries/useConsoleMeta', () => ({ useConsoleMetaEnumsQuery: () => ({ data: ref({}) }) }))
vi.mock('vue-router', () => ({ useRoute: () => ({ meta: {} }) }))
vi.mock('vue-i18n', async (original) => ({ ...(await original<typeof import('vue-i18n')>()), useI18n: () => ({ t: (key: string) => key, te: () => false }) }))
vi.mock('element-plus', async (original) => ({ ...(await original<typeof import('element-plus')>()), ElMessage: { success: mocks.success, warning: vi.fn() } }))

enableAutoUnmount(afterEach)
beforeEach(() => {
  mocks.context = reactive({ tenantId: 'tenant-a', username: 'alice', writer: true, loggedIn: true, profileLoaded: true, session: 1 })
  mocks.createTemplate.mockReset().mockResolvedValue({})
  mocks.updateTemplate.mockReset().mockResolvedValue({})
  mocks.createChannel.mockReset().mockResolvedValue({})
  mocks.updateChannel.mockReset().mockResolvedValue({})
  mocks.toggleTemplate.mockReset().mockResolvedValue({})
  mocks.toggleChannel.mockReset().mockResolvedValue({})
  mocks.listTemplates.mockReset().mockResolvedValue([])
  mocks.listChannels.mockReset().mockResolvedValue([])
  mocks.success.mockReset()
})

function setup() {
  return shallowMount(FileTemplateList, { global: { stubs: {
    PageContainer: { template: '<div><slot /></div>' },
    PageHeader: { template: '<div><slot name="actions" /></div>' },
    ElTabs: { template: '<div><slot /></div>' },
    ElTabPane: { template: '<div><slot /></div>' },
    ProTable: { props: ['data'], template: '<div data-list>{{ JSON.stringify(data) }}</div>' },
    ElDrawer: { props: ['modelValue'], template: '<section v-if="modelValue"><slot /><slot name="footer" /></section>' },
    ElForm: { template: '<div><slot /></div>' },
    ElFormItem: { props: ['label'], template: '<label><span>{{ label }}</span><slot /></label>' },
    ElInput: { props: ['modelValue'], emits: ['update:modelValue'], template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
    CodeNameBuilder: { props: ['modelValue'], emits: ['update:modelValue'], template: '<input data-code :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
    MetaSelect: { props: ['modelValue', 'options'], emits: ['update:modelValue'], template: '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option>IMPORT</option><option>EXPORT</option></select>' },
    ElButton: { props: ['disabled'], emits: ['click'], template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>' },
    MappingDraftAssistant: { props: ['canApply'], emits: ['apply'], template: '<button data-apply :disabled="!canApply" @click="$emit(\'apply\', { direction: \'EXPORT\', fieldMappingsJson: \'[]\', queryParamSchemaJson: \'{}\', defaultQuerySql: \'select id from orders\' })">apply</button>' },
  } } })
}
function state(wrapper: ReturnType<typeof setup>) {
  return (wrapper.vm.$ as unknown as { setupState: {
    openTemplateCreate: () => void
    openTemplateEdit: (row: Record<string, unknown>) => void
    openChannelCreate: () => void
    toggleTemplate: (row: Record<string, unknown>) => Promise<void>
    toggleChannel: (row: Record<string, unknown>) => Promise<void>
    togglingTemplateId: number | null
    togglingChannelId: number | null
  } }).setupState
}
function byLabel(wrapper: ReturnType<typeof setup>, label: string) {
  return wrapper.findAll('label').find((element) => element.text().includes(label))!
}
async function clickSave(wrapper: ReturnType<typeof setup>) {
  await wrapper.findAll('button').find((button) => button.text() === 'common.save')!.trigger('click')
}

describe('file configuration editor context', () => {
  it.each(['template', 'channel'] as const)('ignores a late %s toggle after switching tenants without clearing the new operation', async (kind) => {
    let finishOld!: (value: object) => void
    let finishNew!: (value: object) => void
    const toggle = kind === 'template' ? mocks.toggleTemplate : mocks.toggleChannel
    toggle.mockReturnValueOnce(new Promise((resolve) => { finishOld = resolve }))
      .mockReturnValueOnce(new Promise((resolve) => { finishNew = resolve }))
    const wrapper = setup()
    await flushPromises()
    const oldRow = { id: 1, tenantId: 'tenant-a', enabled: true }
    const newRow = { id: 2, tenantId: 'tenant-b', enabled: true }
    const invoke = kind === 'template' ? state(wrapper).toggleTemplate : state(wrapper).toggleChannel
    const busy = () => kind === 'template' ? state(wrapper).togglingTemplateId : state(wrapper).togglingChannelId
    const oldRequest = invoke(oldRow)
    expect(toggle).toHaveBeenNthCalledWith(1, 1, 'tenant-a', false)
    mocks.context.tenantId = 'tenant-b'
    const newRequest = invoke(newRow)
    expect(toggle).toHaveBeenNthCalledWith(2, 2, 'tenant-b', false)
    finishOld({})
    await oldRequest
    expect(oldRow.enabled).toBe(true)
    expect(mocks.success).not.toHaveBeenCalled()
    expect(busy()).toBe(2)
    finishNew({})
    await newRequest
    expect(newRow.enabled).toBe(false)
    expect(mocks.success).toHaveBeenCalledTimes(1)
    expect(busy()).toBeNull()
  })

  it.each(['template', 'channel'] as const)('refuses a stale %s row from another tenant', async (kind) => {
    const wrapper = setup()
    await flushPromises()
    const invoke = kind === 'template' ? state(wrapper).toggleTemplate : state(wrapper).toggleChannel
    await invoke({ id: 3, tenantId: 'tenant-b', enabled: true })
    expect(kind === 'template' ? mocks.toggleTemplate : mocks.toggleChannel).not.toHaveBeenCalled()
  })

  it.each(['template', 'channel'] as const)('applies independent %s toggle results in the same context', async (kind) => {
    let finishFirst!: (value: object) => void
    let finishSecond!: (value: object) => void
    const toggle = kind === 'template' ? mocks.toggleTemplate : mocks.toggleChannel
    toggle.mockReturnValueOnce(new Promise((resolve) => { finishFirst = resolve }))
      .mockReturnValueOnce(new Promise((resolve) => { finishSecond = resolve }))
    const wrapper = setup()
    await flushPromises()
    const first = { id: 1, tenantId: 'tenant-a', enabled: true }
    const second = { id: 2, tenantId: 'tenant-a', enabled: true }
    const invoke = kind === 'template' ? state(wrapper).toggleTemplate : state(wrapper).toggleChannel
    const firstRequest = invoke(first)
    const secondRequest = invoke(second)
    finishFirst({})
    await firstRequest
    expect(first.enabled).toBe(false)
    expect(kind === 'template' ? state(wrapper).togglingTemplateId : state(wrapper).togglingChannelId).toBe(2)
    finishSecond({})
    await secondRequest
    expect(second.enabled).toBe(false)
    expect(mocks.success).toHaveBeenCalledTimes(2)
  })
  it('applies reviewed export SQL to an empty template and submits it in the template payload', async () => {
    const wrapper = setup()
    await flushPromises()
    state(wrapper).openTemplateCreate()
    await wrapper.vm.$nextTick()
    await wrapper.get('[data-code]').setValue('EXP-ORDER')
    await byLabel(wrapper, 'fileTemplateList.fieldTemplateType').get('select').setValue('EXPORT')
    await wrapper.get('[data-apply]').trigger('click')
    expect((byLabel(wrapper, 'fileTemplateList.fieldDefaultQuerySql').get('input').element as HTMLInputElement).value).toBe('select id from orders')
    await clickSave(wrapper)
    expect(mocks.createTemplate).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-a', defaultQuerySql: 'select id from orders' }))
  })

  it('does not overwrite typed SQL and preserves existing export SQL when editing', async () => {
    const wrapper = setup()
    await flushPromises()
    state(wrapper).openTemplateCreate()
    await wrapper.vm.$nextTick()
    await byLabel(wrapper, 'fileTemplateList.fieldTemplateType').get('select').setValue('EXPORT')
    await byLabel(wrapper, 'fileTemplateList.fieldDefaultQuerySql').get('input').setValue('select id from existing')
    expect(wrapper.get('[data-apply]').attributes('disabled')).toBeDefined()
    state(wrapper).openTemplateEdit({ id: 42, tenantId: 'tenant-a', templateCode: 'EXP-ORDER', templateType: 'EXPORT', fileFormatType: 'DELIMITED', defaultQuerySql: 'select id from existing' })
    await wrapper.vm.$nextTick()
    expect((byLabel(wrapper, 'fileTemplateList.fieldDefaultQuerySql').get('input').element as HTMLInputElement).value).toBe('select id from existing')
    await clickSave(wrapper)
    expect(mocks.updateTemplate).toHaveBeenCalledWith(42, expect.objectContaining({ tenantId: 'tenant-a', defaultQuerySql: 'select id from existing' }))
  })

  it('leaves absent SQL unchanged on edit, but permits explicitly clearing existing SQL', async () => {
    const wrapper = setup()
    await flushPromises()
    state(wrapper).openTemplateEdit({ id: 1, tenantId: 'tenant-a', templateCode: 'EXP-EMPTY', templateType: 'EXPORT', fileFormatType: 'DELIMITED', defaultQuerySql: null })
    await wrapper.vm.$nextTick()
    await clickSave(wrapper)
    expect(mocks.updateTemplate).toHaveBeenCalledWith(1, expect.objectContaining({ defaultQuerySql: undefined }))
    state(wrapper).openTemplateEdit({ id: 2, tenantId: 'tenant-a', templateCode: 'EXP-EXISTING', templateType: 'EXPORT', fileFormatType: 'DELIMITED', defaultQuerySql: 'select id from existing' })
    await wrapper.vm.$nextTick()
    await byLabel(wrapper, 'fileTemplateList.fieldDefaultQuerySql').get('input').setValue('')
    await clickSave(wrapper)
    expect(mocks.updateTemplate).toHaveBeenCalledWith(2, expect.objectContaining({ defaultQuerySql: '' }))
  })

  it.each(['tenantId', 'username', 'writer'] as const)('invalidates a template or channel draft when %s changes', async (changed) => {
    const wrapper = setup()
    await flushPromises()
    state(wrapper).openTemplateCreate()
    await wrapper.vm.$nextTick()
    await wrapper.get('[data-code]').setValue('IMP-ORDER')
    if (changed === 'writer') mocks.context.writer = false
    else mocks.context[changed] = changed === 'tenantId' ? 'tenant-b' : 'bob'
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-code]').exists()).toBe(false)
    expect(mocks.createTemplate).not.toHaveBeenCalled()
    mocks.context.tenantId = 'tenant-a'
    mocks.context.username = 'alice'
    mocks.context.writer = true
    state(wrapper).openChannelCreate()
    await wrapper.vm.$nextTick()
    expect(byLabel(wrapper, 'fileTemplateList.fieldChannelCode')).toBeDefined()
    if (changed === 'writer') mocks.context.writer = false
    else mocks.context[changed] = changed === 'tenantId' ? 'tenant-b' : 'bob'
    await wrapper.vm.$nextTick()
    expect(wrapper.find('section').exists()).toBe(false)
    expect(mocks.createChannel).not.toHaveBeenCalled()
  })

  it('does not let a late channel save close or report success in a new tenant', async () => {
    let resolve!: (value: object) => void
    mocks.createChannel.mockReturnValue(new Promise((done) => { resolve = done }))
    const wrapper = setup()
    await flushPromises()
    state(wrapper).openChannelCreate()
    await wrapper.vm.$nextTick()
    await byLabel(wrapper, 'fileTemplateList.fieldChannelCode').get('input').setValue('SFTP-ONE')
    await clickSave(wrapper)
    expect(mocks.createChannel).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-a' }))
    mocks.context.tenantId = 'tenant-b'
    await wrapper.vm.$nextTick()
    state(wrapper).openChannelCreate()
    await wrapper.vm.$nextTick()
    resolve({})
    await flushPromises()
    expect(wrapper.find('section').exists()).toBe(true)
    expect(mocks.success).not.toHaveBeenCalled()
  })

  it('does not submit an old draft after the authentication session changes even for the same user', async () => {
    const wrapper = setup()
    await flushPromises()
    state(wrapper).openTemplateCreate()
    await wrapper.vm.$nextTick()
    await wrapper.get('[data-code]').setValue('IMP-ORDER')
    mocks.context.session++
    await clickSave(wrapper)
    expect(mocks.createTemplate).not.toHaveBeenCalled()
  })

  it('closes drafts and prevents reopening until the current tenant profile is confirmed', async () => {
    const wrapper = setup()
    await flushPromises()
    state(wrapper).openTemplateCreate()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-code]').exists()).toBe(true)
    mocks.context.profileLoaded = false
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-code]').exists()).toBe(false)
    state(wrapper).openTemplateCreate()
    state(wrapper).openChannelCreate()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('section').exists()).toBe(false)
    expect(mocks.createTemplate).not.toHaveBeenCalled()
    expect(mocks.createChannel).not.toHaveBeenCalled()
    mocks.context.profileLoaded = true
    state(wrapper).openTemplateCreate()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-code]').exists()).toBe(true)
  })

  it('discards the previous account list when its response arrives after an account switch', async () => {
    let resolveOld!: (value: object[]) => void
    mocks.listTemplates.mockReturnValueOnce(new Promise((done) => { resolveOld = done }))
      .mockResolvedValueOnce([{ id: 2, tenantId: 'tenant-a', templateCode: 'NEW-ACCOUNT' }])
    const wrapper = setup()
    mocks.context.username = 'bob'
    await flushPromises()
    expect(wrapper.get('[data-list]').text()).toContain('NEW-ACCOUNT')
    resolveOld([{ id: 1, tenantId: 'tenant-a', templateCode: 'OLD-ACCOUNT' }])
    await flushPromises()
    expect(wrapper.get('[data-list]').text()).toContain('NEW-ACCOUNT')
    expect(wrapper.get('[data-list]').text()).not.toContain('OLD-ACCOUNT')
  })
})
