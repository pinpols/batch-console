// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import TenantPackageGuideDrawer from './TenantPackageGuideDrawer.vue'

const guide = vi.hoisted(() => vi.fn())

vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}))
vi.mock('@/api/tenantPackageExcel', () => ({ tenantPackageGuide: guide }))

const column = (columnName: string, extra: Record<string, unknown> = {}) => ({
  columnName,
  required: false,
  readOnly: false,
  guideLevel: '可选',
  format: '字符串',
  allowedValues: [],
  description: `${columnName} 说明`,
  example: '',
  fillExample: '',
  defaultBehavior: '',
  appliesTo: 'ALL',
  ...extra,
})

const sheets = [
  {
    sheetName: 'resource_queue',
    appliesTo: 'ALL',
    columns: [
      column('queue_code', { required: true, guideLevel: '必填' }),
      column('worker_group', { guideLevel: '常用' }),
      column('priority_policy', { guideLevel: '高级', allowedValues: ['FIFO', 'PRIORITY'] }),
    ],
  },
  {
    sheetName: 'business_calendar',
    appliesTo: 'ALL',
    columns: [column('calendar_code', { required: true }), column('timezone')],
  },
]

const container = { template: '<div><slot /></div>' }
const vModel = (tag: string, className: string) => ({
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: `<${tag} class="${className}" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`,
})

function mountDrawer() {
  return mount(TenantPackageGuideDrawer, {
    props: { modelValue: true },
    global: {
      directives: { loading: () => {} },
      stubs: {
        ElDrawer: {
          emits: ['open'],
          template: '<div><slot /></div>',
          mounted() {
            this.$emit('open')
          },
        },
        ElInput: vModel('input', 'stub-search'),
        ElSelect: container,
        ElOption: true,
        ElSegmented: {
          props: ['modelValue', 'options'],
          emits: ['update:modelValue'],
          template:
            '<div><button v-for="o in options" :key="o.value" class="stub-level" @click="$emit(\'update:modelValue\', o.value)">{{ o.value }}</button></div>',
        },
        ElTable: { props: ['data'], template: '<div class="stub-rows">{{ data.length }}</div>' },
        ElTableColumn: true,
        ElTag: container,
        CopyableText: true,
      },
    },
  })
}

const counts = (wrapper: ReturnType<typeof mountDrawer>) =>
  wrapper
    .findAll('.guide__sheet-count')
    .map((item) => JSON.parse(item.text().split(':').slice(1).join(':')).count)

describe('TenantPackageGuideDrawer', () => {
  it('打开时加载说明并在工作表目录显示每张表的列数', async () => {
    guide.mockResolvedValueOnce({ sheets })
    const wrapper = mountDrawer()
    await flushPromises()

    expect(guide).toHaveBeenCalledOnce()
    expect(wrapper.findAll('.guide__sheet-name').map((item) => item.text())).toEqual([
      'resource_queue',
      'business_calendar',
    ])
    expect(counts(wrapper)).toEqual([3, 2])
    expect(wrapper.find('.stub-rows').text()).toBe('3')
  })

  it('关键词与层级筛选同时作用于目录计数和当前表格', async () => {
    guide.mockResolvedValueOnce({ sheets })
    const wrapper = mountDrawer()
    await flushPromises()

    await wrapper.find('.stub-search').setValue('calendar')
    expect(counts(wrapper)).toEqual([0, 1])

    await wrapper.find('.stub-search').setValue('')
    const required = wrapper.findAll('.stub-level').find((item) => item.text() === 'required')!
    await required.trigger('click')
    expect(counts(wrapper)).toEqual([1, 1])
    expect(wrapper.find('.stub-rows').text()).toBe('1')
  })

  it('点击目录切换当前工作表', async () => {
    guide.mockResolvedValueOnce({ sheets })
    const wrapper = mountDrawer()
    await flushPromises()

    await wrapper.findAll('.guide__sheet')[1]!.trigger('click')
    expect(wrapper.find('.guide__title').text()).toBe('business_calendar')
    expect(wrapper.find('.stub-rows').text()).toBe('2')
  })
})
