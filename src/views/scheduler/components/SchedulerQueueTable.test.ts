// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, inject, nextTick, provide, ref, type ComputedRef } from 'vue'
import { shallowMount } from '@vue/test-utils'
import SchedulerQueueTable from './SchedulerQueueTable.vue'
import type { ConsoleSchedulerQueueSnapshot } from '@/types/console-api'

vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))

const row = {
  queueCode: 'QUEUE_A',
  fairShareGroup: 'GROUP_A',
  quotaResetPolicy: 'DAILY',
  activePartitions: 4,
  maxRunningPartitions: 10,
} as ConsoleSchedulerQueueSnapshot

const Table = defineComponent({
  name: 'ElTable',
  props: { data: { type: Array, required: true } },
  setup(props, { slots }) {
    provide(
      'queueTableRows',
      computed(() => props.data),
    )
    return () => h('div', slots.default?.())
  },
})
const TableColumn = defineComponent({
  name: 'ElTableColumn',
  props: ['label', 'fixed', 'minWidth'],
  setup(_, { slots }) {
    const records = inject<ComputedRef<unknown[]>>('queueTableRows')!
    return () =>
      h(
        'div',
        records.value.map((item) => slots.default?.({ row: item })),
      )
  },
})
const pass = { template: '<span><slot /></span>' }
const stubs = {
  ElTable: Table,
  ElTableColumn: TableColumn,
  ElTag: pass,
  ElButton: pass,
  ElProgress: { props: ['percentage'], template: '<span class="progress">{{ percentage }}</span>' },
  CopyableText: pass,
  DatetimeColumn: true,
  TablePagerBar: {
    name: 'TablePagerBar',
    props: ['page', 'pageSize', 'total'],
    template: '<div />',
  },
}

describe('调度快照队列表', () => {
  it('长队列编码与组名可分别完整查看，空组名不会出现多余按钮', async () => {
    const queue = `queue-${'q'.repeat(100)}`
    const group = `group-${'g'.repeat(100)}`
    const popover = defineComponent({
      setup(_props, { expose, slots }) {
        const open = ref(false)
        expose({
          hide: () => {
            open.value = false
          },
        })
        return () =>
          h(
            'span',
            {
              onClickCapture: () => {
                open.value = !open.value
              },
            },
            [slots.reference?.(), open.value ? slots.default?.() : null],
          )
      },
    })
    const wrapper = shallowMount(SchedulerQueueTable, {
      props: {
        records: [{ ...row, queueCode: queue, fairShareGroup: group }],
        loading: false,
        page: 1,
        pageSize: 15,
        total: 1,
      },
      global: { stubs: { ...stubs, CopyableText: false, ElPopover: popover } },
    })
    const groupCell = wrapper.get('.cell-main')
    expect(groupCell.text()).toContain(group)
    const buttons = groupCell.findAll('button[aria-label="common.viewFullValue"]')
    expect(buttons).toHaveLength(2)
    await buttons[0]!.trigger('click')
    expect(groupCell.get('.copyable-text__full-value').text()).toBe(queue)
    await buttons[1]!.trigger('click')
    expect(groupCell.findAll('.copyable-text__full-value').map((item) => item.text())).toEqual([
      queue,
      group,
    ])
    expect(groupCell.find('.copyable-text__copy').exists()).toBe(false)

    await wrapper.setProps({ records: [{ ...row, fairShareGroup: '' }] })
    expect(groupCell.findAll('button[aria-label="common.viewFullValue"]')).toHaveLength(1)
    expect(groupCell.text()).toContain('QUEUE_A')
  })

  it('窄屏让队列列留在视口内，桌面恢复固定操作列', async () => {
    const originalWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth')
    const makeTable = () =>
      shallowMount(SchedulerQueueTable, {
        props: { records: [row], loading: false, page: 1, pageSize: 15, total: 1 },
        global: { stubs },
      })
    const findColumn = (wrapper: ReturnType<typeof makeTable>, label: string) =>
      wrapper.findAllComponents(TableColumn).find((column) => column.props('label') === label)!
    try {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 })
      const mobile = makeTable()
      await nextTick()
      expect(findColumn(mobile, 'schedulerSnapshot.colQueue').props('minWidth')).toBe(200)
      expect(findColumn(mobile, 'schedulerSnapshot.colActions').props('fixed')).toBe(false)
      mobile.unmount()

      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 })
      const desktop = makeTable()
      await nextTick()
      expect(findColumn(desktop, 'schedulerSnapshot.colQueue').props('minWidth')).toBe(280)
      expect(findColumn(desktop, 'schedulerSnapshot.colActions').props('fixed')).toBe('right')
      desktop.unmount()
    } finally {
      if (originalWidth) Object.defineProperty(window, 'innerWidth', originalWidth)
    }
  })

  it('按返回的分区容量展示进度，缺少上限时显示未知', async () => {
    const wrapper = shallowMount(SchedulerQueueTable, {
      props: { records: [row], loading: false, page: 2, pageSize: 15, total: 20 },
      global: { stubs },
    })
    expect(wrapper.findComponent(Table).props('data')).toEqual([row])
    expect(wrapper.text()).toContain('QUEUE_A')
    expect(wrapper.text()).toContain('4 / 10')
    expect(wrapper.find('.progress').text()).toBe('40')

    await wrapper.setProps({ records: [{ ...row, maxRunningPartitions: 0 }] })
    expect(wrapper.text()).toContain('schedulerSnapshot.partitionCapacityUnknown')
    expect(wrapper.find('.progress').exists()).toBe(false)
  })

  it('保留父页面的分页状态并转发页码及每页条数', () => {
    const wrapper = shallowMount(SchedulerQueueTable, {
      props: { records: [row], loading: true, page: 2, pageSize: 15, total: 20 },
      global: { stubs },
    })
    const pager = wrapper.findComponent({ name: 'TablePagerBar' })
    expect(pager.props()).toMatchObject({ page: 2, pageSize: 15, total: 20 })
    pager.vm.$emit('update:page', 3)
    pager.vm.$emit('update:pageSize', 30)
    expect(wrapper.emitted('update:page')).toEqual([[3]])
    expect(wrapper.emitted('update:pageSize')).toEqual([[30]])
  })
})
