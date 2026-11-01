// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { flushPromises, shallowMount } from '@vue/test-utils'
import LineageEvidence from './LineageEvidence.vue'

const mocks = vi.hoisted(() => ({ load: vi.fn(), tenant: null as unknown as { tenantId: string } }))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => mocks.tenant }))
vi.mock('@/composables/useTenantReload', () => ({ useTenantReload: vi.fn() }))
vi.mock('@/api/lineage', () => ({
  getAssetPartitionReadiness: vi.fn(),
  getLineageEvidenceByBusinessKey: mocks.load,
  getLineageEvidenceByResultVersion: vi.fn(),
}))
vi.mock('element-plus', async (original) => ({
  ...(await original<typeof import('element-plus')>()),
  ElMessage: { success: vi.fn(), warning: vi.fn() },
}))

const slot = { template: '<div><slot /></div>' }

function renderPage() {
  return shallowMount(LineageEvidence, {
    global: {
      stubs: {
        PageContainer: slot,
        ElTabs: slot,
        ElTabPane: slot,
        ElFormItem: slot,
        ElCollapse: slot,
        ElCollapseItem: slot,
        ElAlert: slot,
        ListPageQueryBar: {
          template:
            '<div><slot /><button class="search" @click="$emit(\'search\')">Search</button><button class="reset" @click="$emit(\'reset\')">Reset</button></div>',
        },
        ElInput: {
          props: ['modelValue'],
          template:
            '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        },
        JsonPreview: { props: ['data'], template: '<pre>{{ JSON.stringify(data) }}</pre>' },
      },
    },
  })
}

beforeEach(() => {
  mocks.tenant = reactive({ tenantId: 'tenant-a' })
  mocks.load.mockReset()
})

describe('LineageEvidence', () => {
  it('shows explicit IDs and missing links while retaining original evidence', async () => {
    mocks.load.mockResolvedValue({
      resultVersion: { id: 7, businessKey: 'invoice-1', jobInstanceId: 42 },
      jobInstance: null,
      pipelineInstances: [{ id: 12, file_id: null, related_job_instance_id: 42 }],
      fileRecords: [{ id: 88, file_name: 'a.csv' }],
      dispatchRecords: [{ id: 99, file_id: 88, pipeline_instance_id: null }],
      coverage: { scope: 'PARTIAL', knownGaps: ['missing-job'] },
    })
    const wrapper = renderPage()
    await wrapper.find('input').setValue('invoice-1')
    await wrapper.find('.search').trigger('click')
    await flushPromises()
    const text = wrapper.text()
    expect(mocks.load).toHaveBeenCalledWith('invoice-1', 'tenant-a')
    expect(text).toContain('lineageEvidence.recordUnavailable')
    expect(text).toContain('lineageEvidence.relatedFileId: —')
    expect(text).toContain('lineageEvidence.pipelineId: —')
    expect(text).toContain('a.csv')
    expect(text).toContain('missing-job')
    expect(text).toContain('"businessKey":"invoice-1"')
  })
  it.each(['tenant', 'reset'] as const)(
    'discards old evidence after %s changes',
    async (change) => {
      let resolve!: (value: unknown) => void
      mocks.load.mockReturnValue(
        new Promise((done) => {
          resolve = done
        }),
      )
      const wrapper = renderPage()
      await wrapper.find('input').setValue('invoice-1')
      await wrapper.find('.search').trigger('click')
      if (change === 'tenant') mocks.tenant.tenantId = 'tenant-b'
      else await wrapper.find('.reset').trigger('click')
      resolve({
        resultVersion: { id: 7, businessKey: 'old-tenant-result' },
        pipelineInstances: [],
        fileRecords: [],
        dispatchRecords: [],
        coverage: { scope: 'PARTIAL', knownGaps: [] },
      })
      await flushPromises()
      expect(wrapper.text()).not.toContain('old-tenant-result')
      wrapper.unmount()
    },
  )
})
