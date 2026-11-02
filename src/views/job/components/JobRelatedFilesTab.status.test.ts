// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { computed, defineComponent, h, inject, provide, ref, type Ref } from 'vue'
import { createI18n } from 'vue-i18n'
import zhCN from '@/locales/zh-CN'
import JobRelatedFilesTab from './JobRelatedFilesTab.vue'

vi.mock('@/api/file', () => ({
  fileApi: {
    listRelatedToJob: vi.fn().mockResolvedValue({
      items: [
        { id: 1, fileName: 'loaded.csv', fileStatus: 'LOADED' },
        { id: 2, fileName: 'dispatched.csv', fileStatus: 'DISPATCHED' },
        { id: 3, fileName: 'future.csv', fileStatus: 'FUTURE_STATUS' },
      ],
      total: 3,
    }),
  },
}))
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useConsoleMetaEnumsQuery: () => ({ data: ref(undefined) }),
}))

const table = defineComponent({
  props: ['data'],
  setup(props, { slots }) {
    provide(
      'rows',
      computed(() => props.data),
    )
    return () => h('div', slots.default?.())
  },
})
const column = defineComponent({
  props: ['prop'],
  setup(props, { slots }) {
    const rows = inject<Ref<Array<Record<string, unknown>>>>('rows')!
    return () =>
      h(
        'div',
        rows.value.map((row) => slots.default?.({ row }) ?? String(row[props.prop] ?? '')),
      )
  },
})
const tag = defineComponent({
  props: ['type'],
  setup(props, { slots }) {
    return () => h('span', { 'data-status-type': props.type }, slots.default?.())
  },
})

describe('作业关联文件状态', () => {
  it('按文件生命周期翻译并着色，未知状态保留原值和中性色', async () => {
    const i18n = createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': zhCN } })
    const wrapper = mount(JobRelatedFilesTab, {
      props: { tenantId: 'tenant-a', jobCode: 'job' },
      global: {
        plugins: [i18n],
        stubs: {
          ElTable: table,
          ElTableColumn: column,
          ElTag: tag,
          RouterLink: true,
          CopyableText: true,
          DatetimeColumn: true,
          ElButton: true,
          ElAlert: true,
          ElPagination: true,
        },
        directives: { loading: () => {} },
      },
    })
    await flushPromises()
    const statuses = wrapper.findAll('[data-status-type]')
    expect(
      statuses.map((status) => [status.text(), status.attributes('data-status-type')]),
    ).toEqual([
      ['已加载', 'success'],
      ['已派发', 'success'],
      ['FUTURE_STATUS', 'info'],
    ])
    wrapper.unmount()
  })
})
