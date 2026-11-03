import { describe, expect, it } from 'vitest'
import { rankTenantsByKeyword } from './tenantSearchRank'

const t = (tenantId: string, tenantName = '') => ({ tenantId, tenantName })

describe('rankTenantsByKeyword', () => {
  it('编码完全匹配排第一，其次编码前缀匹配，其余保持后端顺序', () => {
    const ranked = rankTenantsByKeyword(
      [t('beta', 'ta 关联'), t('tb'), t('ta-sandbox'), t('ta'), t('data')],
      'ta',
    )
    expect(ranked.map((x) => x.tenantId)).toEqual(['ta', 'ta-sandbox', 'beta', 'tb', 'data'])
  })

  it('忽略大小写与首尾空格，未输入关键字时原样返回', () => {
    expect(rankTenantsByKeyword([t('x'), t('TA')], ' ta ').map((x) => x.tenantId)).toEqual([
      'TA',
      'x',
    ])
    const items = [t('b'), t('a')]
    expect(rankTenantsByKeyword(items, '')).toEqual(items)
  })
})
