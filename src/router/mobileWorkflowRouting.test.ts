// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import { resolveMobileTarget, legacyMobileWorkflowRunRedirect } from './index'

const route = (path: string, query: Record<string, string | null> = {}, name?: string) =>
  ({ path, query, name }) as unknown as RouteLocationNormalized

describe('移动 Workflow 深链', () => {
  it('区分运行 ID 与定义 ID', () => {
    expect(resolveMobileTarget(route('/monitor/workflow-runs/42'))).toBe('/m/workflow/run/42')
    expect(resolveMobileTarget(route('/workflow/viewer/17'))).toBe('/m/workflow/17')
  })
  it('旧定义查看地址含 runId 时跳到运行快照，保留其他查询条件', () => {
    expect(
      legacyMobileWorkflowRunRedirect(
        route('/m/workflow/17', { runId: '42', source: 'alert' }, 'm-workflow-viewer'),
      ),
    ).toEqual({
      name: 'm-workflow-run',
      params: { id: '42' },
      query: { source: 'alert' },
      replace: true,
    })
    expect(
      legacyMobileWorkflowRunRedirect(route('/m/workflow/17', {}, 'm-workflow-viewer')),
    ).toBeNull()
  })
})
