// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import HolidayMonthView from './HolidayMonthView.vue'

vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({
    t: (key: string, args?: Record<string, unknown>) => `${key} ${args?.count ?? ''}`,
    te: () => false,
    locale: ref('zh-CN'),
  }),
}))
vi.mock('@/utils/datetime', () => ({ businessCalendarDate: () => new Date(2026, 9, 15, 12) }))

describe('HolidayMonthView', () => {
  it('shows only returned date records and never labels an unrecorded day a workday', async () => {
    const wrapper = mount(HolidayMonthView, {
      props: {
        records: [
          {
            id: 1,
            holidayDate: '2026-10-01',
            holidayName: '节日',
            holidayType: 'HOLIDAY',
            description: '',
          },
          {
            id: 2,
            holidayDate: '2026-10-09',
            holidayName: '调班',
            holidayType: 'WORKDAY',
            description: '',
          },
        ],
      },
    })
    await wrapper.get('[data-date="2026-10-01"]').trigger('click')
    expect(wrapper.text()).toContain('节日')
    expect(wrapper.text()).toContain('HOLIDAY')
    await wrapper.get('[data-date="2026-10-02"]').trigger('click')
    expect(wrapper.text()).toContain('queueConfig.holidayMonthUnknown')
    expect(wrapper.text()).not.toContain('WORKDAY')
    await wrapper.get('[data-date="2026-10-09"]').trigger('click')
    expect(wrapper.text()).toContain('调班')
    expect(wrapper.text()).toContain('WORKDAY')
  })
})
