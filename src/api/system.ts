import { get, patch, post, put } from '@/api/client'
import { fetchAllPageItems } from '@/api/adapters'
import type {
  AiAuditLogResponse,
  AiChatRequest,
  AiChatResponse,
  ConsoleFileChannelResponse,
  ConsoleFileTemplateResponse,
  ConsoleFilePipelineResponse,
  ConsolePendingCatchUpResponse,
} from '@/types/console-api'
import type { PageResponse } from '@/types'

type RawObject = Record<string, unknown>

export interface PipelineDefinitionRow {
  id: number
  tenantId: string
  pipelineCode: string
  pipelineName: string
  pipelineType: string
  enabled: boolean
  description: string
  updatedAt: string
}

export interface PipelineDefinitionForm {
  tenantId: string
  pipelineCode: string
  pipelineName: string
  pipelineType: string
  enabled: boolean
  description: string
}

export interface FileTemplateSavePayload {
  tenantId: string
  templateCode?: string
  templateName?: string
  templateType?: string
  bizType?: string
  fileFormatType?: string
  charset?: string
  targetCharset?: string
  withBom?: boolean
  lineSeparator?: string
  delimiter?: string
  quoteChar?: string
  escapeChar?: string
  fieldMappingsJson?: string
  queryParamSchemaJson?: string
  enabled?: boolean
  version?: number
  description?: string
}

export interface FileChannelSavePayload {
  tenantId: string
  channelCode?: string
  channelName?: string
  channelType?: string
  targetEndpoint?: string
  authType?: string
  configJson?: string
  receiptPolicy?: string
  timeoutSeconds?: number
  enabled?: boolean
}

function readString(row: RawObject, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (value == null) continue
    return String(value)
  }
  return ''
}

function readNumber(row: RawObject, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (value == null || value === '') continue
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return 0
}

function readBoolean(row: RawObject, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value !== 0
    if (typeof value === 'string') {
      const text = value.trim().toLowerCase()
      if (['true', '1', 'yes', 'enabled', 'on'].includes(text)) return true
      if (['false', '0', 'no', 'disabled', 'off'].includes(text)) return false
    }
  }
  return false
}

function normalizePipelineDefinition(row: RawObject): PipelineDefinitionRow {
  return {
    id: readNumber(row, 'id'),
    tenantId: readString(row, 'tenantId', 'tenant_id'),
    pipelineCode: readString(row, 'jobCode', 'pipelineCode', 'job_code'),
    pipelineName: readString(row, 'pipelineName', 'pipeline_name', 'name'),
    pipelineType: readString(row, 'pipelineType', 'pipeline_type'),
    enabled: readBoolean(row, 'enabled'),
    description: readString(row, 'description'),
    updatedAt: readString(row, 'updatedAt', 'updated_at'),
  }
}

export function chatWithAi(body: AiChatRequest) {
  return post<AiChatResponse>('/api/console/ai/chat', body)
}

export function queryAiAudits(tenantId: string, pageNo: number, pageSize: number) {
  return get<PageResponse<AiAuditLogResponse>>('/api/console/queries/ai-audits', {
    tenantId,
    pageNo,
    pageSize,
  })
}

export function queryCatchUpApprovals(tenantId: string, pageNo: number, pageSize: number) {
  return get<PageResponse<ConsolePendingCatchUpResponse>>(
    '/api/console/queries/catch-up-approvals',
    {
      tenantId,
      pageNo,
      pageSize,
    },
  )
}

export function queryFileTemplates(tenantId: string, pageNo: number, pageSize: number) {
  return get<PageResponse<ConsoleFileTemplateResponse>>('/api/console/queries/file-templates', {
    tenantId,
    pageNo,
    pageSize,
  })
}

export function queryFileTemplateDetail(tenantId: string, templateCode: string) {
  return get<ConsoleFileTemplateResponse>(
    `/api/console/queries/file-templates/${encodeURIComponent(templateCode)}`,
    { tenantId },
  )
}

export async function queryPipelineDefinitions(
  tenantId: string,
  pageNo: number,
  pageSize: number,
  filters?: { jobCode?: string; pipelineType?: string; enabled?: boolean },
) {
  const data = await get<
    PageResponse<RawObject> | RawObject[] | { items?: RawObject[]; total?: number }
  >('/api/console/pipeline-definitions', {
    tenantId,
    pageNo,
    pageSize,
    ...(filters?.jobCode ? { jobCode: filters.jobCode } : {}),
    ...(filters?.pipelineType ? { pipelineType: filters.pipelineType } : {}),
    ...(filters?.enabled != null ? { enabled: filters.enabled } : {}),
  })
  if (Array.isArray(data)) {
    return { total: data.length, items: data.map(normalizePipelineDefinition) }
  }
  const items = Array.isArray(data.items) ? data.items : []
  return {
    total: Number(data.total ?? items.length),
    items: items.map(normalizePipelineDefinition),
  }
}

