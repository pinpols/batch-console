// @vitest-environment jsdom
import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TenantPackageImportWizard from './TenantPackageImportWizard.vue'
import type { ImportWizardState } from '@/composables/useImportWizard'

const state = vi.hoisted(() => ({
  wizard: null as ImportWizardState | null,
  upload: vi.fn(),
  preview: vi.fn(),
  apply: vi.fn(),
  confirm: vi.fn(),
}))
vi.mock('@/composables/useImportWizard', async (original) => {
  const actual = await original<typeof import('@/composables/useImportWizard')>()
  return {
    ...actual,
    useImportWizard: () => {
      state.wizard = actual.useImportWizard()
      return state.wizard
    },
  }
})
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ hasPermission: () => true }) }))
vi.mock('@/composables/useDangerConfirm', () => ({ confirmDanger: state.confirm }))
vi.mock('@/api/tenantPackageExcel', () => ({
  tenantPackageUpload: state.upload,
  tenantPackagePreview: state.preview,
  tenantPackageApply: state.apply,
  tenantPackageGuide: vi.fn(),
  tenantPackageDownloadTemplate: vi.fn(),
  tenantPackageExport: vi.fn(),
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
  ElUpload: true,
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
    state.upload.mockReset().mockResolvedValue({ uploadToken: 'upload-a' })
    state.preview
      .mockReset()
      .mockResolvedValue({ previewToken: 'preview-a', stats: { total: 1, valid: 1, invalid: 0 } })
    state.apply.mockReset().mockResolvedValue({})
    state.confirm.mockReset().mockResolvedValue(undefined)
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
