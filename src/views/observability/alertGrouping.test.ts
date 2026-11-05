import { describe, expect, it } from 'vitest'
import { groupSimilarAlerts } from './alertGrouping'

const alert = (id: number, over: Record<string, string> = {}) => ({
  id,
  alertType: 'JOB_FINAL_PARTITION_FAILURE',
  title: '作业终态仍存在失败分区:TA_COV_ATOMIC',
  severity: 'WARN',
  status: 'OPEN',
  ...over,
})

describe('告警同类合并', () => {
  it('类型、标题、级别、状态相同的告警合为一组，保留原顺序', () => {
    const groups = groupSimilarAlerts([alert(3), alert(2), alert(1)])
    expect(groups).toHaveLength(1)
    expect(groups[0]!.rows.map((r) => r.id)).toEqual([3, 2, 1])
  })

  it('任一维度不同即分开，组按首次出现顺序排列', () => {
    const groups = groupSimilarAlerts([
      alert(5),
      alert(4, { status: 'ACKED' }),
      alert(3, { title: '另一个作业' }),
      alert(2),
    ])
    expect(groups.map((g) => g.rows.map((r) => r.id))).toEqual([[5, 2], [4], [3]])
  })
})
