import { describe, expect, it } from 'vitest'
import type { RouteRecordRaw } from 'vue-router'
import { applyPageMetaToRoutes, pageMetaByPath, pageTitleKey } from './pageMeta'

describe('applyPageMetaToRoutes', () => {
  it('页面标题 key 忽略 query 和 hash，并优先使用显式 pathKey', () => {
    expect(pageTitleKey('/approvals?tab=catch-up#latest')).toBe('page.approvals.title')
    expect(pageTitleKey('/legacy', 'opsSummary')).toBe('page.opsSummary.title')
  })

  it('动态详情路径归一到已登记的基础页面 key', () => {
    expect(pageTitleKey('/monitor/job-instances/12514')).toBe('page.monitorJobInstances.title')
    expect(pageTitleKey('/monitor/workflow-runs/39546?tab=graph')).toBe(
      'page.monitorWorkflowRuns.title',
    )
    expect(pageTitleKey('/files/list')).toBe('page.filesList.title')
  })

  it('registers the independent job monitoring policy page metadata', () => {
    expect(pageMetaByPath['/observability/job-monitoring-policies']).toMatchObject({
      title: '作业监控策略',
    })
  })

  it('uses pageMetaByPath as the canonical page title source', () => {
    const routes: RouteRecordRaw[] = [
      {
        path: '/',
        component: {},
        children: [
          {
            path: 'ops/summary',
            component: {},
            meta: {
              title: 'stale route title',
              description: 'stale route description',
              activeMenu: '/ops/summary',
            },
          },
        ],
      },
    ]

    applyPageMetaToRoutes(routes)

    expect(routes[0].children?.[0].meta).toMatchObject({
      title: pageMetaByPath['/ops/summary'].title,
      description: pageMetaByPath['/ops/summary'].description,
      pathKey: 'opsSummary',
      activeMenu: '/ops/summary',
    })
  })
})
