import type { ConsoleBatchDayWindowResponse } from '@/types/console-api'

type Occurrence = ConsoleBatchDayWindowResponse['scheduledOccurrences'][number]
type ActualFire = Occurrence['actualFires'][number]
type Milestones = Pick<
  ConsoleBatchDayWindowResponse,
  'currentSystemTime' | 'cutoffAt' | 'slaDeadlineAt' | 'lateArrivalWindowClosesAt'
>
export type BatchDayTimelineEvent = {
  kind: 'snapshot' | 'cutoff' | 'sla' | 'late' | 'scheduled' | 'actual'
  time: string
  occurrence?: Occurrence
  fire?: ActualFire
}

export function filterScheduledOccurrences(
  occurrences: readonly Occurrence[],
  workflow: string,
  status: string,
) {
  return occurrences.filter(
    (item) =>
      (!workflow || item.workflowCode === workflow) &&
      (!status || item.occurrenceStatus === status),
  )
}

/** 仅接受带 UTC 偏移的时间，避免将无时区的值解释为浏览器本地时间。 */
function instant(value: string | null | undefined): number | null {
  if (!value) return null
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/i.exec(
      value,
    )
  if (!match) return null
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, offset] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) return null
  if (Number(hourText) > 23 || Number(minuteText) > 59 || Number(secondText) > 59) return null
  if (offset !== 'Z' && offset !== 'z') {
    const hours = Number(offset.slice(1, 3))
    const minutes = Number(offset.slice(4, 6))
    if (hours > 18 || minutes > 59 || (hours === 18 && minutes !== 0)) return null
  }
  const result = Date.parse(value)
  return Number.isFinite(result) ? result : null
}

export function batchDayTimeline(window: Milestones, occurrences: readonly Occurrence[]) {
  const entries: Array<{ event: BatchDayTimelineEvent; instant: number }> = []
  function add(
    kind: BatchDayTimelineEvent['kind'],
    time: string | null | undefined,
    occurrence?: Occurrence,
    fire?: ActualFire,
  ) {
    const value = instant(time)
    if (value === null || !time) return false
    entries.push({ event: { kind, time, occurrence, fire }, instant: value })
    return true
  }
  add('snapshot', window.currentSystemTime)
  add('cutoff', window.cutoffAt)
  add('sla', window.slaDeadlineAt)
  add('late', window.lateArrivalWindowClosesAt)
  let invalidOccurrences = 0
  for (const occurrence of occurrences) {
    if (!add('scheduled', occurrence.scheduledFireTime, occurrence)) invalidOccurrences++
    for (const fire of occurrence.actualFires ?? []) {
      add('actual', fire.actualFireTime, occurrence, fire)
    }
  }
  entries.sort((a, b) => a.instant - b.instant)
  return { events: entries.map((item) => item.event), invalidOccurrences }
}
