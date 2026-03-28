import { get, post } from '@/api/client'
import { toPageResult } from '@/api/adapters'
import type { FileRecord, FileGroupArrival, PageResult } from '@/types'

export interface FileQuery {
  tenantId?: string
  fileStatus?: string
  bizType?: string
  fileName?: string
  startDate?: string
  endDate?: string
  page: number
  pageSize: number
}

function filterFiles(items: FileRecord[], q: FileQuery): FileRecord[] {
  let rows = [...items]
  if (q.fileStatus) rows = rows.filter((r) => r.fileStatus === q.fileStatus)
  if (q.bizType) rows = rows.filter((r) => r.bizType?.includes(q.bizType!))
  if (q.fileName) rows = rows.filter((r) => r.fileName?.includes(q.fileName!))
  return rows
}

export const fileApi = {
  list: async (query: FileQuery) => {
    const items = await get<FileRecord[]>('/api/console/query/files', {
      tenantId: query.tenantId,
    })
    return toPageResult(filterFiles(items, query), query.page, query.pageSize)
  },

  detail: (_fileId: number) => Promise.reject(new Error('文件详情：待 OpenAPI 路径')),

  audit: (_fileId: number) => Promise.reject(new Error('文件审计：待 OpenAPI')),

  listArrivalGroups: (tenantId: string) =>
    get<FileGroupArrival[]>('/api/console/query/file-arrival-groups', { tenantId }),

  confirmArrival: (fileGroupCode: string, tenantId: string) =>
    post('/api/console/files/arrival-groups/action', { tenantId, fileGroupCode, action: 'CONFIRM' }),
}
