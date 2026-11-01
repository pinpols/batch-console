// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import QueueConfig from './QueueConfig.vue'
import { useTenantStore } from '@/stores/tenant'

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  remove: vi.fn(),
  update: vi.fn(),
  confirm: vi.fn(),
}))
vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/governance/calendars', query: {}, meta: { mode: 'calendars' } }),
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('@/stores/tenant', async () => {
  const { reactive } = await import('vue')
  const state = reactive({ tenantId: 'tenant-a' })
  return { useTenantStore: () => state }
})
vi.mock('@/composables/useTenantReload', () => ({ useTenantReload: vi.fn() }))
vi.mock('@/composables/usePermission', () => ({
  usePermission: () => ({ canAccess: () => true, canWriteSystem: ref(true) }),
}))
vi.mock('@/composables/useDangerConfirm', () => ({ confirmDanger: mocks.confirm }))
vi.mock('@/api/governance', () => ({
  governanceApi: {
    listCalendarHolidays: mocks.list,
    deleteCalendarHoliday: mocks.remove,
    updateCalendarHoliday: mocks.update,
  },
}))
vi.mock('element-plus', async (original) => ({
  ...(await original<typeof import('element-plus')>()),
  ElMessage: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}))
const slot = { template: '<div><slot /></div>' }
const calendar = (id: number) => ({ id, calendarCode: `cal-${id}` })
const holiday = (id: number) => ({
  id,
  holidayDate: '2026-10-01',
  holidayName: `day-${id}`,
  holidayType: 'HOLIDAY',
  description: '',
})
function render() {
  const wrapper = shallowMount(QueueConfig, {
    global: {
      stubs: { PageContainer: slot, ElDrawer: slot, ElForm: slot, ElFormItem: slot, ElAlert: slot },
    },
  })
  const vm = wrapper.vm as unknown as {
    openHolidays: (row: object) => Promise<void>
    deleteHoliday: (row: object) => Promise<void>
    openHolidayEdit: (row: object) => void
    saveHoliday: () => Promise<void>
  }
  return { wrapper, vm }
}
describe('节假日抽屉请求范围', () => {
  beforeEach(() => {
    useTenantStore().tenantId = 'tenant-a'
    mocks.list.mockReset()
    mocks.remove.mockReset().mockResolvedValue(undefined)
    mocks.update.mockReset().mockResolvedValue(undefined)
    mocks.confirm.mockReset().mockResolvedValue(undefined)
  })
  it('新日历加载后不接受旧日历迟到的记录', async () => {
    let finishOld!: (value: unknown) => void
    mocks.list.mockImplementation((id: number) =>
      id === 1
        ? new Promise((resolve) => {
            finishOld = resolve
          })
        : Promise.resolve([holiday(22)]),
    )
    const { wrapper, vm } = render()
    const old = vm.openHolidays(calendar(1))
    await vm.openHolidays(calendar(2))
    await nextTick()
    finishOld([holiday(11)])
    await old
    await flushPromises()
    expect(wrapper.findComponent({ name: 'HolidayMonthView' }).props('records')).toEqual([
      holiday(22),
    ])
    wrapper.unmount()
  })
  it('切换租户时丢弃旧租户迟到的节假日数据', async () => {
    let finishOld!: (value: unknown) => void
    mocks.list.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishOld = resolve
        }),
    )
    const { wrapper, vm } = render()
    const pending = vm.openHolidays(calendar(1))
    useTenantStore().tenantId = 'tenant-b'
    finishOld([holiday(11)])
    await pending
    await flushPromises()
    expect(wrapper.findComponent({ name: 'HolidayMonthView' }).exists()).toBe(false)
    wrapper.unmount()
  })
  it('月视图使用全部返回记录，不受表格每页 15 条影响', async () => {
    const records = Array.from({ length: 16 }, (_, index) => holiday(index + 1))
    mocks.list.mockResolvedValue(records)
    const { wrapper, vm } = render()
    await vm.openHolidays(calendar(1))
    await nextTick()
    expect(wrapper.findComponent({ name: 'HolidayMonthView' }).props('records')).toEqual(records)
    wrapper.unmount()
  })
  it('切换日历后，不会用新日历 ID 删除旧日历记录', async () => {
    let confirm!: () => void
    mocks.list.mockResolvedValue([])
    mocks.confirm.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        confirm = resolve
      }),
    )
    const { wrapper, vm } = render()
    await vm.openHolidays(calendar(1))
    const pending = vm.deleteHoliday(holiday(11))
    await vm.openHolidays(calendar(2))
    confirm()
    await pending
    expect(mocks.remove).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('编辑保存时使用所选日历及原记录 ID', async () => {
    mocks.list.mockResolvedValue([])
    const { wrapper, vm } = render()
    await vm.openHolidays(calendar(1))
    vm.openHolidayEdit(holiday(11))
    await vm.saveHoliday()
    expect(mocks.update).toHaveBeenCalledWith(
      1,
      11,
      expect.objectContaining({ tenantId: 'tenant-a', bizDate: '2026-10-01', dayType: 'HOLIDAY' }),
    )
    wrapper.unmount()
  })
  it('切换日历时关闭旧编辑并阻止旧记录写入新日历', async () => {
    mocks.list.mockResolvedValue([])
    const { wrapper, vm } = render()
    await vm.openHolidays(calendar(1))
    vm.openHolidayEdit(holiday(11))
    await vm.openHolidays(calendar(2))
    await vm.saveHoliday()
    expect(mocks.update).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('读取失败时提示失败而非显示空月历', async () => {
    mocks.list.mockRejectedValue(new Error('unavailable'))
    const { wrapper, vm } = render()
    await vm.openHolidays(calendar(1))
    await flushPromises()
    expect(wrapper.findComponent({ name: 'HolidayMonthView' }).exists()).toBe(false)
    expect(
      wrapper.find('el-alert-stub').exists() ||
        wrapper.html().includes('queueConfig.holidayLoadError'),
    ).toBe(true)
    wrapper.unmount()
  })
  it('确认后删除原日历的原记录并刷新当前日历', async () => {
    mocks.list.mockResolvedValue([])
    const { wrapper, vm } = render()
    await vm.openHolidays(calendar(1))
    await vm.deleteHoliday(holiday(11))
    expect(mocks.remove).toHaveBeenCalledWith(1, 11, 'tenant-a')
    expect(mocks.list).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })
})
