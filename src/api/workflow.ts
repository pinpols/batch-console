import { get } from '@/api/client'
import { toPageResult } from '@/api/adapters'
import type { PageResult, WorkflowDefinition } from '@/types'

export interface WorkflowDefinitionQuery {
  tenantId?: string
  workflowCode?: string
  enabled?: boolean
  page: number
  pageSize: number
}

export const workflowApi = {
  listDefinitions: async (query: WorkflowDefinitionQuery) => {
    const items = await get<WorkflowDefinition[]>('/api/console/query/workflow-definitions', {
      tenantId: query.tenantId,
    })
    let rows = [...items]
    if (query.workflowCode) {
      rows = rows.filter((r) => r.workflowCode?.includes(query.workflowCode!))
    }
    return toPageResult(rows, query.page, query.pageSize)
  },

  detail: async (workflowCode: string, tenantId: string) => {
    const items = await get<WorkflowDefinition[]>('/api/console/query/workflow-definitions', {
      tenantId,
    })
    const row = items.find((x) => x.workflowCode === workflowCode)
    if (!row) {
      throw new Error('Workflow 不存在')
    }
    return row
  },

  saveDefinition: (_workflowCode: string, _data: Partial<WorkflowDefinition>) =>
    Promise.reject(new Error('保存 Workflow：请走 Excel 四步或配置发布')),

  publishDefinition: (_workflowCode: string, _tenantId: string) =>
    Promise.reject(new Error('发布 Workflow：请走配置发布 API')),
}
