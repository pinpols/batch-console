/** 直接展示后端事件；旧版本缺字段时不从其他记录推导。 */
export interface TraceTimelineEvent {
  source: string | null
  eventType: string | null
  referenceId: string | null
  status: string | null
  message: string | null
  occurredAt: string | null
}

function textValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

export function buildTraceTimeline(input: unknown): {
  available: boolean
  events: TraceTimelineEvent[]
} {
  if (!Array.isArray(input)) return { available: false, events: [] }
  const events = input.map((item: unknown) => {
    const data =
      item && typeof item === 'object' && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : {}
    const time = textValue(data.occurredAt)
    const reference = data.referenceId
    return {
      source: textValue(data.source),
      eventType: textValue(data.eventType),
      referenceId:
        typeof reference === 'number' && Number.isFinite(reference)
          ? String(reference)
          : textValue(reference),
      status: textValue(data.status),
      message: textValue(data.message),
      occurredAt: time && Number.isFinite(Date.parse(time)) ? time : null,
    }
  })
  return { available: true, events }
}
