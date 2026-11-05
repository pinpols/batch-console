/**
 * 告警列表的同类合并：同一页内告警类型、标题、级别、状态都相同的告警合成一组，
 * 只展示最新一条，其余折叠为“另有 N 条同类告警”。
 *
 * 例如同一作业多次运行都触发“作业终态仍存在失败分区”，逐条平铺会淹没其他告警。
 * 只在当前页内合并，不改变后端分页与排序；组内保持原有顺序（最新在前）。
 */
export interface AlertGroupSource {
  id: number | string
  alertType?: string | null
  title?: string | null
  severity?: string | null
  status?: string | null
}

export interface AlertGroup<T extends AlertGroupSource> {
  key: string
  rows: T[]
}

export function groupSimilarAlerts<T extends AlertGroupSource>(
  rows: readonly T[],
): AlertGroup<T>[] {
  const groups: AlertGroup<T>[] = []
  const byKey = new Map<string, AlertGroup<T>>()
  for (const row of rows) {
    const key = [row.alertType, row.title, row.severity, row.status]
      .map((v) => v ?? '')
      .join('\u0001')
    const existing = byKey.get(key)
    if (existing) {
      existing.rows.push(row)
    } else {
      const group = { key, rows: [row] }
      byKey.set(key, group)
      groups.push(group)
    }
  }
  return groups
}
