import { toneOf, type TimetableTone } from '@/views/ops/timetable'

/** 极短步骤（毫秒级）在整段时间轴上不足 1px，保留最小可见宽度 */
const MIN_BAR_PERCENT = 0.8

export interface StepTimelineInput {
  id: number
  stepCode: string
  stepStatus?: string | null
  startedAt?: string | null
  finishedAt?: string | null
}

export interface StepTimelineBar {
  id: number
  stepCode: string
  status: string
  tone: TimetableTone
  left: number
  width: number
  durationMs: number
  /** 尚未结束，条形画到当前时间 */
  open: boolean
}

export interface StepTimeline {
  bars: StepTimelineBar[]
  spanMs: number
  /** 未开始、无法放上时间轴的步骤数 */
  notStarted: number
}

function parseMs(value?: string | null): number | null {
  if (!value) return null
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? null : ms
}

/**
 * 把一个作业实例的步骤排到同一条时间轴上：轴从最早开始到最晚结束（未结束的取当前时间），
 * 用于一眼看出耗时集中在哪一步、步骤之间是否有等待空档。
 */
export function buildStepTimeline(
  steps: readonly StepTimelineInput[],
  nowMs: number,
): StepTimeline {
  let notStarted = 0
  const placed: { step: StepTimelineInput; startMs: number; endMs: number; open: boolean }[] = []
  for (const step of steps) {
    const startMs = parseMs(step.startedAt)
    if (startMs == null) {
      notStarted++
      continue
    }
    const finishedMs = parseMs(step.finishedAt)
    const endMs = finishedMs ?? Math.max(nowMs, startMs)
    placed.push({ step, startMs, endMs, open: finishedMs == null })
  }
  if (placed.length === 0) return { bars: [], spanMs: 0, notStarted }

  const axisStart = Math.min(...placed.map((item) => item.startMs))
  const axisEnd = Math.max(...placed.map((item) => item.endMs))
  // 全部步骤同一时刻开始结束时轴长为 0，按 1ms 处理避免除零
  const spanMs = Math.max(1, axisEnd - axisStart)
  const toPercent = (ms: number) => ((ms - axisStart) / spanMs) * 100

  const bars = placed
    .sort((a, b) => a.startMs - b.startMs || a.step.id - b.step.id)
    .map(({ step, startMs, endMs, open }) => {
      const left = toPercent(startMs)
      const status = String(step.stepStatus ?? '')
      return {
        id: step.id,
        stepCode: step.stepCode,
        status,
        tone: toneOf(status),
        left: Math.min(left, 100 - MIN_BAR_PERCENT),
        width: Math.max(MIN_BAR_PERCENT, toPercent(endMs) - left),
        durationMs: endMs - startMs,
        open,
      }
    })
  return { bars, spanMs, notStarted }
}
