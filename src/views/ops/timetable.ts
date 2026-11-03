import { workflowRunStatusClass } from '@/constants/workflowStatusTheme'

const HOUR_MS = 3_600_000
const DAY_HOURS = 24
const TICK_STEP_HOURS = 4
/** 极短运行（秒级）在 24 小时轴上不足 1px，保留最小可见宽度以免“看不见的成功/失败” */
const MIN_SEGMENT_PERCENT = 0.35

export interface TimetableInstance {
  id: number
  jobCode: string
  workerGroup?: string | null
  instanceStatus: string
  startedAt?: string | null
  finishedAt?: string | null
}

export type TimetableTone = 'success' | 'danger' | 'running' | 'warning' | 'idle'

export interface TimetableSegment {
  id: number
  jobCode: string
  status: string
  tone: TimetableTone
  left: number
  width: number
  startedAt: string
  finishedAt: string | null
}

export interface TimetableLane {
  /** Worker 组；空字符串表示实例未记录 Worker 组 */
  key: string
  segments: TimetableSegment[]
}

export interface Timetable {
  lanes: TimetableLane[]
  axisHours: number
  ticks: { label: string; percent: number }[]
  /** 当前时间在轴上的位置；不在轴范围内时为 null */
  nowPercent: number | null
  /** 尚未开始、无法定位到时间轴的实例数 */
  notStarted: number
}

/** 运行状态到时刻轨道色调的映射；首页轨道与作业实例步骤条共用 */
export function toneOf(status: string): TimetableTone {
  switch (workflowRunStatusClass(status)) {
    case 'success':
      return 'success'
    case 'failed':
      return 'danger'
    case 'running':
      return 'running'
    case 'waiting':
      return 'warning'
    default:
      return 'idle'
  }
}

function parseMs(value?: string | null): number | null {
  if (!value) return null
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? null : ms
}

/**
 * 把一个业务日的作业实例排成时刻轨道。轴从业务日零点开始至少 24 小时，
 * 运行跨过次日时延长到覆盖最后结束时间的整点；未结束的运行画到当前时间。
 */
export function buildTimetable(
  instances: readonly TimetableInstance[],
  opts: { dayStartMs: number; nowMs: number },
): Timetable {
  const { dayStartMs, nowMs } = opts
  let notStarted = 0
  const placed: { instance: TimetableInstance; startMs: number; endMs: number }[] = []
  for (const instance of instances) {
    const startMs = parseMs(instance.startedAt)
    if (startMs == null) {
      notStarted++
      continue
    }
    const endMs = parseMs(instance.finishedAt) ?? Math.max(nowMs, startMs)
    placed.push({ instance, startMs, endMs })
  }

  const latestEndMs = placed.reduce((latest, item) => Math.max(latest, item.endMs), dayStartMs)
  const axisHours = Math.max(DAY_HOURS, Math.ceil((latestEndMs - dayStartMs) / HOUR_MS))
  const axisMs = axisHours * HOUR_MS
  const toPercent = (ms: number) => ((ms - dayStartMs) / axisMs) * 100

  const lanesByKey = new Map<string, TimetableSegment[]>()
  for (const { instance, startMs, endMs } of placed) {
    const left = Math.max(0, toPercent(startMs))
    const right = Math.min(100, toPercent(endMs))
    const key = instance.workerGroup?.trim() ?? ''
    const segments = lanesByKey.get(key) ?? []
    segments.push({
      id: instance.id,
      jobCode: instance.jobCode,
      status: instance.instanceStatus,
      tone: toneOf(instance.instanceStatus),
      left,
      width: Math.max(MIN_SEGMENT_PERCENT, right - left),
      startedAt: instance.startedAt as string,
      finishedAt: instance.finishedAt ?? null,
    })
    lanesByKey.set(key, segments)
  }

  const lanes = [...lanesByKey.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, segments]) => ({ key, segments: segments.sort((a, b) => a.left - b.left) }))

  const ticks: Timetable['ticks'] = []
  for (let hour = 0; hour <= axisHours; hour += TICK_STEP_HOURS) {
    ticks.push({ label: `${String(hour).padStart(2, '0')}:00`, percent: (hour / axisHours) * 100 })
  }

  const nowRaw = toPercent(nowMs)
  return {
    lanes,
    axisHours,
    ticks,
    nowPercent: nowRaw >= 0 && nowRaw <= 100 ? nowRaw : null,
    notStarted,
  }
}
