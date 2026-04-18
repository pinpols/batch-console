import type { MetaOption } from '@/api/meta'

/**
 * 按顺序取 `GET /api/console/meta/enums` 返回 map 中第一个非空分组。
 * 多个 key 用于兼容契约未写明但后端已扩展的命名。
 */
export function pickMetaEnumGroup(
  enums: Record<string, MetaOption[]> | undefined | null,
  ...keys: string[]
): MetaOption[] {
  if (!enums) return []
  for (const k of keys) {
    const arr = enums[k]
    if (Array.isArray(arr) && arr.length > 0) return arr
  }
  return []
}
