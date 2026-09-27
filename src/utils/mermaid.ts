type MermaidApi = typeof import('mermaid').default

let mermaidPromise: Promise<MermaidApi> | null = null

/** 按需加载工作流图渲染器，避免普通页面承担 Mermaid 的大体积依赖。 */
export function loadMermaid(): Promise<MermaidApi> {
  mermaidPromise ??= import('mermaid').then(({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      // Mermaid 11 以全局 htmlLabels 为准；同时保留 flowchart 配置兼容旧版。
      // 使用原生 SVG <text>，避免安全净化移除 foreignObject 后节点只剩色块。
      htmlLabels: false,
      flowchart: { htmlLabels: false, curve: 'basis' },
      securityLevel: 'strict',
    })
    return mermaid
  })
  return mermaidPromise
}
