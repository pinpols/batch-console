import { describe, expect, it } from 'vitest'
import { describeWholeWorkflowReplay } from './workflowReplayPreviewText'

const labels: Record<string, string> = {
  'monitor.replayBlocker.NO_ONLINE_WORKERS': '当前租户没有在线 Worker',
  'monitor.replayResultPolicy.CREATE_NEW_VERSION': '生成新版本结果',
  'monitor.replayConfigPolicy.USE_ORIGINAL_CONFIG': '沿用原配置',
}
const t = (key: string, params?: Record<string, unknown>) =>
  labels[key] ?? (params ? `${key}:${JSON.stringify(params)}` : key)
const te = (key: string) => key in labels

function preview(blockers: string[][]) {
  return {
    sourceWorkflowRunId: 433,
    bizDate: '2026-11-03',
    workflowVersion: 24,
    resultPolicy: 'CREATE_NEW_VERSION',
    configVersionPolicy: 'USE_ORIGINAL_CONFIG',
    nodes: blockers.map((b, i) => ({
      nodeCode: `N${i}`,
      nodeType: 'JOB',
      pluginId: 'http',
      blockers: b,
      capability: null,
    })),
    edges: [],
  } as unknown as Parameters<typeof describeWholeWorkflowReplay>[0]
}

describe('整个工作流重放预览说明', () => {
  it('阻塞时只列被阻塞的节点，原因翻译成中文并去重', () => {
    const text = describeWholeWorkflowReplay(
      preview([[], ['NO_ONLINE_WORKERS', 'NO_ONLINE_WORKERS', 'NEW_CODE']]),
      t,
      te,
    )
    expect(text.blocked).toBe(true)
    expect(text.items).toHaveLength(1)
    expect(text.items[0]).toContain('当前租户没有在线 Worker；NEW_CODE')
    expect(text.items[0]).toContain('"code":"N1"')
    expect(text.header).toContain('生成新版本结果')
    expect(text.header).toContain('沿用原配置')
  })

  it('没有阻塞时列出全部节点与边，供确认框展示', () => {
    const text = describeWholeWorkflowReplay(preview([[], []]), t, te)
    expect(text.blocked).toBe(false)
    expect(text.items).toContain('monitor.replayWholeWorkflowNoEdges')
    expect(text.items.filter((line) => line.startsWith('N'))).toHaveLength(2)
  })
})
