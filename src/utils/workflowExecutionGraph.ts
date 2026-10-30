import type { DeepReadonly } from 'vue'
import type { components } from '@/types/api.generated'
import {
  workflowRunMermaidClassDefs,
  workflowRunStatusClass,
} from '@/constants/workflowStatusTheme'
type Node = components['schemas']['WorkflowExecutionNodeProgress']
type Edge = components['schemas']['WorkflowExecutionEdge']
const terminal = new Set([
  'SUCCESS',
  'FAILED',
  'SKIPPED',
  'CANCELLED',
  'TERMINATED',
  'NOT_EXECUTED',
])

/** Job节点可先创建实例再等待子作业；只在显示层合成真实的关联作业状态。 */
export function executionNodeDisplayStatus(node: DeepReadonly<Node>) {
  if (node.nodeStatus === 'READY' && ['RUNNING', 'PAUSED'].includes(node.jobInstanceStatus ?? '')) {
    return node.jobInstanceStatus ?? node.nodeStatus
  }
  return node.nodeStatus
}

/** 保留并行执行、等待及失败位置，不将根运行的结束游标当作当前执行节点。 */
export function executionFocusNodeCodes(nodes: readonly DeepReadonly<Node>[]) {
  return nodes
    .filter((node) =>
      [
        'READY',
        'RUNNING',
        'WAITING',
        'WAITING_DEPENDENCY',
        'RETRYING',
        'PAUSED',
        'FAILED',
      ].includes(executionNodeDisplayStatus(node)),
    )
    .map((node) => node.nodeCode)
}

export function executionTotals(nodes: readonly DeepReadonly<Node>[]) {
  const total = nodes.length
  const statuses = nodes.map(executionNodeDisplayStatus)
  const ended = statuses.filter((status) => terminal.has(status)).length
  return {
    total,
    terminal: ended,
    notExecuted: statuses.filter((status) => status === 'NOT_EXECUTED').length,
    succeeded: statuses.filter((status) => status === 'SUCCESS').length,
    active: statuses.filter((status) =>
      ['RUNNING', 'WAITING', 'WAITING_DEPENDENCY', 'RETRYING', 'PAUSED'].includes(status),
    ).length,
    percentage: total ? Math.round((ended * 100) / total) : 0,
  }
}

/** 节点标识使用位置索引，业务编码仅作转义文本，避免符号替换后的ID碰撞。 */
export function executionGraph(
  nodes: readonly DeepReadonly<Node>[],
  edges: readonly Readonly<Edge>[],
  label: (node: DeepReadonly<Node>) => string,
  edgeLabel: (edge: Readonly<Edge>) => string = (edge) => edge.edgeType ?? '',
) {
  const ids = new Map(nodes.map((n, i) => [n.nodeCode, `n${i}`]))
  const escape = (value: string) =>
    value.replace(/[&<>"\[\]{}\\\r\n]/g, (c) => `#${c.charCodeAt(0)};`)
  const lines = ['flowchart LR', workflowRunMermaidClassDefs()]
  nodes.forEach((n, i) => {
    lines.push(`n${i}["${escape(label(n))}"]`)
    const state = workflowRunStatusClass(executionNodeDisplayStatus(n))
    if (state) lines.push(`class n${i} ${state}`)
  })
  edges.forEach((edge) => {
    const from = ids.get(edge.fromNodeCode)
    const to = ids.get(edge.toNodeCode)
    if (from && to) {
      const caption = edgeLabel(edge)
      lines.push(caption ? `${from} -->|"${escape(caption)}"| ${to}` : `${from} --> ${to}`)
    }
  })
  return lines.join('\n')
}
