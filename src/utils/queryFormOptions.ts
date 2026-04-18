import type { StatusMeta } from '@/constants/status'
import { outboxPublishStatusMap } from '@/constants/status'

/** 状态映射 → 下拉项（中文说明 + 枚举值） */
export function optionsFromStatusMap(
  map: Record<string, StatusMeta>,
): { label: string; value: string }[] {
  return Object.entries(map).map(([value, meta]) => ({
    value,
    label: `${meta.label} · ${value}`,
  }))
}

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

/** Outbox 重试/投递状态：已知枚举带中文，其余仅显示原值 */
export function outboxStatusSelectLabel(code: string): string {
  const meta = outboxPublishStatusMap[code]
  return meta ? `${meta.label} · ${code}` : code
}
