/**
 * 内置模板完整性 — 4 个模板各 1 case,确认 nodes/edges 结构合法。
 *
 * 覆盖点:
 * - linear3:5 节点 / 4 边,START 唯一,END 唯一
 * - fanOut:GATEWAY 出度 ≥ 3,每个 branch 自带 END
 * - fanIn:两路 JOB 合并到同一 END(共享 target)
 * - approval:含 APPROVAL 节点 + 4 边线性串
 */
import { describe, it, expect } from 'vitest'
import { BUILTIN_TEMPLATES, findTemplate } from './templates'

describe('templates / BUILTIN_TEMPLATES', () => {
  it('linear3 has 5 nodes & 4 edges with single START/END', () => {
    const tpl = findTemplate('linear3')
    expect(tpl).toBeDefined()
    expect(tpl!.definition.nodes).toHaveLength(5)
    expect(tpl!.definition.edges).toHaveLength(4)
    const starts = tpl!.definition.nodes.filter((n) => n.nodeType === 'START')
    const ends = tpl!.definition.nodes.filter((n) => n.nodeType === 'END')
    expect(starts).toHaveLength(1)
    expect(ends).toHaveLength(1)
  })

  it('fanOut has GATEWAY with out-degree 3 and 3 distinct END nodes', () => {
    const tpl = findTemplate('fanOut')
    expect(tpl).toBeDefined()
    const gatewayCode = tpl!.definition.nodes.find((n) => n.nodeType === 'GATEWAY')?.nodeCode
    expect(gatewayCode).toBeTruthy()
    const outFromGateway = tpl!.definition.edges.filter(
      (e) => e.sourceNodeCode === gatewayCode,
    )
    expect(outFromGateway).toHaveLength(3)
    const ends = tpl!.definition.nodes.filter((n) => n.nodeType === 'END')
    expect(ends).toHaveLength(3)
  })

  it('fanIn merges two JOBs into a shared END', () => {
    const tpl = findTemplate('fanIn')
    expect(tpl).toBeDefined()
    const endCode = tpl!.definition.nodes.find((n) => n.nodeType === 'END')?.nodeCode
    const incomingToEnd = tpl!.definition.edges.filter((e) => e.targetNodeCode === endCode)
    expect(incomingToEnd).toHaveLength(2)
    // 两路 JOB 源不同
    const sources = new Set(incomingToEnd.map((e) => e.sourceNodeCode))
    expect(sources.size).toBe(2)
  })

  it('approval template contains an APPROVAL node in the middle', () => {
    const tpl = findTemplate('approval')
    expect(tpl).toBeDefined()
    const approvals = tpl!.definition.nodes.filter((n) => n.nodeType === 'APPROVAL')
    expect(approvals).toHaveLength(1)
    // APPROVAL 入度 = 1,出度 = 1(非首非尾)
    const code = approvals[0].nodeCode
    const incoming = tpl!.definition.edges.filter((e) => e.targetNodeCode === code)
    const outgoing = tpl!.definition.edges.filter((e) => e.sourceNodeCode === code)
    expect(incoming).toHaveLength(1)
    expect(outgoing).toHaveLength(1)
  })
})

describe('templates / BUILTIN_TEMPLATES list', () => {
  it('exposes exactly 4 builtin templates with unique keys', () => {
    expect(BUILTIN_TEMPLATES).toHaveLength(4)
    const keys = new Set(BUILTIN_TEMPLATES.map((t) => t.key))
    expect(keys.size).toBe(4)
  })
})
