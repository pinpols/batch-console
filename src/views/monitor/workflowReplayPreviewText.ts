import type { components } from '@/types/api.generated'

type ReplayPreview = components['schemas']['ConsoleWorkflowRunReplayPreviewResponse']
type Translate = (key: string, params?: Record<string, unknown>) => string
type HasKey = (key: string) => boolean

export interface WholeReplayPreviewText {
  /** 有节点被阻塞时不能提交，items 只列被阻塞的节点与原因 */
  blocked: boolean
  /** 来源运行、业务日、版本与策略 */
  header: string
  /** 阻塞时为被阻塞节点；可提交时为节点能力与依赖边 */
  items: string[]
}

/** 后端枚举码转中文；未登记的码原样显示，避免新值被吞掉 */
function enumLabel(group: string, code: string | null | undefined, t: Translate, te: HasKey) {
  if (!code) return t('monitor.replayNodeUnknownValue')
  const key = `monitor.${group}.${code}`
  return te(key) ? t(key) : code
}

/**
 * 整个工作流重放的预览说明。
 * 阻塞时只说哪些节点为什么不能重放；可提交时列出节点能力、外部影响与依赖边，供确认框展示。
 */
export function describeWholeWorkflowReplay(
  preview: ReplayPreview,
  t: Translate,
  te: HasKey,
): WholeReplayPreviewText {
  const header = t('monitor.replayWholeWorkflowPreviewHeader', {
    sourceRunId: preview.sourceWorkflowRunId,
    bizDate: preview.bizDate,
    workflowVersion: preview.workflowVersion,
    resultPolicy: enumLabel('replayResultPolicy', preview.resultPolicy, t, te),
    configVersionPolicy: enumLabel('replayConfigPolicy', preview.configVersionPolicy, t, te),
  })
  const blockedNodes = preview.nodes.filter((node) => node.blockers.length > 0)
  if (blockedNodes.length > 0) {
    return {
      blocked: true,
      header,
      items: [
        ...blockedNodes.map((node) =>
          t('monitor.replayWholeWorkflowBlockedNode', {
            code: node.nodeCode,
            reasons: Array.from(new Set(node.blockers))
              .map((blocker) => enumLabel('replayBlocker', blocker, t, te))
              .join('；'),
          }),
        ),
      ],
    }
  }
  const nodeLines = preview.nodes.map((node) => {
    const capability = node.capability?.status
      ? enumLabel('replayBlocker', node.capability.status, t, te)
      : t('monitor.replayWholeWorkflowCapabilityUnknown')
    const effects =
      node.capability?.declaration?.externalEffectCategories.join(', ') ||
      t('monitor.replayWholeWorkflowCapabilityUnknown')
    return `${node.nodeCode} (${node.nodeType}; ${node.pluginId ?? '—'}): ${capability}; ${effects}`
  })
  const edgeLines = preview.edges.map(
    (edge) => `${edge.fromNodeCode} → ${edge.toNodeCode} (${edge.edgeType})`,
  )
  return {
    blocked: false,
    header,
    items: [
      t('monitor.replayWholeWorkflowNodesHeader'),
      ...nodeLines,
      t('monitor.replayWholeWorkflowEdgesHeader'),
      ...(edgeLines.length ? edgeLines : [t('monitor.replayWholeWorkflowNoEdges')]),
    ],
  }
}
