type Segment = { start: number; end: number }
type Preview = {
  mode: 'incomplete' | 'full-day' | 'same-day' | 'overnight'
  segments: Segment[]
  rangeInvalid: boolean
  fullDueCrossDay: boolean
}

function seconds(value: string | null | undefined): number | null {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value ?? '')
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  const second = Number(match[3] ?? 0)
  if (hour > 23 || minute > 59 || second > 59) return null
  return hour * 3600 + minute * 60 + second
}

/** 与 DefaultResourceScheduler 的日内判断一致；写入校验单独提示。 */
export function windowPreview(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  allowCrossDay: boolean,
): Preview {
  const start = seconds(startTime)
  const end = seconds(endTime)
  if (start === null || end === null)
    return { mode: 'incomplete', segments: [], rangeInvalid: false, fullDueCrossDay: false }
  const rangeInvalid = !allowCrossDay && start >= end
  const fullDueCrossDay = allowCrossDay && start < end
  if (start === end || fullDueCrossDay)
    return { mode: 'full-day', segments: [{ start: 0, end: 1 }], rangeInvalid, fullDueCrossDay }
  if (start > end)
    return {
      mode: 'overnight',
      segments: [
        { start: 0, end: end / 86400 },
        { start: start / 86400, end: 1 },
      ],
      rangeInvalid,
      fullDueCrossDay,
    }
  return {
    mode: 'same-day',
    segments: [{ start: start / 86400, end: end / 86400 }],
    rangeInvalid,
    fullDueCrossDay,
  }
}
