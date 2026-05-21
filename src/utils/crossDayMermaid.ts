/**
 * ADR-018 跨日依赖 Mermaid 渲染辅助。
 *
 * 后端 `workflow_node.cross_day_dependencies` 是 JSONB 数组,每元素 {@link CrossDayDependencySpec}:
 *   { alias, jobCode, bizDateOffset, bizDateRange, scope, consumeVersionStrategy, specificVersionNo }
 *
 * 渲染策略:
 *   - 为每个跨日依赖生成一个虚拟「幽灵节点」,代表「上一/N 个业务日的某 job」
 *   - 节点 ID 用 sanitize 后的 alias 或 jobCode + offset 拼接,稳定唯一
 *   - 用 dashed 箭头 `-.->|cross-day(T-N)|` 指向真实节点,与同日依赖区分
 *   - 应用 classDef `crossDay` 给幽灵节点统一着色(暖橙,易识别)
 *
 * 单测覆盖 `crossDayMermaid.test.ts`。
 */
export interface CrossDayDependencySpec {
  alias?: string
  jobCode?: string
  bizDateOffset?: number
  bizDateRange?: string
  scope?: string
  consumeVersionStrategy?: string
  specificVersionNo?: number
}

export interface WorkflowNodeLike {
  nodeCode: string
  crossDayDependencies?: string | null
  crossDayDependencyTimeoutSeconds?: number | null
}

/**
 * 给 Mermaid 文本追加跨日依赖的幽灵节点 + 虚线边 + 颜色 classDef。
 * 输入:base mermaid(由 BE 生成同日 DAG)+ workflow.nodes
 * 输出:扩展后的 mermaid 文本;若无任何跨日依赖,返回原文本不变。
 */
export function injectCrossDayEdges(baseMermaid: string, nodes: WorkflowNodeLike[]): string {
  if (!baseMermaid || !baseMermaid.trim()) return baseMermaid
  const extras: string[] = []
  const ghostIds = new Set<string>()
  for (const n of nodes ?? []) {
    if (!n.crossDayDependencies) continue
    let specs: CrossDayDependencySpec[] = []
    try {
      const parsed = JSON.parse(n.crossDayDependencies) as unknown
      if (Array.isArray(parsed)) specs = parsed as CrossDayDependencySpec[]
    } catch {
      continue // 解析失败的节点跳过,不破坏整图
    }
    for (const s of specs) {
      const ghostId = sanitizeGhostId(s)
      const label = ghostLabel(s)
      const edgeLabel = edgeAnnotation(s)
      if (!ghostIds.has(ghostId)) {
        extras.push(`  ${ghostId}["${label}"]:::crossDay`)
        ghostIds.add(ghostId)
      }
      const target = sanitizeNodeId(n.nodeCode)
      extras.push(`  ${ghostId} -. "${edgeLabel}" .-> ${target}`)
    }
  }
  if (extras.length === 0) return baseMermaid
  // classDef 用暖橙 + 虚线 stroke(走 design token 走不进 mermaid 主题,只能用字面色)
  const classDef =
    '  classDef crossDay fill:#fef3c7,stroke:#f59e0b,stroke-dasharray:5 5,color:#78350f;'
  return baseMermaid.trimEnd() + '\n' + extras.join('\n') + '\n' + classDef + '\n'
}

/** mermaid 节点 ID 必须是 `[A-Za-z0-9_]+`;与 BE 的 sanitize 规则一致,nodeCode 中非合法字符替 `_`。 */
function sanitizeNodeId(nodeCode: string): string {
  return nodeCode.replace(/[^A-Za-z0-9_]/g, '_')
}

function sanitizeGhostId(s: CrossDayDependencySpec): string {
  const base = s.alias || s.jobCode || 'unknown'
  const offset =
    s.bizDateOffset != null
      ? `T_minus_${Math.abs(s.bizDateOffset)}`
      : s.bizDateRange
        ? s.bizDateRange.replace(/[^A-Za-z0-9_]/g, '_')
        : 'unknown_date'
  return 'ghost_' + sanitizeNodeId(base) + '_' + sanitizeNodeId(offset)
}

function ghostLabel(s: CrossDayDependencySpec): string {
  const job = s.alias || s.jobCode || 'unknown'
  const date = formatBizDateHint(s)
  return `${job}<br/>${date}`
}

function edgeAnnotation(s: CrossDayDependencySpec): string {
  const scope = (s.scope || 'REQUIRED').toLowerCase()
  const strat = (s.consumeVersionStrategy || 'EFFECTIVE_ONLY').toLowerCase()
  return `cross-day · ${scope} · ${strat}`
}

function formatBizDateHint(s: CrossDayDependencySpec): string {
  if (s.bizDateOffset != null) return `T${s.bizDateOffset >= 0 ? '+' : ''}${s.bizDateOffset} day`
  if (s.bizDateRange) return s.bizDateRange
  return '?'
}

/** 给定一个 node,提取其 cross-day deps 的人类可读摘要(节点 hover tooltip 用)。 */
export function describeCrossDayDeps(node: WorkflowNodeLike): {
  count: number
  timeoutSeconds: number | null
  lines: string[]
} {
  const lines: string[] = []
  let count = 0
  if (node.crossDayDependencies) {
    try {
      const arr = JSON.parse(node.crossDayDependencies) as CrossDayDependencySpec[]
      if (Array.isArray(arr)) {
        count = arr.length
        for (const s of arr) {
          const job = s.alias || s.jobCode || '?'
          lines.push(`${job} @ ${formatBizDateHint(s)}(${(s.scope || 'REQUIRED').toLowerCase()})`)
        }
      }
    } catch {
      // ignore
    }
  }
  return {
    count,
    timeoutSeconds: node.crossDayDependencyTimeoutSeconds ?? null,
    lines,
  }
}
