/**
 * 客户端 DAG 校验器(MVP 阶段)。
 *
 * 规则:
 *  R1 必须恰好 1 个 START
 *  R2 必须 ≥ 1 个 END
 *  R3 无孤立节点(每个节点必须从 START 可达,DFS 正向)
 *  R4 无环(DFS 三色 GRAY 命中即环)
 *  R5 GATEWAY 出度 ≥ 2
 *  R6 JOB.attrs.jobCode 必填
 *  R7 FILE_STEP.attrs.pipelineCode 必填
 *  R8 GATEWAY.attrs.gatewayStrategy 必填(AND/OR/XOR)
 *  R9 START 入度 = 0(START 不应有入边)
 *  R10 END 出度 = 0(END 不应有出边)
 *  R11 非 END 节点出度 ≥ 1(除 END 外都要有出边,START 也要)
 *  R12 边引用异常:edge.source/target 指向不存在的节点 → 报错
 *  R13 APPROVAL.attrs.approvalTemplateCode 必填(与 JOB/FILE_STEP 对称)
 *
 * 返回 `ValidationError[]`,每条含 `{ nodeId, field, messageKey, args }`,
 * UI 层 t(messageKey, args) 渲染中/英文。
 *
 * 与 BE ADR-025 的关系:BE validators 是兜底权威(更严格);FE 仅做即时反馈以减少
 * 网络往返,允许略宽松(BE 拒绝则保存接口报错)。BE/FE 规则交叉见
 * docs/design/workflow-dag-designer.md §6。
 */

import type { DesignerSnapshot } from '../types'

export interface ValidationError {
  /** 命中节点 id;若是图级错误(如缺 START)留空 */
  nodeId?: string
  /** 命中字段(JOB 表单的 jobCode 等);图级错误留空 */
  field?: string
  /** i18n key,如 `workflowDesignerMvp.validation.missingStart` */
  messageKey: string
  /** vue-i18n 参数,如 { count: 2 } */
  args?: Record<string, unknown>
}

const NS = 'workflowDesignerMvp.validation.'

