import { describe, expect, it } from 'vitest'
import type { RouteRecordRaw } from 'vue-router'
import { applyPageMetaToRoutes, pageMetaByPath } from './pageMeta'

describe('applyPageMetaToRoutes', () => {
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
