export type WorkflowRunVisualClass = 'running' | 'success' | 'failed' | 'waiting' | 'cancelled'

/**
 * 工作流运行状态色与全站语义 token 同源（StatusTag、首页时刻轨道使用同一组 token），
 * 不再单独写死一套色值。CSS 场景直接引用 token，随明暗主题变化；
 * Mermaid 需要具体色值，渲染时读取当前主题的 token 实际值。
 */
interface WorkflowRunVisualSource {
  token: string
  /** 读取不到 token（单测、SSR）时的回落值，取浅色主题色板 */
  fallback: string
}

const workflowRunVisualSources: Record<WorkflowRunVisualClass, WorkflowRunVisualSource> = {
  running: { token: '--color-primary', fallback: '#1f4fd1' },
  success: { token: '--color-success', fallback: '#1e7a4f' },
  failed: { token: '--color-danger', fallback: '#c2352e' },
  waiting: { token: '--color-warning', fallback: '#a8670a' },
  cancelled: { token: '--color-text-tertiary', fallback: '#5f6e7e' },
}

/** 描边比填充略深，节点在浅底和深底上都有清晰边界 */
const STROKE_DARKEN = 'color-mix(in srgb, {fill} 78%, #000)'
/** 状态色上的文字：浅色主题为白字，深色主题状态色更亮，改用深色字保证对比度 */
const NODE_TEXT_SOURCE: WorkflowRunVisualSource = {
  token: '--color-on-status',
  fallback: '#ffffff',
}

export const workflowRunVisualClasses = Object.keys(
  workflowRunVisualSources,
) as WorkflowRunVisualClass[]

export const workflowRunVisualCssVars = Object.fromEntries(
  workflowRunVisualClasses.flatMap((klass) => {
    const fill = `var(${workflowRunVisualSources[klass].token})`
    return [
      [`--workflow-run-${klass}-fill`, fill],
      [`--workflow-run-${klass}-stroke`, STROKE_DARKEN.replace('{fill}', fill)],
      [`--workflow-run-${klass}-text`, `var(${NODE_TEXT_SOURCE.token})`],
    ]
  }),
) as Record<string, string>

function resolveTokenColor(source: WorkflowRunVisualSource): string {
  if (typeof document === 'undefined') return source.fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(source.token).trim()
  return value || source.fallback
}

export function workflowRunStatusClass(status?: string | null): WorkflowRunVisualClass | null {
  if (!status) return null
  const s = status.toUpperCase()
  if (s === 'RUNNING' || s === 'RETRYING') return 'running'
  if (s === 'SUCCESS' || s === 'COMPLETED' || s === 'SUCCEEDED') return 'success'
  if (s === 'FAILED' || s === 'PARTIAL_FAILED') return 'failed'
  if (
    s === 'WAITING' ||
    s === 'READY' ||
    s === 'CREATED' ||
    s === 'WAITING_DEPENDENCY' ||
    s === 'PENDING' ||
    s === 'PAUSED'
  )
    return 'waiting'
  if (s === 'NOT_EXECUTED' || s === 'CANCELLED' || s === 'SKIPPED' || s === 'TERMINATED')
    return 'cancelled'
  return null
}

export function workflowRunMermaidClassDefs(): string {
  return workflowRunVisualClasses
    .map((klass) => {
      const fill = resolveTokenColor(workflowRunVisualSources[klass])
      // Mermaid 的 classDef 不支持 color-mix，描边与填充同色，靠文字色与圆角区分层次
      return `  classDef ${klass} fill:${fill},stroke:${fill},color:${resolveTokenColor(NODE_TEXT_SOURCE)}`
    })
    .join('\n')
}
