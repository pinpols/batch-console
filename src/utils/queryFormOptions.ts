/** 从记录列表收集非空字段唯一值并排序 */
export function uniqueFieldValues<T>(
  rows: T[],
  pick: (row: T) => string | null | undefined,
): string[] {
  const set = new Set<string>()
  for (const row of rows) {
    const v = pick(row)
    let s = ''
    if (v != null) {
      const stringValue = String(v)
      s = stringValue.trim()
    }
    if (s) set.add(s)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

/** 从宽松查询结果中提取可展示选项，过滤历史接口可能返回的 null/undefined 文本哨兵。 */
export function uniqueDisplayFieldValues<T>(rows: T[], pick: (row: T) => unknown): string[] {
  const values = new Set<string>()
  for (const row of rows) {
    const value = pick(row)
    const fallbackValue = value ?? ''
    const stringValue = String(fallbackValue)
    const normalized = stringValue.trim()
    if (normalized && normalized !== 'null' && normalized !== 'undefined') values.add(normalized)
  }
  return [...values].sort()
}
