import { get } from '@/api/client'
import type { components } from '@/types/api.generated'
import type { PageResponse, PageResult } from '@/types'

export interface PartitionQueryParams {
  tenantId?: string
  jobInstanceId?: number
  partitionStatus?: string
  page: number
  pageSize: number
}

// 复用 OpenAPI codegen 生成的强类型,避免 row.id 等沦为 unknown。
// BE #811 起 FAILED 分区透出 errorCode / errorMessage,但配对 sibling 仓 OpenAPI 落后,
// codegen 尚未纳入该两字段。本地补交集,codegen 追上后删。
export type ConsoleJobPartitionResponse = components['schemas']['ConsoleJobPartitionResponse'] & {
  errorCode?: string | null
  errorMessage?: string | null
}

export async function queryPartitionsPaged(
  query: PartitionQueryParams,
): Promise<PageResult<ConsoleJobPartitionResponse>> {
  const pr = await get<PageResponse<ConsoleJobPartitionResponse>>(
    '/api/console/queries/partitions',
    {
      tenantId: query.tenantId,
      ...(query.jobInstanceId != null ? { jobInstanceId: query.jobInstanceId } : {}),
      ...(query.partitionStatus?.trim() ? { partitionStatus: query.partitionStatus.trim() } : {}),
      pageNo: query.page,
      pageSize: query.pageSize,
    },
  )
  return {
    records: (pr.items ?? []) as ConsoleJobPartitionResponse[],
    total: pr.total ?? 0,
    page: query.page,
    pageSize: query.pageSize,
  }
}
