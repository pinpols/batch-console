import { describe, it, expect } from 'vitest'
import { processedCountFromSummary } from './pipelineStepSummary'

describe('processedCountFromSummary', () => {
  it('LOAD 步骤取 loadedCount(即使 summary 同时含 parsed/validated 累计字段)', () => {
    const summary = JSON.stringify({ parsedCount: 100, validatedCount: 98, loadedCount: 95 })
    expect(processedCountFromSummary('LOAD', summary)).toBe(95)
  })

  it('PARSE 步骤取 parsedCount', () => {
    expect(processedCountFromSummary('PARSE', JSON.stringify({ parsedCount: 100 }))).toBe(100)
  })

  it('VALIDATE(import)取 validatedCount', () => {
    const summary = JSON.stringify({ parsedCount: 100, validatedCount: 98 })
    expect(processedCountFromSummary('VALIDATE', summary)).toBe(98)
  })

  it('GENERATE 取 recordCount', () => {
    expect(processedCountFromSummary('GENERATE', JSON.stringify({ recordCount: 5000 }))).toBe(5000)
  })

  it('process VALIDATE 无 validatedCount 时回退到 processedCount(stage 重名兜底)', () => {
    // process 的 summary 没有 validatedCount,只有 processedCount —— 不能错配,要回退到真实计数。
    const summary = JSON.stringify({ processedCount: 42, stagedCount: 40, publishedCount: 40 })
    expect(processedCountFromSummary('VALIDATE', summary)).toBe(42)
  })

  it('COMMIT 取 publishedCount', () => {
    const summary = JSON.stringify({ processedCount: 42, publishedCount: 40 })
    expect(processedCountFromSummary('COMMIT', summary)).toBe(40)
  })

  it('未映射 stage(如 PREPARE)且 summary 含计数 → 回退优先级列表', () => {
    expect(processedCountFromSummary('PREPARE', JSON.stringify({ recordCount: 7 }))).toBe(7)
  })

  it('已解析对象入参(非字符串)也支持', () => {
    expect(processedCountFromSummary('LOAD', { loadedCount: 12 })).toBe(12)
  })

  it('无 summary / 空 / 非法 JSON → null', () => {
    expect(processedCountFromSummary('LOAD', null)).toBeNull()
    expect(processedCountFromSummary('LOAD', '')).toBeNull()
    expect(processedCountFromSummary('LOAD', '{not json')).toBeNull()
    expect(processedCountFromSummary('LOAD', undefined)).toBeNull()
  })

  it('summary 无任何计数字段(如 DISPATCH 的回执态)→ null,UI 显示「—」', () => {
    const summary = JSON.stringify({ success: true, receiptStatus: 'ACCEPTED', code: 'OK' })
    expect(processedCountFromSummary('DISPATCH', summary)).toBeNull()
  })

  it('计数字段非数字(脏数据)→ 跳过不误显', () => {
    expect(processedCountFromSummary('LOAD', JSON.stringify({ loadedCount: 'NaN' }))).toBeNull()
  })
})