export function queryPipelineDefinitionDetail(tenantId: string, id: number) {
  return get<RawObject>(`/api/console/pipeline-definitions/${id}`, { tenantId })
}

export function createPipelineDefinition(body: Record<string, unknown>) {
  return post<number>('/api/console/pipeline-definitions', body)
}

export function updatePipelineDefinition(id: number, body: Record<string, unknown>) {
  return put<string>(`/api/console/pipeline-definitions/${id}`, body)
}

export function togglePipelineDefinition(id: number, tenantId: string, enabled: boolean) {
  return post<string>(`/api/console/pipeline-definitions/${id}/toggle`, undefined, {
    params: { tenantId, enabled },
  })
}

/** GET /api/console/queries/pipeline-definitions */
export function queryPipelineDefinitionsQuery(tenantId: string) {
  return fetchAllPageItems<RawObject>('/api/console/queries/pipeline-definitions', { tenantId })
}

/** GET /api/console/queries/pipeline-definitions/{id} */
export function queryPipelineDefinitionDetailQuery(id: number, tenantId: string) {
  return get<RawObject>(`/api/console/queries/pipeline-definitions/${id}`, { tenantId })
}

/** GET /api/console/file-channels — command-side list */
export function listFileChannels(tenantId: string) {
  return fetchAllPageItems<ConsoleFileChannelResponse>('/api/console/file-channels', { tenantId })
}

export function createFileChannel(body: FileChannelSavePayload) {
  return post<ConsoleFileChannelResponse>('/api/console/file-channels', body)
}

export function updateFileChannel(id: number, body: FileChannelSavePayload) {
  return put<ConsoleFileChannelResponse>(`/api/console/file-channels/${id}`, body)
}

/** GET /api/console/file-channels/{id} */
export function getFileChannel(id: number, tenantId: string) {
  return get<ConsoleFileChannelResponse>(`/api/console/file-channels/${id}`, { tenantId })
}

/** GET /api/console/queries/file-channels/{channelCode} */
export function queryFileChannelDetail(channelCode: string, tenantId: string) {
  return get<ConsoleFileChannelResponse>(
    `/api/console/queries/file-channels/${encodeURIComponent(channelCode)}`,
    { tenantId },
  )
}

/** GET /api/console/file-templates — command-side list */
export function listFileTemplates(tenantId: string) {
  return fetchAllPageItems<ConsoleFileTemplateResponse>('/api/console/file-templates', { tenantId })
}

export function createFileTemplate(body: FileTemplateSavePayload) {
  return post<ConsoleFileTemplateResponse>('/api/console/file-templates', body)
}

export function updateFileTemplate(id: number, body: FileTemplateSavePayload) {
  return put<ConsoleFileTemplateResponse>(`/api/console/file-templates/${id}`, body)
}

/** GET /api/console/file-templates/{id} */
export function getFileTemplate(id: number, tenantId: string) {
  return get<ConsoleFileTemplateResponse>(`/api/console/file-templates/${id}`, { tenantId })
}

/** GET /api/console/file-pipeline-observability */
export function listFilePipelineObservability(tenantId: string) {
  return fetchAllPageItems<ConsoleFilePipelineResponse>(
    '/api/console/file-pipeline-observability',
    {
      tenantId,
    },
  )
}

/** GET /api/console/file-pipeline-observability/{id} */
export function getFilePipelineObservability(id: number, tenantId: string) {
  return get<ConsoleFilePipelineResponse>(`/api/console/file-pipeline-observability/${id}`, {
    tenantId,
  })
}

/** GET /api/console/queries/file-pipelines/{id} */
export function queryFilePipelineDetail(id: number, tenantId: string) {
  return get<ConsoleFilePipelineResponse>(`/api/console/queries/file-pipelines/${id}`, { tenantId })
}

/** PATCH /api/console/file-channels/{id} — toggle enabled */
export function toggleFileChannel(id: number, tenantId: string, enabled: boolean) {
  return patch<void>(`/api/console/file-channels/${id}`, { tenantId, enabled })
}

/** PATCH /api/console/file-templates/{id} — toggle enabled */
export function toggleFileTemplate(id: number, tenantId: string, enabled: boolean) {
  return patch<void>(`/api/console/file-templates/${id}`, { tenantId, enabled })
}
