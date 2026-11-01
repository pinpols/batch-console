import type { WaitRelationship } from '@/api/dependencyWaits'

/** 仅为明细提取可识别的依赖，不回显异常快照原文。 */
export function relationshipDependencies(
  type: WaitRelationship['waitType'],
  snapshot: string | null | undefined,
): { codes: string[]; unknown: boolean } {
  if (type === 'CAPACITY_ADMISSION') return { codes: [], unknown: false }
  if (!snapshot?.trim()) return { codes: [], unknown: false }
  if (type === 'READINESS')
    return {
      codes: snapshot
        .split(',')
        .map((code) => code.trim())
        .filter(Boolean),
      unknown: false,
    }
  try {
    const parsed: unknown = JSON.parse(snapshot)
    if (!Array.isArray(parsed)) return { codes: [], unknown: true }
    const codes: string[] = []
    let unknown = false
    for (const item of parsed) {
      if (typeof item === 'string') {
        codes.push(item)
        continue
      }
      if (!item || typeof item !== 'object') {
        unknown = true
        continue
      }
      const record = item as Record<string, unknown>
      const code = type === 'CALENDAR' ? record.upstreamCode : record.upstreamJobCode
      if (typeof code !== 'string' || !code) {
        unknown = true
        continue
      }
      const date = record.upstreamBizDate
      codes.push(typeof date === 'string' && date ? `${code} (${date})` : code)
    }
    return { codes, unknown }
  } catch {
    return { codes: [], unknown: true }
  }
}

export interface WaitTopologyNode {
  key: string
  kind: WaitRelationship['waitType']
  code: string
  date: string
  waitCount: number
  statuses: string[]
  missingStatus: boolean
}

export interface WaitTopology {
  nodes: WaitTopologyNode[]
  edges: { from: string; to: string }[]
  unresolved: number
  tooLarge: boolean
}

const MAX_TOPOLOGY_NODES = 150
const MAX_TOPOLOGY_EDGES = 300

/** 只合并可确认的同租户、对象类型、编码和业务日期，Workflow 等待按记录区分。 */
export function buildWaitTopology(items: readonly WaitRelationship[]): WaitTopology {
  const nodes = new Map<string, WaitTopologyNode>()
  const edges = new Map<string, { from: string; to: string }>()
  let unresolved = 0
  const entityKey = (tenant: string, kind: string, code: string, date: string) =>
    JSON.stringify([tenant, kind, code, date])
  const isDate = (value: unknown): value is string => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const date = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
  }
  const exceedsLimit = () => nodes.size > MAX_TOPOLOGY_NODES || edges.size > MAX_TOPOLOGY_EDGES
  function addNode(key: string, kind: WaitRelationship['waitType'], code: string, date: string) {
    if (!nodes.has(key))
      nodes.set(key, { key, kind, code, date, waitCount: 0, statuses: [], missingStatus: false })
    return key
  }
  function addEdge(from: string, to: string) {
    const key = JSON.stringify([from, to])
    if (!edges.has(key)) edges.set(key, { from, to })
  }

  outer: for (const item of items) {
    if (!item.tenantId || !item.subjectCode || !isDate(item.bizDate)) {
      unresolved++
      continue
    }
    const kind = item.waitType
    const subjectKey =
      kind === 'CALENDAR' || kind === 'JOB'
        ? entityKey(item.tenantId, kind, item.subjectCode, item.bizDate)
        : JSON.stringify([item.tenantId, kind, item.id])
    addNode(subjectKey, kind, item.subjectCode, item.bizDate)
    const subject = nodes.get(subjectKey)!
    subject.waitCount++
    if (typeof item.waitStatus === 'string' && item.waitStatus.trim()) {
      if (!subject.statuses.includes(item.waitStatus)) subject.statuses.push(item.waitStatus)
    } else {
      subject.missingStatus = true
    }
    if (exceedsLimit()) break
    if (kind === 'CAPACITY_ADMISSION') continue
    if (!item.dependencySnapshotValid || !item.dependencySnapshot) {
      unresolved++
      continue
    }
    if (kind === 'READINESS') {
      const dependencies = item.dependencySnapshot.split(',').map((code) => code.trim())
      if (!dependencies.length || dependencies.some((code) => !code)) {
        unresolved++
        continue
      }
      for (const code of dependencies) {
        const key = entityKey(item.tenantId, 'JOB', code, item.bizDate)
        addEdge(addNode(key, 'JOB', code, item.bizDate), subjectKey)
        if (exceedsLimit()) break outer
      }
      continue
    }
    try {
      const parsed: unknown = JSON.parse(item.dependencySnapshot)
      if (!Array.isArray(parsed) || !parsed.length) {
        unresolved++
        continue
      }
      let incomplete = false
      for (const dependency of parsed) {
        if (!dependency || typeof dependency !== 'object' || Array.isArray(dependency)) {
          incomplete = true
          continue
        }
        const value = dependency as Record<string, unknown>
        const code = kind === 'CALENDAR' ? value.upstreamCode : value.upstreamJobCode
        if (typeof code !== 'string' || !code) {
          incomplete = true
          continue
        }
        let upstreamDate: string
        if (kind === 'CALENDAR') {
          upstreamDate = item.bizDate
        } else if (
          value.bizDateAlignment === 'SAME_DAY' &&
          (value.upstreamBizDate == null || value.upstreamBizDate === item.bizDate)
        ) {
          upstreamDate = item.bizDate
        } else if (
          value.bizDateAlignment === 'PREVIOUS_BIZ_DAY' &&
          isDate(value.upstreamBizDate) &&
          value.upstreamBizDate < item.bizDate
        ) {
          upstreamDate = value.upstreamBizDate
        } else {
          // 未确定的上游业务日不能与任何确定日期的节点合并。
          incomplete = true
          continue
        }
        const key = entityKey(item.tenantId, kind, code, upstreamDate)
        addEdge(addNode(key, kind, code, upstreamDate), subjectKey)
        if (exceedsLimit()) break outer
      }
      if (incomplete) unresolved++
    } catch {
      unresolved++
    }
  }
  return {
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    unresolved,
    tooLarge: exceedsLimit(),
  }
}

/** 节点 ID 使用序号，业务文本使用与运行图相同的数字实体转义。 */
export function waitTopologyMermaid(
  topology: WaitTopology,
  label: (node: WaitTopologyNode) => string,
): string {
  const ids = new Map(topology.nodes.map((node, index) => [node.key, `n${index}`]))
  const escape = (value: string) =>
    value.replace(/[&#<>"\[\]{}\\\r\n]/g, (character) => `#${character.charCodeAt(0)};`)
  const lines = ['flowchart LR']
  topology.nodes.forEach((node, index) => lines.push(`n${index}["${escape(label(node))}"]`))
  topology.edges.forEach(({ from, to }) => lines.push(`${ids.get(from)} --> ${ids.get(to)}`))
  return lines.join('\n')
}
