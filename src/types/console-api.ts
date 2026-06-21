/**
 * 从 OpenAPI 生成类型中抽取常用 Schema，避免业务代码直接依赖巨大 `api.generated.ts`。
 * 重新生成：npm run gen:api
 */
import type { components } from '@/types/api.generated'

export type ConsoleJobDefinitionResponse = components['schemas']['ConsoleJobDefinitionResponse']
export type ConsoleJobInstanceResponse = components['schemas']['ConsoleJobInstanceResponse']
export type ConsoleJobStepInstanceResponse = components['schemas']['ConsoleJobStepInstanceResponse']
export type ConsoleOpsSummaryResponse = components['schemas']['ConsoleOpsSummaryResponse']
export type ConsoleApprovalCommandResponse = components['schemas']['ConsoleApprovalCommandResponse']
export type ConsoleConfigReleaseResponse = components['schemas']['ConsoleConfigReleaseResponse']
export type ConsoleFileRecordResponse = components['schemas']['ConsoleFileRecordResponse']
export type ConsoleFileArrivalGroupResponse =
  components['schemas']['ConsoleFileArrivalGroupResponse']
export type ConsoleWorkerRegistryResponse = components['schemas']['ConsoleWorkerRegistryResponse']
export type ConsoleOperationAuditResponse = components['schemas']['ConsoleOperationAuditResponse']
// 后端 OpenAPI schema 暂未单独命名 ConsoleFileChannelResponse(只暴露 FileChannelSpec
// + 列表用的 PageResponse),前端仍在多处用强类型读 row.channelCode 等字段。
// 本地补一个接口,保证调用侧类型不退化为 any。
// codegen 把这个 schema 加进来后,删除本接口,改回 components['schemas']['...']。
export interface ConsoleFileChannelResponse {
  id: number
  tenantId: string
  channelCode: string
  channelName: string
  channelType: string
  targetEndpoint?: string | null
  authType?: string | null
  configJson?: string | null
  receiptPolicy?: string | null
  timeoutSeconds?: number | null
  enabled: boolean
  description?: string | null
  version?: number | null
  filter?: string | null
  charset?: string | null
  targetCharset?: string | null
  fileFormatType?: string | null
  lineSeparator?: string | null
  delimiter?: string | null
  fieldMappings?: unknown
  queryParamSchema?: string | null
  bizType?: string | null
  templateCode?: string | null
  templateName?: string | null
  templateType?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}
export type ConsoleWorkflowDefinitionResponse =
  components['schemas']['ConsoleWorkflowDefinitionResponse']
export type WorkflowDefinitionDetailResponse =
  components['schemas']['WorkflowDefinitionDetailResponse']
export type ConsoleWorkflowNodeResponse = components['schemas']['ConsoleWorkflowNodeResponse']
export type ConsoleWorkflowEdgeResponse = components['schemas']['ConsoleWorkflowEdgeResponse']
export type ConsoleWorkflowRunResponse = components['schemas']['ConsoleWorkflowRunResponse']
export type ConsoleWorkflowNodeRunResponse = components['schemas']['ConsoleWorkflowNodeRunResponse']
export type ConsoleAuditLogResponse = components['schemas']['ConsoleAuditLogResponse']
export type ConsoleOutboxRetryLogResponse = components['schemas']['ConsoleOutboxRetryLogResponse']
export type ConsoleOutboxDeliveryLogResponse =
  components['schemas']['ConsoleOutboxDeliveryLogResponse']
export type ConsoleSchedulerSnapshotResponse =
  components['schemas']['ConsoleSchedulerSnapshotResponse']
export type ConsoleSchedulerSnapshotHistoryResponse =
  components['schemas']['ConsoleSchedulerSnapshotHistoryResponse']
export type ConsoleSchedulerPolicySnapshot = components['schemas']['ConsoleSchedulerPolicySnapshot']
export type ConsoleSchedulerQueueSnapshot = components['schemas']['ConsoleSchedulerQueueSnapshot']
export type ConsoleAlertEventResponse = components['schemas']['ConsoleAlertEventResponse']
export type ConsoleBatchDayResponse = components['schemas']['ConsoleBatchDayResponse']
export type ConsoleBatchDayWindowResponse = components['schemas']['ConsoleBatchDayWindowResponse']
export type ConsoleBatchDaySummaryResponse = components['schemas']['ConsoleBatchDaySummaryResponse']
export type ConsoleBatchDayCatchUpResponse = components['schemas']['ConsoleBatchDayCatchUpResponse']
export type BatchDayCatchUpRequest = components['schemas']['BatchDayCatchUpRequest']
export type ConsoleWorkflowTopologyResponse =
  components['schemas']['ConsoleWorkflowTopologyResponse']
export type WorkflowDefinitionSaveRequest = components['schemas']['WorkflowDefinitionSaveRequest']
export type WorkflowNodeSaveItem = components['schemas']['WorkflowDefinitionSaveNodeItem']
export type WorkflowEdgeSaveItem = components['schemas']['WorkflowDefinitionSaveEdgeItem']
export type DagValidationFinding = components['schemas']['DagValidationFinding']
export type DagValidationResult = components['schemas']['DagValidationResult']
export type ConsoleFilePipelineResponse = components['schemas']['ConsoleFilePipelineResponse']
export type ConsoleFilePipelineStepResponse =
  components['schemas']['ConsoleFilePipelineStepResponse']
