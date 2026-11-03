/**
 * 租户搜索结果排序：后端按自身顺序返回关键字命中项，输入 `ta` 时完全匹配的 `ta`
 * 可能排在末位。这里只做稳定的前端重排：编码完全匹配 > 编码前缀匹配 > 其余（保持后端顺序）。
 */
export function rankTenantsByKeyword<T extends { tenantId: string }>(
  items: readonly T[],
  keyword?: string | null,
): T[] {
  const query = keyword?.trim().toLowerCase()
  if (!query) return [...items]
  const score = (item: T) => {
    const id = item.tenantId.toLowerCase()
    if (id === query) return 0
    if (id.startsWith(query)) return 1
    return 2
  }
  return items
    .map((item, index) => ({ item, index, score: score(item) }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map(({ item }) => item)
}
