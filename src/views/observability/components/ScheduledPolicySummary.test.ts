// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import ScheduledPolicySummary from './ScheduledPolicySummary.vue'

const messages = {
  jobMonitoringPolicy: {
    startGrace: '启动过晚',
    completionDeadline: '完成过晚',
    dependencyCompletionHint: '从依赖就绪后计算',
    nextDay: '计划日次日',
    sameDay: '计划日当日',
    manualScheduleHintShort: '仅耗时监控',
    disabled: '已关闭',
    secondsValue: '{seconds} 秒',
    minutesValue: '{minutes} 分钟',
  },
}

function render(job: Record<string, unknown>) {
  const i18n = createI18n({
    legacy: false,
    locale: 'zh-CN',
    messages: { 'zh-CN': messages },
  })
  return mount(ScheduledPolicySummary, {
    props: { job: { id: 1, jobCode: 'SAMPLE', scheduleType: 'MANUAL', ...job } as never },
    global: { plugins: [i18n] },
  })
}

describe('ScheduledPolicySummary', () => {
  it('shows both deadline rules for cron jobs with human-readable units and severity', () => {
    const wrapper = render({
      scheduleType: 'CRON',
      startGraceSeconds: 300,
      startGraceSeverity: 'ERROR',
      completionDeadlineLocalTime: '04:00:00',
      completionDeadlineDayOffset: 0,
      completionDeadlineSeverity: 'CRITICAL',
    })

    expect(wrapper.text()).toContain('启动过晚')
    expect(wrapper.text()).toContain('5 分钟')
    expect(wrapper.text()).toContain('完成过晚')
    expect(wrapper.text()).toContain('计划日当日 04:00')
    expect(wrapper.text()).toContain('CRITICAL')
  })

  it('shows fixed-rate standalone jobs as runtime-only', () => {
    const wrapper = render({
      scheduleType: 'FIXED_RATE',
      startGraceSeconds: 300,
      completionDeadlineLocalTime: null,
      completionDeadlineSeverity: 'ERROR',
    })

    expect(wrapper.text()).toBe('仅耗时监控')
  })

  it('shows dependency completion window for dependency-driven jobs', () => {
    const wrapper = render({
      scheduleType: 'MANUAL',
      dependsOnJobCode: 'UPSTREAM_JOB',
      startGraceSeconds: 300,
      dependencyCompletionWindowSeconds: 1200,
      completionDeadlineSeverity: 'ERROR',
    })

    expect(wrapper.text()).toContain('启动过晚')
    expect(wrapper.text()).toContain('5 分钟')
    expect(wrapper.text()).toContain('完成过晚')
    expect(wrapper.text()).toContain('20 分钟')
    expect(wrapper.text()).toContain('ERROR')
  })

  it('does not present deadline rules as applicable to manual jobs', () => {
    const wrapper = render({ scheduleType: 'MANUAL' })

    expect(wrapper.text()).toBe('仅耗时监控')
    expect(wrapper.text()).not.toContain('启动过晚')
    expect(wrapper.text()).not.toContain('完成过晚')
  })
})
