/** 运行图渲染后按 edgeLabel 文本为连线和标签补充类型 class（可信 SVG 渲染会移除内联样式）。 */
export function applyMermaidEdgeTypeClasses(root: ParentNode) {
  const paths = root.querySelectorAll<SVGPathElement>('path.flowchart-link')
  root.querySelectorAll<SVGGElement>('.edgeLabel').forEach((label, index) => {
    const text = (label.textContent ?? '').trim().toLowerCase()
    let suffix = 'always'
    if (text === 'success' || text === '成功后') suffix = 'success'
    else if (text === 'failure' || text === '失败后') suffix = 'failure'
    else if (text && text !== 'always' && text !== '始终') suffix = 'condition'
    label.classList.add(`edge-label--${suffix}`)
    paths[index]?.classList.add(`edge-type--${suffix}`)
  })
}
