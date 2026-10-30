import { instanceApi } from '@/api/instance'
import { queryJobStepInstancePage } from '@/api/jobStepInstances'
import { queryPartitionsPaged, type ConsoleJobPartitionResponse } from '@/api/queries/partitions'
import type {
  ConsoleJobInstanceResponse,
  ConsoleJobStepInstanceResponse,
} from '@/types/console-api'

const DETAIL_PAGE_SIZE = 20

export interface WorkflowNodeExecutionDetails {
  instance: ConsoleJobInstanceResponse
  partitions: ConsoleJobPartitionResponse[]
  partitionTotal: number
  steps: ConsoleJobStepInstanceResponse[]
  stepTotal: number
}

/** 加载 JOB 节点的有限执行概览；完整历史仍可在实例详情页查看。 */
export async function loadWorkflowNodeExecutionDetails(
  jobInstanceId: number,
  tenantId: string,
): Promise<WorkflowNodeExecutionDetails> {
  const [instance, partitionPage, stepPage] = await Promise.all([
    instanceApi.detail(jobInstanceId, tenantId),
    queryPartitionsPaged({ tenantId, jobInstanceId, page: 1, pageSize: DETAIL_PAGE_SIZE }),
    queryJobStepInstancePage({
      tenantId,
      jobInstanceId,
      pageNo: 1,
      pageSize: DETAIL_PAGE_SIZE,
    }),
  ])

  return {
    instance,
    partitions: partitionPage.records,
    partitionTotal: partitionPage.total,
    steps: stepPage.items ?? [],
    stepTotal: stepPage.total ?? 0,
  }
}
