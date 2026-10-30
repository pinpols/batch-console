import { describe, it, expect } from 'vitest'
import { validateDag } from './dagValidators'
import type { DesignerSnapshot } from '../types'

function snap(
  nodes: Array<{ id: string; type: string; attrs?: Record<string, unknown> }>,
  edges: Array<
    [string, string] | [string, string, { edgeType?: string; label?: string; enabled?: boolean }]
  >,
): DesignerSnapshot {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      nodeCode: n.id,
      nodeName: n.id,
      nodeType: n.type as never,
      x: 0,
      y: 0,
      attrs: n.attrs ?? {},
    })),
    edges: edges.map(([s, t, config], i) => ({
      id: `e${i}`,
      source: s,
      target: t,
      label: config?.label,
      attrs: config ? { edgeType: config.edgeType, enabled: config.enabled } : undefined,
    })),
  }
}

describe('validateDag', () => {
  it('R1 缺少 START → missingStart', () => {
    const errs = validateDag(snap([{ id: 'e', type: 'END' }], []))
    expect(errs.some((e) => e.messageKey.endsWith('.missingStart'))).toBe(true)
  })

  it('R1 多个 START → multipleStart + 标红', () => {
    const errs = validateDag(
      snap(
        [
          { id: 's1', type: 'START' },
          { id: 's2', type: 'START' },
          { id: 'e', type: 'END' },
        ],
        [
          ['s1', 'e'],
          ['s2', 'e'],
        ],
      ),
    )
    expect(errs.some((e) => e.messageKey.endsWith('.multipleStart'))).toBe(true)
    expect(errs.filter((e) => e.messageKey.endsWith('.extraStart'))).toHaveLength(2)
  })

  it('R2 缺少 END', () => {
    const errs = validateDag(snap([{ id: 's', type: 'START' }], []))
    expect(errs.some((e) => e.messageKey.endsWith('.missingEnd'))).toBe(true)
  })

  it('R3 孤立节点 → unreachable', () => {
    const errs = validateDag(
      snap(
        [
          { id: 's', type: 'START' },
          { id: 'e', type: 'END' },
          { id: 'orphan', type: 'JOB', attrs: { jobCode: 'X' } },
        ],
        [['s', 'e']],
      ),
    )
    expect(
      errs.find((er) => er.nodeId === 'orphan' && er.messageKey.endsWith('.unreachable')),
    ).toBeTruthy()
  })

  it('R4 检测到环 → cycle + 标红参与节点', () => {
    const errs = validateDag(
      snap(
        [
          { id: 's', type: 'START' },
          { id: 'a', type: 'JOB', attrs: { jobCode: 'A' } },
          { id: 'b', type: 'JOB', attrs: { jobCode: 'B' } },
          { id: 'e', type: 'END' },
        ],
        [
          ['s', 'a'],
          ['a', 'b'],
          ['b', 'a'], // cycle
          ['a', 'e'],
        ],
      ),
    )
    expect(errs.some((e) => e.messageKey.endsWith('.cycle'))).toBe(true)
    const flagged = errs.filter((e) => e.messageKey.endsWith('.cycleNode')).map((e) => e.nodeId)
    expect(flagged).toContain('a')
    expect(flagged).toContain('b')
  })

  it('R5 汇聚 GATEWAY 单出边合法', () => {
    const errs = validateDag(
      snap(
        [
          { id: 's', type: 'START' },
          { id: 'a', type: 'JOB', attrs: { jobCode: 'A' } },
          { id: 'b', type: 'JOB', attrs: { jobCode: 'B' } },
          { id: 'g', type: 'GATEWAY', attrs: { joinMode: 'ALL' } },
          { id: 'e', type: 'END' },
        ],
        [
          ['s', 'a'],
          ['s', 'b'],
          ['a', 'g'],
          ['b', 'g'],
          ['g', 'e'],
        ],
      ),
    )
    expect(errs).toEqual([])
  })

  it('R6 JOB 缺 jobCode', () => {
    const errs = validateDag(
      snap(
        [
          { id: 's', type: 'START' },
          { id: 'j', type: 'JOB' },
          { id: 'e', type: 'END' },
        ],
        [
          ['s', 'j'],
          ['j', 'e'],
        ],
      ),
    )
    expect(
      errs.find(
        (e) =>
          e.nodeId === 'j' && e.field === 'jobCode' && e.messageKey.endsWith('.jobCodeRequired'),
      ),
    ).toBeTruthy()
  })

  it('R8 汇聚 GATEWAY joinMode 必填(空 / 非法值)', () => {
    const errs = validateDag(
      snap(
        [
          { id: 's', type: 'START' },
          { id: 'a', type: 'JOB', attrs: { jobCode: 'A' } },
          { id: 'b', type: 'JOB', attrs: { jobCode: 'B' } },
          { id: 'g', type: 'GATEWAY', attrs: { joinMode: 'BOGUS' } },
          { id: 'e', type: 'END' },
        ],
        [
          ['s', 'a'],
          ['s', 'b'],
          ['a', 'g'],
          ['b', 'g'],
          ['g', 'e'],
        ],
      ),
    )
    expect(
      errs.find(
        (e) =>
          e.nodeId === 'g' && e.field === 'joinMode' && e.messageKey.endsWith('.joinModeRequired'),
      ),
    ).toBeTruthy()
  })

  it('单入边分支允许不配置汇聚模式，但拒绝显式未知模式', () => {
    const graph = (joinMode?: string) =>
      snap(
        [
          { id: 's', type: 'START' },
          { id: 'g', type: 'GATEWAY', attrs: joinMode ? { joinMode } : {} },
          { id: 'a', type: 'JOB', attrs: { jobCode: 'A' } },
          { id: 'b', type: 'JOB', attrs: { jobCode: 'B' } },
          { id: 'e', type: 'END' },
        ],
        [
          ['s', 'g'],
          ['g', 'a'],
          ['g', 'b'],
          ['a', 'e'],
          ['b', 'e'],
        ],
      )
    expect(validateDag(graph()).some((e) => e.nodeId === 'g' && e.field === 'joinMode')).toBe(false)
    expect(validateDag(graph('BAD')).some((e) => e.nodeId === 'g' && e.field === 'joinMode')).toBe(
      true,
    )
  })

  it('普通作业节点的显式非法汇聚配置被拒绝，缺省配置可用', () => {
    const graph = (attrs: Record<string, unknown>) =>
      snap(
        [
          { id: 's', type: 'START' },
          { id: 'a', type: 'JOB', attrs: { jobCode: 'A' } },
          { id: 'b', type: 'JOB', attrs: { jobCode: 'B' } },
          { id: 'j', type: 'JOB', attrs: { jobCode: 'J', ...attrs } },
          { id: 'e', type: 'END' },
        ],
        [
          ['s', 'a'],
          ['s', 'b'],
          ['a', 'j'],
          ['b', 'j'],
          ['j', 'e'],
        ],
      )
    expect(validateDag(graph({})).some((e) => e.nodeId === 'j' && e.field === 'joinMode')).toBe(
      false,
    )
    expect(
      validateDag(graph({ joinMode: 'BAD' })).some(
        (e) => e.nodeId === 'j' && e.field === 'joinMode',
      ),
    ).toBe(true)
    expect(
      validateDag(graph({ joinMode: 'N_OF', joinThreshold: 3 })).some(
        (e) => e.nodeId === 'j' && e.field === 'joinThreshold',
      ),
    ).toBe(true)
  })

  it('阈值文本格式与后端一致：普通节点仅接受整数文本，网关要求数值', () => {
    const graph = (type: 'JOB' | 'GATEWAY', threshold: unknown) =>
      snap(
        [
          { id: 's', type: 'START' },
          { id: 'a', type: 'JOB', attrs: { jobCode: 'A' } },
          { id: 'b', type: 'JOB', attrs: { jobCode: 'B' } },
          { id: 'j', type, attrs: { jobCode: 'J', joinMode: 'N_OF', joinThreshold: threshold } },
          { id: 'e', type: 'END' },
        ],
        [
          ['s', 'a'],
          ['s', 'b'],
          ['a', 'j'],
          ['b', 'j'],
          ['j', 'e'],
        ],
      )
    const invalid = (type: 'JOB' | 'GATEWAY', threshold: unknown) =>
      validateDag(graph(type, threshold)).some(
        (e) => e.nodeId === 'j' && e.field === 'joinThreshold',
      )
    expect(invalid('JOB', '1')).toBe(false)
    expect(invalid('JOB', ' 1 ')).toBe(true)
    expect(invalid('JOB', '1.0')).toBe(true)
    expect(invalid('GATEWAY', '1')).toBe(true)
    expect(invalid('GATEWAY', 1)).toBe(false)
  })

  it('R8 N_OF 阈值必须在 1 到入度之间', () => {
    const errs = validateDag(
      snap(
        [
          { id: 's', type: 'START' },
          { id: 'a', type: 'JOB', attrs: { jobCode: 'A' } },
          { id: 'b', type: 'JOB', attrs: { jobCode: 'B' } },
          { id: 'g', type: 'GATEWAY', attrs: { joinMode: 'N_OF', joinThreshold: 3 } },
          { id: 'e', type: 'END' },
        ],
        [
          ['s', 'a'],
          ['s', 'b'],
          ['a', 'g'],
          ['b', 'g'],
          ['g', 'e'],
        ],
      ),
    )
    expect(errs).toContainEqual({
      nodeId: 'g',
      field: 'joinThreshold',
      messageKey: 'workflowDesignerMvp.validation.joinThresholdRange',
      args: { count: 2 },
    })
  })

  it('R9 START 有入边 → startInDegree', () => {
    const errs = validateDag(
      snap(
        [
          { id: 's', type: 'START' },
          { id: 'j', type: 'JOB', attrs: { jobCode: 'X' } },
          { id: 'e', type: 'END' },
        ],
        [
          ['s', 'j'],
          ['j', 's'], // 入边打到 START
          ['j', 'e'],
        ],
      ),
    )
    expect(errs.some((e) => e.nodeId === 's' && e.messageKey.endsWith('.startInDegree'))).toBe(true)
  })

  it('R10 END 有出边 → endOutDegree', () => {
    const errs = validateDag(
      snap(
        [
          { id: 's', type: 'START' },
          { id: 'e', type: 'END' },
          { id: 'j', type: 'JOB', attrs: { jobCode: 'X' } },
        ],
        [
          ['s', 'e'],
          ['e', 'j'], // END 出边
          ['j', 'e'],
        ],
      ),
    )
    expect(errs.some((er) => er.nodeId === 'e' && er.messageKey.endsWith('.endOutDegree'))).toBe(
      true,
    )
  })

  it('R11 非 END 节点缺出边 → noOutEdge', () => {
    const errs = validateDag(
      snap(
        [
          { id: 's', type: 'START' },
          { id: 'j', type: 'JOB', attrs: { jobCode: 'X' } },
          { id: 'e', type: 'END' },
        ],
        // j 没有出边
        [['s', 'j']],
      ),
    )
    expect(errs.some((e) => e.nodeId === 'j' && e.messageKey.endsWith('.noOutEdge'))).toBe(true)
  })

  it('R11 START 缺出边 → noOutEdge', () => {
    const errs = validateDag(
      snap(
        [
          { id: 's', type: 'START' },
          { id: 'e', type: 'END' },
        ],
        [],
      ),
    )
    expect(errs.some((e) => e.nodeId === 's' && e.messageKey.endsWith('.noOutEdge'))).toBe(true)
  })

  it('R12 悬空连线(target 不存在)→ danglingEdge', () => {
    const errs = validateDag(
      snap(
        [
          { id: 's', type: 'START' },
          { id: 'e', type: 'END' },
        ],
        [
          ['s', 'e'],
          ['s', 'ghost'], // ghost 不存在
        ],
      ),
    )
    expect(errs.some((e) => e.messageKey.endsWith('.danglingEdge'))).toBe(true)
  })

  it('R14 CONDITION 边缺少表达式时定位到该连线', () => {
    const errs = validateDag(
      snap(
        [
          { id: 's', type: 'START' },
          { id: 'e', type: 'END' },
        ],
        [['s', 'e', { edgeType: 'CONDITION', label: '   ' }]],
      ),
    )
    expect(errs).toContainEqual({
      edgeId: 'e0',
      field: 'conditionExpr',
      messageKey: 'workflowDesignerMvp.validation.conditionExprRequired',
      args: { source: 's', target: 'e' },
    })
  })

  it('R14 CONDITION 边配置表达式后通过校验', () => {
    const errs = validateDag(
      snap(
        [
          { id: 's', type: 'START' },
          { id: 'e', type: 'END' },
        ],
        [['s', 'e', { edgeType: 'CONDITION', label: 'amount > 1000' }]],
      ),
    )
    expect(errs).toEqual([])
  })

  it('R15 CONDITION 边拒绝模板表达式包裹并定位到连线', () => {
    const errs = validateDag(
      snap(
        [
          { id: 's', type: 'START' },
          { id: 'e', type: 'END' },
        ],
        [['s', 'e', { edgeType: 'CONDITION', label: '${bizDate != null}' }]],
      ),
    )
    expect(errs).toContainEqual({
      edgeId: 'e0',
      field: 'conditionExpr',
      messageKey: 'workflowDesignerMvp.validation.conditionExprTemplateWrapper',
    })
  })

  it('合法线性 DAG → 无错误', () => {
    const errs = validateDag(
      snap(
        [
          { id: 's', type: 'START' },
          { id: 'j', type: 'JOB', attrs: { jobCode: 'X' } },
          { id: 'e', type: 'END' },
        ],
        [
          ['s', 'j'],
          ['j', 'e'],
        ],
      ),
    )
    expect(errs).toEqual([])
  })
})
