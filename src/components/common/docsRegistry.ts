/**
 * 上下文文档抽屉 docKey → docPath/title 注册表。
 *
 * 业务侧 `<DocsDrawer doc-key="xxx" />`,只需关心稳定 ID,不硬编码 URL。
 * 新增 doc-key 在这里加一行;path 相对文档站 base(/docs/),不带前导 /。
 */
export interface DocRegistryEntry {
  path: string
  title: string
}

export const DOC_REGISTRY: Record<string, DocRegistryEntry> = {
  'adr-009-workflow-param-dsl': {
    path: 'architecture/adr/ADR-009-workflow-param-dsl',
    title: 'ADR-009 Workflow 参数 DSL',
  },
  'adr-002-transactional-outbox': {
    path: 'architecture/adr/ADR-002-transactional-outbox',
    title: 'ADR-002 Transactional Outbox',
  },
  'workflow-dependency-guide': {
    path: 'architecture/workflow-dependency-guide',
    title: 'Workflow 依赖规则',
  },
  'pipeline-vs-workflow-boundary': {
    path: 'architecture/pipeline-vs-workflow-boundary',
    title: 'Pipeline vs Workflow 边界',
  },
  'coding-conventions': {
    path: 'coding-conventions',
    title: '代码规范',
  },
}

/** 文档站 base:dev 直连 5174,prod 同域 /docs/(nginx alias) — 仅 resolveDocUrl 内部用 */
function getDocsBase(): string {
  return import.meta.env.DEV ? 'http://localhost:5174/docs/' : '/docs/'
}

export function resolveDocUrl(docKey: string): string {
  const entry = DOC_REGISTRY[docKey]
  if (!entry) return ''
  return getDocsBase() + entry.path
}