export function validateDag(snapshot: DesignerSnapshot): ValidationError[] {
  const errors: ValidationError[] = []
  const { nodes, edges } = snapshot

  // 索引
  const idToNode = new Map(nodes.map((n) => [n.id, n] as const))
  const outAdj = new Map<string, string[]>()
  const inDegree = new Map<string, number>()
  const outDegree = new Map<string, number>()
  for (const n of nodes) {
    outAdj.set(n.id, [])
    inDegree.set(n.id, 0)
    outDegree.set(n.id, 0)
  }
  for (const e of edges) {
    const srcExists = idToNode.has(e.source)
    const tgtExists = idToNode.has(e.target)
    // R12 边引用异常:source/target 指向不存在的节点 → 报错(不再静默过滤)
    if (!srcExists || !tgtExists) {
      errors.push({
        messageKey: NS + 'danglingEdge',
        args: { source: e.source, target: e.target },
      })
      continue
    }
    outAdj.get(e.source)!.push(e.target)
    outDegree.set(e.source, (outDegree.get(e.source) ?? 0) + 1)
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
  }

  // R1 / R2 起点终点计数
  const starts = nodes.filter((n) => n.nodeType === 'START')
  const ends = nodes.filter((n) => n.nodeType === 'END')
  if (starts.length === 0) {
    errors.push({ messageKey: NS + 'missingStart' })
  } else if (starts.length > 1) {
    errors.push({ messageKey: NS + 'multipleStart', args: { count: starts.length } })
    // 把多余的 START 都标红
    for (const s of starts) errors.push({ nodeId: s.id, messageKey: NS + 'extraStart' })
  }
  if (ends.length === 0) {
    errors.push({ messageKey: NS + 'missingEnd' })
  }

  // R3 孤立节点:仅当 START 唯一时做可达性
  if (starts.length === 1 && nodes.length > 1) {
    const root = starts[0]!.id
    const reachable = new Set<string>([root])
    const stack = [root]
    while (stack.length) {
      const cur = stack.pop()!
      for (const next of outAdj.get(cur) ?? []) {
        if (!reachable.has(next)) {
          reachable.add(next)
          stack.push(next)
        }
      }
    }
    for (const n of nodes) {
      if (!reachable.has(n.id)) {
        errors.push({ nodeId: n.id, messageKey: NS + 'unreachable' })
      }
    }
  }

  // R4 环检测(DFS 三色:WHITE=0 / GRAY=1 / BLACK=2)
  const color = new Map<string, number>()
  for (const n of nodes) color.set(n.id, 0)
  const cycleNodes = new Set<string>()
  function dfs(u: string): boolean {
    color.set(u, 1)
    for (const v of outAdj.get(u) ?? []) {
      const c = color.get(v) ?? 0
      if (c === 1) {
        cycleNodes.add(u)
        cycleNodes.add(v)
        return true
      }
      if (c === 0 && dfs(v)) {
        cycleNodes.add(u)
        return true
      }
    }
    color.set(u, 2)
    return false
  }
  let hasCycle = false
  for (const n of nodes) {
    if ((color.get(n.id) ?? 0) === 0) {
      if (dfs(n.id)) {
        hasCycle = true
      }
    }
  }
  if (hasCycle) {
    errors.push({ messageKey: NS + 'cycle' })
    for (const id of cycleNodes) {
      errors.push({ nodeId: id, messageKey: NS + 'cycleNode' })
    }
  }

  // R5/R6/R7/R8/R9/R10/R11/R13 节点字段与度数
  for (const n of nodes) {
    const attrs = (n.attrs ?? {}) as Record<string, unknown>
    const nIn = inDegree.get(n.id) ?? 0
    const nOut = outDegree.get(n.id) ?? 0
    // R9 START 入度 = 0
    if (n.nodeType === 'START' && nIn > 0) {
      errors.push({ nodeId: n.id, messageKey: NS + 'startInDegree', args: { count: nIn } })
    }
    // R10 END 出度 = 0
    if (n.nodeType === 'END' && nOut > 0) {
      errors.push({ nodeId: n.id, messageKey: NS + 'endOutDegree', args: { count: nOut } })
    }
    // R11 非 END 节点出度 ≥ 1(GATEWAY 的更严格出度由 R5 处理)
    if (n.nodeType !== 'END' && n.nodeType !== 'GATEWAY' && nOut < 1) {
      errors.push({ nodeId: n.id, messageKey: NS + 'noOutEdge' })
    }
    if (n.nodeType === 'GATEWAY') {
      const out = (outAdj.get(n.id) ?? []).length
      if (out < 2) {
        errors.push({ nodeId: n.id, messageKey: NS + 'gatewayOutDegree', args: { count: out } })
      }
      const strategy = String(attrs.gatewayStrategy ?? '').toUpperCase()
      if (!['AND', 'OR', 'XOR'].includes(strategy)) {
        errors.push({
          nodeId: n.id,
          field: 'gatewayStrategy',
          messageKey: NS + 'gatewayStrategyRequired',
        })
      }
    }
    if (n.nodeType === 'JOB') {
      if (!attrs.jobCode || String(attrs.jobCode).trim() === '') {
        errors.push({ nodeId: n.id, field: 'jobCode', messageKey: NS + 'jobCodeRequired' })
      }
    }
    if (n.nodeType === 'FILE_STEP') {
      if (!attrs.pipelineCode || String(attrs.pipelineCode).trim() === '') {
        errors.push({
          nodeId: n.id,
          field: 'pipelineCode',
          messageKey: NS + 'pipelineCodeRequired',
        })
      }
    }
    // R13 APPROVAL.approvalTemplateCode 必填
    if (n.nodeType === 'APPROVAL') {
      if (!attrs.approvalTemplateCode || String(attrs.approvalTemplateCode).trim() === '') {
        errors.push({
          nodeId: n.id,
          field: 'approvalTemplateCode',
          messageKey: NS + 'approvalTemplateCodeRequired',
        })
      }
    }
  }

  return errors
}
