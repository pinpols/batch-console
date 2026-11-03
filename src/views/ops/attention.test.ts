import { describe, expect, it } from 'vitest'
import { buildAttentionItems, type AttentionSummary } from './attention'

const quiet: AttentionSummary = {
  pendingApprovals: 0,
  openAlerts: 0,
  criticalAlerts: 0,
  failedJobs: 0,
  slaBreaches: 0,
  drainingWorkers: 0,
  offlineWorkers: 0,
  outboxRetryBacklog: 0,
  outboxDeliveryFailures: 0,
}

describe('buildAttentionItems', () => {
  it('全部为 0 时不产生待处理项', () => {
    expect(buildAttentionItems(quiet)).toEqual([])
  })

  it('只列出非零项，并按失败类在前、警示类在后排序', () => {
    const items = buildAttentionItems({
      ...quiet,
      openAlerts: 40,
      failedJobs: 1,
      pendingApprovals: 2,
      offlineWorkers: 1,
    })
    expect(items.map((item) => item.key)).toEqual([
      'failedJobs',
      'offlineWorkers',
      'pendingApprovals',
      'openAlerts',
    ])
    expect(items[0]).toMatchObject({ tone: 'danger', count: 1, action: { kind: 'failedJobs' } })
    expect(items[3]).toMatchObject({
      tone: 'warning',
      count: 40,
      action: { kind: 'route', path: '/observability/alerts?status=OPEN' },
    })
  })

  it('严重告警单独成项，普通告警只计余下部分', () => {
    const items = buildAttentionItems({ ...quiet, openAlerts: 5, criticalAlerts: 2 })
    expect(items.map((item) => [item.key, item.count])).toEqual([
      ['criticalAlerts', 2],
      ['openAlerts', 3],
    ])
  })
})
