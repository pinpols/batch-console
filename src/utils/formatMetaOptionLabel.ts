import type { MetaOption } from '@/api/meta'

/**
 * 渲染 MetaOption 标签的统一规则:
 *  - label === value(无中文翻译,如 jobCode 这类纯字符串列表)→ 只显示 value
 *  - 否则 → `中文 (CODE)`,方便管理员排障 / 对接口
 *
 * 仅用于下拉选择器的 label 显示;StatusTag 等表格徽标场景保持纯中文,不要走这个。
 */
export function formatMetaOptionLabel(opt: MetaOption): string {
  if (opt.label === opt.value) return opt.value
  return `${opt.label} (${opt.value})`
}
