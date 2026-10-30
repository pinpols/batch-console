import type { APIRequestContext } from '@playwright/test'
import { expect } from '@playwright/test'
import { QuartzDailyProgressFixture } from './fixture'

interface MultiCalendarState {
  definitions: Array<{
    id: number
    code: string
    version: number
    scheduleType: string
    calendarCode: string
    enabled: boolean
    scheduleEnabled: boolean
  }>
  occurrences: Array<{
    workflowId: number
    status: string
    bizDate: string
    fireTime: string
    calendarCode: string
    requestId: string | null
  }>
  coverage: Array<{
    workflowId: number
    calendarCode: string
    scheduleVersion: number
    from: string
    through: string
    lastSuccessAt: string
  }>
  days: Array<{ calendarCode: string; bizDate: string; status: string; cutoffAt: string | null }>
  runs: Array<{
    id: number
    workflowId: number
    bizDate: string
    status: string
    triggerRequestId: number
  }>
  requests: Array<{
    id: number
    requestId: string
    workflowId: number
    bizDate: string
    status: string
  }>
  jobInstances: number
}

/** 真实多定义、双日历与固定间隔计划；SQL不推进调度或业务运行。 */
export class MultiCalendarProgressFixture extends QuartzDailyProgressFixture {
  readonly secondCalendarCode = `${this.calendarCode}_secondary`

  prepareSecondCalendar() {
    expect(
      this.ownedSql('multi-calendar-progress-prepare', {
        second_calendar_code: this.secondCalendarCode,
      }),
    ).toEqual({ calendars: 2 })
  }

  multiCalendarState() {
    return this.ownedSql<MultiCalendarState>('multi-calendar-progress-state')
  }

  override async finish(request: APIRequestContext, reader?: APIRequestContext) {
    const cleanup = await super.finish(request, reader)
    const finalCleanup = this.ownedSql<Record<string, number>>('workflow-replay-final-cleanup')
    expect(Object.values(finalCleanup).every((count) => count === 0)).toBe(true)
    expect(this.ownedSql('workflow-replay-residue')).toEqual({})
    return { ...cleanup, ...finalCleanup, tenantTableRows: 0 }
  }
}
