/**
 * designer 内部 DAG → Mermaid `graph TD` 字符串。
 *
 * 复用 `utils/crossDayMermaid.ts` 的字符串拼接思路,Spike 阶段只覆盖 DAG 子集:
 * - START / END / JOB / GATEWAY / FILE_STEP / APPROVAL 节点形状区分
 * - 边携带 label 时渲染 `-->|label|`
 * - 不处理跨日依赖(交给只读 viewer 的 `injectCrossDayEdges`)
 */

import type { DesignerNodeType, DesignerSnapshot } from '../types'

/** Mermaid id 不允许特殊字符,统一 sanitize */
function sanitizeId(code: string): string {
  return code.replace(/[^A-Za-z0-9_]/g, '_')
}

/** 节点形状:Mermaid 语法 `id[label]` 矩形 / `((label))` 圆形 / `{label}` 菱形 */
function renderNode(id: string, name: string, type: DesignerNodeType): string {
  const safeId = sanitizeId(id)
  const safeName = name.replace(/"/g, '\\"')
  switch (type) {
    case 'START':
    case 'END':
      return `  ${safeId}(("${safeName}"))`
    case 'GATEWAY':
      return `  ${safeId}{"${safeName}"}`
    default:
      return `  ${safeId}["${safeName}"]`
  }
}

export function exportMermaid(snapshot: DesignerSnapshot): string {
  const lines: string[] = ['graph TD']
  for (const n of snapshot.nodes) {
    lines.push(renderNode(n.id, n.nodeName || n.nodeCode, n.nodeType))
  }
  for (const e of snapshot.edges) {
    const s = sanitizeId(e.source)
    const t = sanitizeId(e.target)
    if (e.label) {
      lines.push(`  ${s} -->|${e.label}| ${t}`)
    } else {
      lines.push(`  ${s} --> ${t}`)
    }
  }
  return lines.join('\n')
}
