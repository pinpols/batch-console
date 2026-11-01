// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, inject, provide, type ComputedRef } from 'vue'
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
    provide('queueTableRows', computed(() => props.data))
    return () => h('div', slots.default?.())
  },
})
const TableColumn = defineComponent({
  name: 'ElTableColumn',
  setup(_, { slots }) {
    const records = inject<ComputedRef<unknown[]>>('queueTableRows')!
    return () => h('div', records.value.map((item) => slots.default?.({ row: item })))
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
  TablePagerBar: { name: 'TablePagerBar', props: ['page', 'pageSize', 'total'], template: '<div />' },
}

describe('调度快照队列表', () => {
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
