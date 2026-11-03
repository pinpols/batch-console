// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { onMounted, ref } from 'vue'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { i18n } from '@/locales'
import BatchDayList from './BatchDayList.vue'

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/composables/usePermission', () => ({
  usePermission: () => ({ canAccess: () => false, hasPermission: () => false }),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => ({ tenantId: 'tenant-a' }) }))
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useMetaCalendarsQuery: () => ({ data: ref([]) }),
}))
vi.mock('@/composables/useTenantReload', () => ({
  useTenantReload: (load: () => Promise<void>) => onMounted(() => void load()),
}))
vi.mock('@/api/batchDays', () => ({
  queryBatchDays: vi.fn().mockResolvedValue({
    items: [
      {
        bizDate: '2026-11-02',
        dayStatus: 'OPEN',
        successJobCount: 3,
        failedJobCount: 1,
        inFlightJobCount: 2,
        lateCount: 1,
      },
      {
        bizDate: '2026-11-03',
        dayStatus: 'FUTURE_STATUS',
        successJobCount: 0,
        failedJobCount: 0,
        inFlightJobCount: 0,
      },
      { bizDate: '2026-11-05', dayStatus: 'CLOSED' },
      { bizDate: '2026-11-06', dayStatus: null },
      { bizDate: '2026-11-07', dayStatus: 'SETTLED' },
    ],
  }),
}))
vi.mock('@/utils/datetime', async (original) => ({
  ...(await original<typeof import('@/utils/datetime')>()),
  businessCalendarDate: () => new Date(2026, 10, 2),
}))

const originalLocale = i18n.global.locale.value
afterEach(() => {
  i18n.global.locale.value = originalLocale
})

async function renderCalendar(locale: 'zh-CN' | 'en-US') {
  i18n.global.locale.value = locale
  const wrapper = shallowMount(BatchDayList, {
    global: {
      plugins: [i18n],
      directives: { loading: {} },
      stubs: {
        PageContainer: { template: '<main><slot /></main>' },
        ListPageQueryBar: { template: '<div><slot /></div>' },
        RouterLink: true,
      },
    },
  })
  await flushPromises()
  return wrapper
}

function dateCell(wrapper: Awaited<ReturnType<typeof renderCalendar>>, datePart: string) {
  const match = wrapper
    .findAll('button.batch-calendar__day')
    .find((cell) => cell.attributes('aria-label')?.includes(datePart))
  expect(match).toBeDefined()
  return match!
}

describe('批次日日历无障碍标签', () => {
  it('读出中文状态、未知状态、计数和无数据提示', async () => {
    const wrapper = await renderCalendar('zh-CN')
    expect(dateCell(wrapper, '2026年11月2日').attributes('aria-label')).toContain('开放')
    expect(dateCell(wrapper, '2026年11月2日').attributes('aria-label')).toContain(
      '成功 3 · 失败 1 · 运行 2',
    )
    expect(dateCell(wrapper, '2026年11月2日').attributes('aria-label')).toContain('超时 1')
    expect(dateCell(wrapper, '2026年11月3日').attributes('aria-label')).toContain('FUTURE_STATUS')
    expect(dateCell(wrapper, '2026年11月4日').attributes('aria-label')).toContain('暂无批次数据')
    expect(dateCell(wrapper, '2026年11月4日').attributes('disabled')).toBeDefined()
    expect(dateCell(wrapper, '2026年11月5日').attributes('aria-label')).toContain('关窗')
    expect(dateCell(wrapper, '2026年11月6日').attributes('aria-label')).toContain('未知')
    expect(dateCell(wrapper, '2026年11月7日').attributes('aria-label')).toContain('已结算')
    wrapper.unmount()
  })

  it('切换英文后读出对应本地化状态及无数据提示', async () => {
    const wrapper = await renderCalendar('zh-CN')
    i18n.global.locale.value = 'en-US'
    await flushPromises()
    expect(dateCell(wrapper, 'November 2, 2026').attributes('aria-label')).toContain('Open')
    expect(dateCell(wrapper, 'November 3, 2026').attributes('aria-label')).toContain(
      'FUTURE_STATUS',
    )
    expect(dateCell(wrapper, 'November 4, 2026').attributes('aria-label')).toContain(
      'No batch data',
    )
    expect(dateCell(wrapper, 'November 6, 2026').attributes('aria-label')).toContain('Unknown')
    expect(dateCell(wrapper, 'November 7, 2026').attributes('aria-label')).toContain('Settled')
    wrapper.unmount()
  })
})
