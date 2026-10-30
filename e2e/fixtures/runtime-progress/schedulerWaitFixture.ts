import { expect, type APIRequestContext } from '@playwright/test'
import { PersistentWaitFixture } from './fixture'

interface SchedulerWaitState {
  calendarRows: number
  calendarStatus: string | null
  batchDayRows: number
  batchDayStatus: string | null
  manualAction: string | null
  manualReason: string | null
  manualOperatorPresent: boolean
  jobRows: number
  jobWaitStatus: string | null
  jobWaitRequestId: string | null
  triggerRequestRows: number
  jobCode: string
  upstreamJobCode: string
  privatePayloadMarkerPresent: boolean
  triggerRequestStatus: string | null
  jobDefinitionRows: number
  dependencyRows: number
  releaseCalendarRows: number
  releaseCalendarStatus: string | null
  releaseManualAction: string | null
  releaseManualReason: string | null
  releaseManualOperatorPresent: boolean
  releaseBatchDayRows: number
  releaseBatchDayStatus: string | null
  releaseBatchOperationReason: string | null
  releaseBatchOperatedByPresent: boolean
}

function addUtcDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** 持久化跨日历与作业依赖等待的独占页面/权限联调夹具。 */
export class SchedulerWaitFixture extends PersistentWaitFixture {
  readonly calendarWaitDate = addUtcDays(this.bizDate, 1)
  readonly releaseWaitDate = addUtcDays(this.bizDate, 2)
  readonly jobWaitCode = `${this.tenantId}-JOB-WAIT`
  readonly upstreamJobCode = `${this.tenantId}-UPSTREAM`
  jobWaitRequestId = ''
  private schedulerWaitsSeeded = false

  seedSchedulerWaits() {
    const result = this.ownedSql<{ calendarRows: number }>('scheduler-waits-seed', {
      calendar_code: this.calendarCode,
      calendar_biz_date: this.calendarWaitDate,
    })
    expect(result).toEqual({ calendarRows: 1 })
    this.schedulerWaitsSeeded = true
  }

  rememberJobWaitRequestId(requestId: string) {
    this.jobWaitRequestId = requestId
  }

  seedCalendarReleaseWait() {
    const result = this.ownedSql<{ calendarRows: number }>('scheduler-waits-release-seed', {
      calendar_code: this.calendarCode,
      calendar_biz_date: this.releaseWaitDate,
    })
    expect(result).toEqual({ calendarRows: 1 })
  }

  schedulerWaitState(): SchedulerWaitState {
    return this.ownedSql<SchedulerWaitState>('scheduler-waits-state', {
      calendar_code: this.calendarCode,
      calendar_biz_date: this.calendarWaitDate,
      release_biz_date: this.releaseWaitDate,
      job_biz_date: this.bizDate,
      job_code: this.jobWaitCode,
      upstream_job_code: this.upstreamJobCode,
      request_id: this.jobWaitRequestId,
    })
  }

  makeCalendarSkipDue() {
    const result = this.ownedSql<{ updatedRows: number }>('scheduler-waits-make-due', {
      calendar_code: this.calendarCode,
      calendar_biz_date: this.calendarWaitDate,
    })
    expect(result).toEqual({ updatedRows: 1 })
  }

  makeCalendarReleaseDue() {
    const result = this.ownedSql<{ updatedRows: number }>('scheduler-waits-release-make-due', {
      calendar_code: this.calendarCode,
      calendar_biz_date: this.releaseWaitDate,
    })
    expect(result).toEqual({ updatedRows: 1 })
  }

  cleanupSchedulerWaits() {
    return this.ownedSql<Record<string, number>>('scheduler-waits-cleanup', {
      calendar_code: this.calendarCode,
      calendar_biz_date: this.calendarWaitDate,
      release_biz_date: this.releaseWaitDate,
      job_biz_date: this.bizDate,
      job_code: this.jobWaitCode,
      upstream_job_code: this.upstreamJobCode,
      request_id: this.jobWaitRequestId,
    })
  }

  override async finish(request: APIRequestContext, reader?: APIRequestContext) {
    let waitCleanup: Record<string, number> = {}
    if (this.schedulerWaitsSeeded) {
      waitCleanup = this.cleanupSchedulerWaits()
      expect(Object.values(waitCleanup).every((count) => count === 0)).toBe(true)
    }
    const parentCleanup = await super.finish(request, reader)
    const definitionCleanup = this.ownedSql<{
      jobDefinitionsRemaining: number
      dependencyRowsRemaining: number
    }>('scheduler-waits-definitions-cleanup', {
      job_code: this.jobWaitCode,
      upstream_job_code: this.upstreamJobCode,
    })
    expect(definitionCleanup).toEqual({ jobDefinitionsRemaining: 0, dependencyRowsRemaining: 0 })
    const finalState = this.schedulerWaitState()
    expect(finalState).toMatchObject({
      calendarRows: 0,
      releaseCalendarRows: 0,
      releaseBatchDayRows: 0,
      jobRows: 0,
      triggerRequestRows: 0,
      jobDefinitionRows: 0,
      dependencyRows: 0,
    })
    return {
      ...parentCleanup,
      ...waitCleanup,
      ...definitionCleanup,
      finalSchedulerWaitState: finalState,
    }
  }
}
