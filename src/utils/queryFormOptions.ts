/** 从记录列表收集非空字段唯一值并排序 */
export function uniqueFieldValues<T>(
  rows: T[],
  pick: (row: T) => string | null | undefined,
): string[] {
  const set = new Set<string>()
  for (const row of rows) {
    const v = pick(row)
    const s = v == null ? '' : String(v).trim()
    if (s) set.add(s)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}