export type ConsoleFileDispatchRecordResponse =
  components['schemas']['ConsoleFileDispatchRecordResponse']
export type ConsoleFileErrorRecordResponse = components['schemas']['ConsoleFileErrorRecordResponse']
export type ConsoleFileTemplateResponse = components['schemas']['ConsoleFileTemplateResponse']
export type AiChatRequest = components['schemas']['AiChatRequest']
export type AiChatResponse = components['schemas']['AiChatResponse']
export type AiAuditLogResponse = components['schemas']['AiAuditLogResponse']
export type ConsolePendingCatchUpResponse = components['schemas']['ConsolePendingCatchUpResponse']
export type ConsoleAlertRoutingResponse = components['schemas']['ConsoleAlertRoutingResponse']
export type ConsoleAlertRoutingExcelUploadResponse =
  components['schemas']['ConsoleAlertRoutingExcelUploadResponse']
export type ConsoleAlertRoutingExcelPreviewResponse =
  components['schemas']['ConsoleAlertRoutingExcelPreviewResponse']
export type ConsoleAlertRoutingExcelApplyResponse =
  components['schemas']['ConsoleAlertRoutingExcelApplyResponse']
export type ConsoleAlertRoutingExcelRowIssueResponse =
  components['schemas']['ConsoleAlertRoutingExcelRowIssueResponse']
export type AlertRoutingExcelApplyRequest = components['schemas']['AlertRoutingExcelApplyRequest']
export type ConfigSyncBundlePayload = components['schemas']['ConfigSyncBundlePayload']
export type JobBundleCreateRequest = components['schemas']['JobBundleCreateRequest']
export type JobBundleImportRequest = components['schemas']['JobBundleImportRequest']
export type JobDefinitionCreateRequest = components['schemas']['JobDefinitionCreateRequest']
export type JobDefinitionUpdateRequest = components['schemas']['JobDefinitionUpdateRequest']

// --- Excel shared types ---
export type ExcelApplyRequest = components['schemas']['ExcelApplyRequest']
export type ExcelApplyResponse = components['schemas']['ExcelApplyResponse']
export type ExcelUploadResponse = components['schemas']['ExcelUploadResponse']
export type ExcelQuickImportResponse = components['schemas']['ExcelQuickImportResponse']
export type ExcelRowIssue = components['schemas']['ExcelRowIssue']

// --- Auth ---
export type ConsoleAuthTokenResponse = components['schemas']['ConsoleAuthTokenResponse']
export type ConsoleAuthProfileResponse = components['schemas']['ConsoleAuthProfileResponse']

// --- Alert actions ---
export type AlertActionRequest = components['schemas']['AlertActionRequest']
export type ConsoleAlertActionResponse = components['schemas']['ConsoleAlertActionResponse']

// --- Config ---
export type ConsoleConfigChangeLogResponse = components['schemas']['ConsoleConfigChangeLogResponse']
export type ConsoleSecretVersionResponse = components['schemas']['ConsoleSecretVersionResponse']

// --- File operations ---
export type ConsoleFileOperationResponse = components['schemas']['ConsoleFileOperationResponse']
export type ConsolePresignDownloadResponse = components['schemas']['ConsolePresignDownloadResponse']

// --- Dead letters / retries ---
export type ConsoleDeadLetterTaskResponse = components['schemas']['ConsoleDeadLetterTaskResponse']
export type DeadLetterReplayRequest = components['schemas']['DeadLetterReplayRequest']
export type ConsoleRetryScheduleResponse = components['schemas']['ConsoleRetryScheduleResponse']

// --- Worker ---
export type ConsoleWorkerClaimedTaskResponse =
  components['schemas']['ConsoleWorkerClaimedTaskResponse']

// --- Batch approval ---
export type ConsoleBatchApprovalResultResponse =
  components['schemas']['ConsoleBatchApprovalResultResponse']
export type ConsoleBatchDayCatchUpItemResponse =
  components['schemas']['ConsoleBatchDayCatchUpItemResponse']

// --- SSE ---
export type ConsoleSseEventResponse = components['schemas']['ConsoleSseEventResponse']
export type ConsoleTraceSnapshotResponse = components['schemas']['ConsoleTraceSnapshotResponse']

// --- Excel CRUD responses (file-templates) ---
export type ConsoleFileTemplateExcelUploadResponse =
  components['schemas']['ConsoleFileTemplateExcelUploadResponse']
export type ConsoleFileTemplateExcelPreviewResponse =
  components['schemas']['ConsoleFileTemplateExcelPreviewResponse']
export type ConsoleFileTemplateExcelApplyResponse =
  components['schemas']['ConsoleFileTemplateExcelApplyResponse']

// --- Excel CRUD responses (file-channels) ---
// 后端 codegen 未单独命名 Preview/Apply 的 channel 变体,统一用泛型 ExcelUpload/Apply。
// (代码里目前没人 import ChannelPreview/Apply 字面量,等用时再补本地接口。)
export type ConsoleFileChannelExcelUploadResponse =
  components['schemas']['ConsoleFileChannelExcelUploadResponse']
export type ConsoleFileChannelExcelApplyResponse =
  components['schemas']['ConsoleFileChannelExcelApplyResponse']

// --- Excel CRUD responses (workflows / job-definitions) ---
// 后端 codegen 尚未生成 workflow / job-definition 的 Excel*Response schema。
// 这些类型 export 全部 0 引用,删除即可;真要用时回到 codegen 加 schema 并恢复。
