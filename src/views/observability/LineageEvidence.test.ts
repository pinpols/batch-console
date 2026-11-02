// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, provide, reactive } from 'vue'
import { flushPromises, shallowMount } from '@vue/test-utils'
import LineageEvidence from './LineageEvidence.vue'
import CopyableText from '@/components/common/CopyableText.vue'

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
            '<form @submit.prevent="$emit(\'search\')"><slot /><button type="button" class="search" @click="$emit(\'search\')">Search</button><button type="button" class="reset" @click="$emit(\'reset\')">Reset</button></form>',
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
  it('证据动态表格可只读查看文件与作业长编码，其他字段保持原展示', async () => {
    const jobCode = 'JOB_' + 'A'.repeat(100)
    const fileCode = 'FILE_' + 'B'.repeat(100)
    const fileName = 'LONG_' + 'C'.repeat(200) + '.csv'
    const storagePath = '/sensitive/' + 'x'.repeat(200)
    mocks.load.mockResolvedValue({
      resultVersion: { id: 7 },
      coverage: {},
      pipelineInstances: [{ job_code: jobCode }],
      fileRecords: [{ file_code: fileCode, file_name: fileName, storage_path: storagePath }],
      dispatchRecords: [{ channel_code: null }],
    })
    const table = defineComponent({
      props: { data: { type: Array, required: true } },
      setup(props) {
        provide(
          'lineage-test-row',
          computed(() => props.data[0]),
        )
      },
      template: '<div><slot /></div>',
    })
    const column = {
      inject: { row: { from: 'lineage-test-row' } },
      template: '<div><slot :row="row" /></div>',
    }
    const wrapper = shallowMount(LineageEvidence, {
      global: {
        stubs: {
          PageContainer: slot,
          ElTabs: slot,
          ElTabPane: slot,
          ElFormItem: slot,
          ElAlert: slot,
          RouterLink: slot,
          GenericRowsTable: false,
          ElTable: table,
          ElTableColumn: column,
          ListPageQueryBar: {
            template: '<div><slot /><button class="search" @click="$emit(\'search\')" /></div>',
          },
          ElInput: {
            props: ['modelValue'],
            template:
              '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
          },
        },
      },
    })
    try {
      await wrapper.get('input').setValue('invoice-1')
      await wrapper.get('.search').trigger('click')
      await flushPromises()
      const previews = wrapper.findAllComponents(CopyableText)
      for (const value of [jobCode, fileCode, fileName]) {
        const preview = previews.find((component) => component.props('text') === value)
        expect(preview, value).toBeDefined()
        expect(preview?.props('copyable')).toBe(false)
      }
      expect(previews.some((component) => component.props('text') === storagePath)).toBe(false)
      expect(previews.some((component) => component.props('text') === '—')).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })
  it('按 Enter 只发起一次血缘查询', async () => {
    mocks.load.mockResolvedValue({ resultVersion: { id: 7 }, coverage: {} })
    const wrapper = renderPage()
    const input = wrapper.find('input')
    await input.setValue('invoice-1')
    // 浏览器按下 Enter 先提交表单，再派发 keyup。
    await wrapper.find('form').trigger('submit')
    await input.trigger('keyup.enter')
    expect(mocks.load).toHaveBeenCalledTimes(1)
  })
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
  it('本地化已知范围和缺口，保留未知后端值', async () => {
    mocks.load.mockResolvedValue({
      resultVersion: { id: 7 },
      coverage: {
        scope: 'BFS_HOT_AND_ARCHIVE',
        knownGaps: [
          'job_instance not found in hot or archive tables',
          'payload_ref file_record not found in hot or archive tables',
          'no related file_record found in hot or archive tables',
          'no dispatch receipt found in hot or archive tables',
          'unknown backend reason',
        ],
      },
    })
    const wrapper = renderPage()
    await wrapper.find('input').setValue('invoice-1')
    await wrapper.find('.search').trigger('click')
    await flushPromises()
    expect(wrapper.findComponent({ name: 'MetricCard' }).attributes('value')).toBe(
      'lineageEvidence.scopeHotAndArchive',
    )
    for (const key of [
      'gapJobMissing',
      'gapPayloadMissing',
      'gapFileMissing',
      'gapDispatchMissing',
    ]) {
      expect(wrapper.text()).toContain(`lineageEvidence.${key}`)
    }
    expect(wrapper.text()).toContain('unknown backend reason')
    wrapper.unmount()
  })
  it.each([
    ['BFS_HOT_TABLES', 'lineageEvidence.scopeHot'],
    ['FUTURE_SCOPE', 'FUTURE_SCOPE'],
  ])('展示证据范围 %s', async (scope, expected) => {
    mocks.load.mockResolvedValue({ resultVersion: { id: 7 }, coverage: { scope } })
    const wrapper = renderPage()
    await wrapper.find('input').setValue('invoice-1')
    await wrapper.find('.search').trigger('click')
    await flushPromises()
    expect(wrapper.findComponent({ name: 'MetricCard' }).attributes('value')).toBe(expected)
    wrapper.unmount()
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
