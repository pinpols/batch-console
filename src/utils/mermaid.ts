type MermaidApi = typeof import('mermaid').default

let mermaidPromise: Promise<MermaidApi> | null = null

/** 按需加载工作流图渲染器，避免普通页面承担 Mermaid 的大体积依赖。 */
export function loadMermaid(): Promise<MermaidApi> {
  mermaidPromise ??= import('mermaid').then(({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      flowchart: { htmlLabels: true, curve: 'basis' },
      securityLevel: 'strict',
    })
    return mermaid
  })
  return mermaidPromise
}
