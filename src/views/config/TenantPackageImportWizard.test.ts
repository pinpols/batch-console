// @vitest-environment jsdom
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TenantPackageImportWizard from './TenantPackageImportWizard.vue'
import type { ImportWizardState } from '@/composables/useImportWizard'

const state = vi.hoisted(() => ({
  wizard: null as ImportWizardState | null,
  upload: vi.fn(),
  preview: vi.fn(),
  apply: vi.fn(),
  confirm: vi.fn(),
  exportPackage: vi.fn(),
  download: vi.fn(),
  tenant: null as unknown as { tenantId: string },
  useRealTenant: false,
}))
vi.mock('@/composables/useImportWizard', async (original) => {
  const actual = await original<typeof import('@/composables/useImportWizard')>()
  return {
    ...actual,
    useImportWizard: () => {
      state.wizard = actual.useImportWizard()
      state.wizard.triggerBlobDownload = state.download
      return state.wizard
    },
  }
})
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ hasPermission: () => true }) }))
vi.mock('@/stores/tenant', async (original) => {
  const actual = await original<typeof import('@/stores/tenant')>()
  return {
    useTenantStore: () =>
      state.useRealTenant
        ? actual.useTenantStore()
        : Object.assign(state.tenant, { registerTenantChangeGuard: () => () => {} }),
  }
})
vi.mock('@/composables/useDangerConfirm', () => ({ confirmDanger: state.confirm }))
vi.mock('@/api/tenantPackageExcel', () => ({
  tenantPackageUpload: state.upload,
  tenantPackagePreview: state.preview,
  tenantPackageApply: state.apply,
  tenantPackageGuide: vi.fn(),
  tenantPackageDownloadTemplate: vi.fn(),
  tenantPackageExport: state.exportPackage,
  tenantPackageDownloadPreviewWorkbook: vi.fn(),
  tenantPackagePatchRow: vi.fn(),
  refreshTenantPackagePreviewOnConflict: vi.fn(),
}))
const container = { template: '<div><slot /></div>' }
const stubs = {
  PageContainer: container,
  SectionCard: container,
  PageHeader: true,
  TenantPackageScenarioSelector: true,
  ElSteps: true,
  ElTable: true,
  ElDrawer: true,
  ElUpload: { template: '<div />', methods: { clearFiles() {} } },
  ElAlert: true,
  ElTooltip: container,
  ElButton: {
    props: ['loading', 'disabled'],
    emits: ['click'],
    template: '<button :disabled="loading || disabled" @click="$emit(\'click\')"><slot /></button>',
  },
  ElIcon: true,
  ElTag: true,
  ElDescriptions: true,
  ElDescriptionsItem: true,
}
function uploadButton(wrapper: ReturnType<typeof mount>) {
  return wrapper
    .findAll('button')
    .find((button) => button.text() === 'excelMaintenanceWizard.btnStartUpload')!
}
function createFile(name: string) {
  return new File(['workbook'], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

describe('tenant package workbook identity', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    state.useRealTenant = false
    state.tenant = reactive({ tenantId: 'tenant-a' })
    state.upload.mockReset().mockResolvedValue({ uploadToken: 'upload-a' })
    state.preview
      .mockReset()
      .mockResolvedValue({ previewToken: 'preview-a', stats: { total: 1, valid: 1, invalid: 0 } })
    state.apply.mockReset().mockResolvedValue({})
    state.confirm.mockReset().mockResolvedValue(undefined)
    state.exportPackage.mockReset()
    state.download.mockReset()
  })

  it('切租户后旧导出不下载，也不解除新租户导出的加载状态', async () => {
    state.useRealTenant = true
    const { useTenantStore } =
      await vi.importActual<typeof import('@/stores/tenant')>('@/stores/tenant')
    const tenant = useTenantStore()
    tenant.setTenantId('tenant-a')
    let resolveA!: (value: Blob) => void
    let resolveB!: (value: Blob) => void
    state.exportPackage
      .mockReturnValueOnce(
        new Promise<Blob>((resolve) => {
          resolveA = resolve
        }),
      )
      .mockReturnValueOnce(
        new Promise<Blob>((resolve) => {
          resolveB = resolve
        }),
      )
    const wrapper = mount(TenantPackageImportWizard, {
      global: { stubs, directives: { loading: () => {} } },
    })
    const button = () =>
      wrapper
        .findAll('button')
        .find((item) => item.text() === 'tenantPackageImportWizard.btnExportCurrent')!
    await button().trigger('click')
    expect(await tenant.requestTenantSwitch('tenant-b', async () => true)).toBe(true)
    await flushPromises()
    await button().trigger('click')
    expect(state.exportPackage).toHaveBeenCalledTimes(2)
    resolveA(new Blob(['old']))
    await flushPromises()
    expect(state.download).not.toHaveBeenCalled()
    expect(state.wizard!.exportLoading.value).toBe(true)
    const current = new Blob(['new'])
    resolveB(current)
    await flushPromises()
    expect(state.download).toHaveBeenCalledOnce()
    expect(state.download).toHaveBeenCalledWith(current, 'tenant-package-export.xlsx')
    expect(state.wizard!.exportLoading.value).toBe(false)
    wrapper.unmount()
  })

  it('取消切换保留上传与预览；确认后清除旧租户工作簿', async () => {
    state.useRealTenant = true
    const { useTenantStore } =
      await vi.importActual<typeof import('@/stores/tenant')>('@/stores/tenant')
    const tenant = useTenantStore()
    tenant.setTenantId('tenant-a')
    const wrapper = mount(TenantPackageImportWizard, {
      global: { stubs, directives: { loading: () => {} } },
    })
    state.wizard!.setRawFile(createFile('a.xlsx'))
    await flushPromises()
    await uploadButton(wrapper).trigger('click')
    await flushPromises()
    const confirm = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    expect(await tenant.requestTenantSwitch('tenant-b', confirm)).toBe(false)
    expect(state.wizard!.file.value?.name).toBe('a.xlsx')
    expect(state.wizard!.uploadToken.value).toBe('upload-a')
    expect(state.wizard!.previewRaw.value?.previewToken).toBe('preview-a')
    expect(await tenant.requestTenantSwitch('tenant-b', confirm)).toBe(true)
    expect(state.wizard!.file.value).toBeNull()
    expect(state.wizard!.uploadToken.value).toBe('')
    expect(state.wizard!.previewRaw.value).toBeNull()
    wrapper.unmount()
  })

  it('空向导和已成功应用的工作簿切租户不提示', async () => {
    state.useRealTenant = true
    const { useTenantStore } =
      await vi.importActual<typeof import('@/stores/tenant')>('@/stores/tenant')
    const tenant = useTenantStore()
    tenant.setTenantId('tenant-a')
    const wrapper = mount(TenantPackageImportWizard, {
      global: { stubs, directives: { loading: () => {} } },
    })
    const confirm = vi.fn(async () => false)
    expect(await tenant.requestTenantSwitch('tenant-b', confirm)).toBe(true)
    expect(confirm).not.toHaveBeenCalled()
    state.wizard!.setRawFile(createFile('a.xlsx'))
    await flushPromises()
    await uploadButton(wrapper).trigger('click')
    await flushPromises()
    state.wizard!.step.value = 2
    await flushPromises()
    const apply = wrapper
      .findAll('button')
      .find((button) => button.text() === 'excelMaintenanceWizard.btnApply')!
    await apply.trigger('click')
    await flushPromises()
    expect(state.apply).toHaveBeenCalledOnce()
    expect(await tenant.requestTenantSwitch('tenant-c', confirm)).toBe(true)
    expect(confirm).not.toHaveBeenCalled()
    state.wizard!.setRawFile(createFile('b.xlsx'))
    await flushPromises()
    await uploadButton(wrapper).trigger('click')
    await flushPromises()
    state.wizard!.step.value = 2
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'excelMaintenanceWizard.btnApply')!
      .trigger('click')
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'tenantPackageImportWizard.btnResetWizard')!
      .trigger('click')
    await flushPromises()
    expect(await tenant.requestTenantSwitch('tenant-d', confirm)).toBe(true)
    expect(confirm).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('取消保留预览行的编辑，确认后删除旧行草稿', async () => {
    state.useRealTenant = true
    const { useTenantStore } =
      await vi.importActual<typeof import('@/stores/tenant')>('@/stores/tenant')
    const tenant = useTenantStore()
    tenant.setTenantId('tenant-a')
    state.preview.mockResolvedValueOnce({
      previewToken: 'preview-a',
      errorRows: [
        { sheetName: 'jobs', rowNo: 2, values: { jobCode: 'old' }, messages: ['invalid'] },
      ],
    })
    const wrapper = mount(TenantPackageImportWizard, {
      global: { stubs, directives: { loading: () => {} } },
    })
    state.wizard!.setRawFile(createFile('a.xlsx'))
    await flushPromises()
    await uploadButton(wrapper).trigger('click')
    await flushPromises()
    const setup = (
      wrapper.vm.$ as unknown as {
        setupState: {
          draftFor: (row: unknown) => Record<string, string>
          rowDrafts: Record<string, Record<string, string>>
        }
      }
    ).setupState
    const draft = setup.draftFor(state.wizard!.errorRows.value[0])
    draft.jobCode = 'edited'
    const confirm = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    expect(await tenant.requestTenantSwitch('tenant-b', confirm)).toBe(false)
    expect(draft.jobCode).toBe('edited')
    expect(await tenant.requestTenantSwitch('tenant-b', confirm)).toBe(true)
    expect(Object.keys(setup.rowDrafts)).toHaveLength(0)
    wrapper.unmount()
  })

  it('discards an upload response after the tenant changes', async () => {
    let resolveUpload!: (value: { uploadToken: string }) => void
    state.upload.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveUpload = resolve
      }),
    )
    const wrapper = mount(TenantPackageImportWizard, {
      global: { stubs, directives: { loading: () => {} } },
    })
    state.wizard!.setRawFile(createFile('a.xlsx'))
    await flushPromises()
    await uploadButton(wrapper).trigger('click')
    state.tenant.tenantId = 'tenant-b'
    resolveUpload({ uploadToken: 'upload-a' })
    await flushPromises()
    expect(state.wizard!.file.value).toBeNull()
    expect(state.wizard!.uploadToken.value).toBe('')
    expect(state.wizard!.previewRaw.value).toBeNull()
    expect(state.preview).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('cancels an apply confirmation across a tenant switch and return', async () => {
    let resolveConfirmation!: () => void
    state.confirm.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveConfirmation = resolve
      }),
    )
    const wrapper = mount(TenantPackageImportWizard, {
      global: { stubs, directives: { loading: () => {} } },
    })
    state.wizard!.setRawFile(createFile('a.xlsx'))
    await flushPromises()
    await uploadButton(wrapper).trigger('click')
    await flushPromises()
    await wrapper.get('.wizard-nav--next').trigger('click')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'excelMaintenanceWizard.btnApply')!
      .trigger('click')
    state.tenant.tenantId = 'tenant-b'
    state.tenant.tenantId = 'tenant-a'
    resolveConfirmation()
    await flushPromises()
    expect(state.apply).not.toHaveBeenCalled()
    expect(state.wizard!.file.value).toBeNull()
    expect(state.wizard!.uploadToken.value).toBe('')
    expect(state.wizard!.previewRaw.value).toBeNull()
    wrapper.unmount()
  })

  it('discards a preview response after the tenant changes', async () => {
    let resolvePreview!: (value: { previewToken: string }) => void
    state.preview.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePreview = resolve
      }),
    )
    const wrapper = mount(TenantPackageImportWizard, {
      global: { stubs, directives: { loading: () => {} } },
    })
    state.wizard!.setRawFile(createFile('a.xlsx'))
    await flushPromises()
    await uploadButton(wrapper).trigger('click')
    expect(state.preview).toHaveBeenCalledWith('upload-a')
    state.tenant.tenantId = 'tenant-b'
    resolvePreview({ previewToken: 'preview-a' })
    await flushPromises()
    expect(state.wizard!.file.value).toBeNull()
    expect(state.wizard!.uploadToken.value).toBe('')
    expect(state.wizard!.previewRaw.value).toBeNull()
    expect(state.wizard!.step.value).toBe(0)
    wrapper.unmount()
  })

  it('does not revive an old upload after the selected workbook changes', async () => {
    let resolveUpload!: (value: { uploadToken: string }) => void
    state.upload.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveUpload = resolve
      }),
    )
    const wrapper = mount(TenantPackageImportWizard, {
      global: { stubs, directives: { loading: () => {} } },
    })
    state.wizard!.setRawFile(createFile('a.xlsx'))
    await flushPromises()
    await uploadButton(wrapper).trigger('click')
    state.wizard!.setRawFile(createFile('b.xlsx'))
    resolveUpload({ uploadToken: 'upload-a' })
    await flushPromises()
    expect(state.wizard!.uploadToken.value).toBe('')
    expect(state.wizard!.step.value).toBe(0)
    expect(state.preview).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('invalidates a completed preview when another workbook is selected', async () => {
    const wrapper = mount(TenantPackageImportWizard, {
      global: { stubs, directives: { loading: () => {} } },
    })
    state.wizard!.setRawFile(createFile('a.xlsx'))
    await flushPromises()
    await uploadButton(wrapper).trigger('click')
    await flushPromises()
    expect(state.wizard!.previewRaw.value?.previewToken).toBe('preview-a')
    state.wizard!.setRawFile(createFile('b.xlsx'))
    await flushPromises()
    expect(state.wizard!.uploadToken.value).toBe('')
    expect(state.wizard!.previewRaw.value).toBeNull()
    expect(state.wizard!.step.value).toBe(0)
    wrapper.unmount()
  })
  it('cancels an apply confirmation when the selected workbook changes', async () => {
    let resolveConfirmation!: () => void
    state.confirm.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveConfirmation = resolve
      }),
    )
    const wrapper = mount(TenantPackageImportWizard, {
      global: { stubs, directives: { loading: () => {} } },
    })
    state.wizard!.setRawFile(createFile('a.xlsx'))
    await flushPromises()
    await uploadButton(wrapper).trigger('click')
    await flushPromises()
    await wrapper.get('.wizard-nav--next').trigger('click')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'excelMaintenanceWizard.btnApply')!
      .trigger('click')
    state.wizard!.setRawFile(createFile('b.xlsx'))
    resolveConfirmation()
    await flushPromises()
    expect(state.apply).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('discards an unfinished upload when the wizard unmounts', async () => {
    let resolveUpload!: (value: { uploadToken: string }) => void
    state.upload.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveUpload = resolve
      }),
    )
    const wrapper = mount(TenantPackageImportWizard, {
      global: { stubs, directives: { loading: () => {} } },
    })
    state.wizard!.setRawFile(createFile('a.xlsx'))
    await flushPromises()
    await uploadButton(wrapper).trigger('click')
    wrapper.unmount()
    resolveUpload({ uploadToken: 'upload-a' })
    await flushPromises()
    expect(state.preview).not.toHaveBeenCalled()
    expect(state.wizard!.uploadToken.value).toBe('')
  })
})
