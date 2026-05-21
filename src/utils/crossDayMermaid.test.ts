import { describe, expect, it } from 'vitest'
import { injectCrossDayEdges, describeCrossDayDeps } from './crossDayMermaid'

describe('injectCrossDayEdges', () => {
  const baseMermaid = `graph TD\n  A --> B\n`

  it('无跨日依赖时不变', () => {
    const out = injectCrossDayEdges(baseMermaid, [
      { nodeCode: 'B', crossDayDependencies: null },
      { nodeCode: 'A' },
    ])
    expect(out).toBe(baseMermaid)
  })

  it('解析失败的 JSON 跳过该 node,不破坏整图', () => {
    const out = injectCrossDayEdges(baseMermaid, [
      { nodeCode: 'B', crossDayDependencies: '{invalid json' },
    ])
    expect(out).toBe(baseMermaid)
  })

  it('为单个跨日依赖注入幽灵节点 + 虚线边 + classDef', () => {
    const dep = JSON.stringify([{ jobCode: 'foo', bizDateOffset: -1, scope: 'REQUIRED' }])
    const out = injectCrossDayEdges(baseMermaid, [{ nodeCode: 'B', crossDayDependencies: dep }])
    expect(out).toContain('ghost_foo_T_minus_1["foo<br/>T-1 day"]:::crossDay')
    expect(out).toContain('ghost_foo_T_minus_1 -. "cross-day · required · effective_only" .-> B')
    expect(out).toContain('classDef crossDay')
  })

  it('多个跨日依赖去重幽灵节点(相同 alias+offset 只出一次)', () => {
    const dep = JSON.stringify([
      { alias: 'a', jobCode: 'foo', bizDateOffset: -1 },
      { alias: 'a', jobCode: 'foo', bizDateOffset: -1 }, // 重复
      { jobCode: 'bar', bizDateOffset: -7 },
    ])
    const out = injectCrossDayEdges(baseMermaid, [{ nodeCode: 'B', crossDayDependencies: dep }])
    // a 出一次,bar 出一次
    const ghostCount = (out.match(/ghost_/g) || []).length
    // 定义去重(a×1 + bar×1 = 2 定义),但边按 dep entry 全保留(a×2 + bar×1 = 3 边),
    // 边的 source 引用 ghost id,所以总共 5 处「ghost_」出现:2 定义 + 3 边 source。
    expect(ghostCount).toBe(5)
    // 但「定义行」只有 2 个(确认幽灵节点真的 dedup 了)
    const defLines = (out.match(/\]:::crossDay/g) || []).length
    expect(defLines).toBe(2)
  })

  it('bizDateRange 模式正确生成 ghost id', () => {
    const dep = JSON.stringify([{ jobCode: 'agg', bizDateRange: 'PREV_5_BIZ_DAYS' }])
    const out = injectCrossDayEdges(baseMermaid, [{ nodeCode: 'C', crossDayDependencies: dep }])
    expect(out).toContain('ghost_agg_PREV_5_BIZ_DAYS')
    expect(out).toContain('agg<br/>PREV_5_BIZ_DAYS')
  })

  it('OPTIONAL scope 在 edge label 体现', () => {
    const dep = JSON.stringify([{ jobCode: 'x', bizDateOffset: -1, scope: 'OPTIONAL' }])
    const out = injectCrossDayEdges(baseMermaid, [{ nodeCode: 'B', crossDayDependencies: dep }])
    expect(out).toContain('cross-day · optional')
  })

  it('节点 ID 含非法字符时自动 sanitize', () => {
    const dep = JSON.stringify([{ jobCode: 'foo', bizDateOffset: -1 }])
    const out = injectCrossDayEdges(baseMermaid, [
      { nodeCode: 'node-with-dash', crossDayDependencies: dep },
    ])
    expect(out).toContain('-> node_with_dash')
  })
})

describe('describeCrossDayDeps', () => {
  it('空依赖 → count=0', () => {
    expect(describeCrossDayDeps({ nodeCode: 'A' })).toEqual({
      count: 0,
      timeoutSeconds: null,
      lines: [],
    })
  })

  it('包含 timeout 时透传', () => {
    const dep = JSON.stringify([{ jobCode: 'x', bizDateOffset: -1 }])
    const r = describeCrossDayDeps({
      nodeCode: 'A',
      crossDayDependencies: dep,
      crossDayDependencyTimeoutSeconds: 3600,
    })
    expect(r.count).toBe(1)
    expect(r.timeoutSeconds).toBe(3600)
    expect(r.lines).toHaveLength(1)
    expect(r.lines[0]).toContain('x')
    expect(r.lines[0]).toContain('T-1 day')
  })
})
