/** 把 viewBox 扩到全部图形（含 viewBox 外的节点），原点可以不是 0。 */
export function expandSvgViewBoxToContent(svgEl: SVGSVGElement, pad = 16) {
  if (typeof svgEl.getBBox !== 'function') return
  try {
    const box = svgEl.getBBox()
    if (!(box.width > 0) || !(box.height > 0)) return
    svgEl.setAttribute(
      'viewBox',
      `${box.x - pad} ${box.y - pad} ${box.width + pad * 2} ${box.height + pad * 2}`,
    )
  } catch {
    // 未挂载时 getBBox 会抛错，保留 mermaid 原来的 viewBox。
  }
}
