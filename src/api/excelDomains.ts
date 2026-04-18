import { apiClient, get, post } from '@/api/client'
import type { ExcelQuickImportResponse } from '@/types/console-api'

export type ExcelDomain =
  | 'file-templates'
  | 'file-channels'
  | 'workflows'
  | 'job-definitions'
  | 'alert-routings'
  | 'batch-windows'
  | 'business-calendars'
  | 'pipeline-definitions'
  | 'quota-policies'
  | 'resource-queues'

/**
 * 5 个「初始化就维护」域：仍使用各自独立的 upload/preview/apply 端点。
 * 对应的单域 Excel 维护页面（ExcelMaintenanceWizard）只挂载这 5 个。
 */
export const STANDALONE_DOMAINS = [
  'file-templates',
  'batch-windows',
  'business-calendars',
  'quota-policies',
  'resource-queues',
] as const satisfies readonly ExcelDomain[]

/**
 * 5 个「合并导入」域：已迁移至 /api/console/config/tenant-package/excel 系列接口
 * （8-Sheet 单事务，含跨 Sheet 依赖校验）。
 * 对应的独立单域 upload/preview/apply 端点已标注 deprecated，
 * 前端页面已从 ExcelMaintenanceWizard 下线，代码保留供参考。
 *
 * @deprecated — 单域导入端点已废弃，请使用 TenantPackageImportWizard。
 */
export const MERGED_DOMAINS = [
  'file-channels',
  'workflows',
  'job-definitions',
  'alert-routings',
  'pipeline-definitions',
] as const satisfies readonly ExcelDomain[]

/**
 * 所有域均支持「下载带注释预览 workbook」：
 *   GET /api/console/config/{domain}/excel/preview/{uploadToken}/workbook
 */
export const EXCEL_DOMAINS_WITH_WORKBOOK_PREVIEW: readonly ExcelDomain[] = [
  'file-templates',
  'file-channels',
  'workflows',
  'job-definitions',
  'alert-routings',
  'batch-windows',
  'business-calendars',
  'pipeline-definitions',
  'quota-policies',
  'resource-queues',
] as const

// ---------------------------------------------------------------------------
// 单域路径表（全 10 个 domain，含已废弃的 5 个合并域）
// template / export 端点不受废弃影响，upload / preview / apply 已废弃。
// ---------------------------------------------------------------------------
const paths: Record<
  ExcelDomain,
  { template: string; export: string; upload: string; preview: string; apply: string }
> = {
  'file-templates': {
    template: '/api/console/config/file-templates/excel/template',
    export: '/api/console/config/file-templates/excel/export',
    upload: '/api/console/config/file-templates/excel/upload',
    preview: '/api/console/config/file-templates/excel/preview',
    apply: '/api/console/config/file-templates/excel/apply',
  },
  'file-channels': {
    template: '/api/console/config/file-channels/excel/template',
    export: '/api/console/config/file-channels/excel/export',
    upload: '/api/console/config/file-channels/excel/upload',
    preview: '/api/console/config/file-channels/excel/preview',
    apply: '/api/console/config/file-channels/excel/apply',
  },
  workflows: {
    template: '/api/console/config/workflows/excel/template',
    export: '/api/console/config/workflows/excel/export',
    upload: '/api/console/config/workflows/excel/upload',
    preview: '/api/console/config/workflows/excel/preview',
    apply: '/api/console/config/workflows/excel/apply',
  },
  'job-definitions': {
    template: '/api/console/config/job-definitions/excel/template',
    export: '/api/console/config/job-definitions/excel/export',
    upload: '/api/console/config/job-definitions/excel/upload',
    preview: '/api/console/config/job-definitions/excel/preview',
    apply: '/api/console/config/job-definitions/excel/apply',
  },
  'alert-routings': {
    template: '/api/console/config/alert-routings/excel/template',
    export: '/api/console/config/alert-routings/excel/export',
    upload: '/api/console/config/alert-routings/excel/upload',
    preview: '/api/console/config/alert-routings/excel/preview',
    apply: '/api/console/config/alert-routings/excel/apply',
  },
  'batch-windows': {
    template: '/api/console/config/batch-windows/excel/template',
    export: '/api/console/config/batch-windows/excel/export',
    upload: '/api/console/config/batch-windows/excel/upload',
    preview: '/api/console/config/batch-windows/excel/preview',
    apply: '/api/console/config/batch-windows/excel/apply',
  },
  'business-calendars': {
    template: '/api/console/config/business-calendars/excel/template',
    export: '/api/console/config/business-calendars/excel/export',
    upload: '/api/console/config/business-calendars/excel/upload',
    preview: '/api/console/config/business-calendars/excel/preview',
    apply: '/api/console/config/business-calendars/excel/apply',
  },
  'pipeline-definitions': {
    template: '/api/console/config/pipeline-definitions/excel/template',
    export: '/api/console/config/pipeline-definitions/excel/export',
    upload: '/api/console/config/pipeline-definitions/excel/upload',
    preview: '/api/console/config/pipeline-definitions/excel/preview',
    apply: '/api/console/config/pipeline-definitions/excel/apply',
  },
  'quota-policies': {
    template: '/api/console/config/quota-policies/excel/template',
    export: '/api/console/config/quota-policies/excel/export',
    upload: '/api/console/config/quota-policies/excel/upload',
    preview: '/api/console/config/quota-policies/excel/preview',
    apply: '/api/console/config/quota-policies/excel/apply',
  },
  'resource-queues': {
    template: '/api/console/config/resource-queues/excel/template',
    export: '/api/console/config/resource-queues/excel/export',
    upload: '/api/console/config/resource-queues/excel/upload',
    preview: '/api/console/config/resource-queues/excel/preview',
    apply: '/api/console/config/resource-queues/excel/apply',
  },
}

export function excelPaths(domain: ExcelDomain) {
  return paths[domain]
}

export function supportsPreviewWorkbook(domain: ExcelDomain): boolean {
  return EXCEL_DOMAINS_WITH_WORKBOOK_PREVIEW.includes(domain)
}

/** GET /api/console/config/{domain}/excel/template — 下载空白导入模板（xlsx blob） */
export async function excelDownloadTemplate(domain: ExcelDomain) {
  const { template } = paths[domain]
  const response = await apiClient.get(template, { responseType: 'blob' })
  return response.data as Blob
}

/** GET /api/console/config/{domain}/excel/export — 导出当前配置（xlsx blob） */
export async function excelExport(domain: ExcelDomain) {
  const { export: exportUrl } = paths[domain]
  const response = await apiClient.get(exportUrl, { responseType: 'blob' })
  return response.data as Blob
}

export async function excelUpload(domain: ExcelDomain, file: File) {
  const { upload } = paths[domain]
  const fd = new FormData()
  fd.append('file', file)
  return post<{ uploadToken?: string }>(upload, fd)
}

export function excelPreview(domain: ExcelDomain, uploadToken: string) {
  const { preview } = paths[domain]
  return get<unknown>(`${preview}/${encodeURIComponent(uploadToken)}`)
}

export function excelApply(domain: ExcelDomain, uploadToken: string, body?: object) {
  const { apply } = paths[domain]
  return post<string>(`${apply}/${encodeURIComponent(uploadToken)}`, body ?? {})
}

/**
 * 下载带注释预览 workbook（xlsx blob）。
 * 后端：GET /api/console/config/{domain}/excel/preview/{uploadToken}/workbook
 */
export async function excelDownloadPreviewWorkbook(domain: ExcelDomain, uploadToken: string) {
  if (!supportsPreviewWorkbook(domain)) {
    throw new Error(`Domain "${domain}" does not support preview workbook download`)
  }
  const { preview } = paths[domain]
  const url = `${preview}/${encodeURIComponent(uploadToken)}/workbook`
  const response = await apiClient.get(url, { responseType: 'blob' })
  return response.data as Blob
}

// ---------------------------------------------------------------------------
// 租户配置包（合并导入）API
// 8-Sheet 单事务导入：file_channel / alert_routing / pipeline / workflow / job_definition
// GET  /api/console/config/tenant-package/excel/template
// GET  /api/console/config/tenant-package/excel/export
// POST /api/console/config/tenant-package/excel/upload
// GET  /api/console/config/tenant-package/excel/preview/{token}
// GET  /api/console/config/tenant-package/excel/preview/{token}/workbook
// POST /api/console/config/tenant-package/excel/apply/{token}
// ---------------------------------------------------------------------------
const TENANT_PKG_BASE = '/api/console/config/tenant-package/excel'

/** GET …/template — 下载 8-Sheet 租户配置包空白模板 */
export async function tenantPackageDownloadTemplate(): Promise<Blob> {
  const res = await apiClient.get(`${TENANT_PKG_BASE}/template`, { responseType: 'blob' })
  return res.data as Blob
}

/** GET …/export — 导出当前租户全量配置包（可直接回灌至合包导入） */
export async function tenantPackageExport(): Promise<Blob> {
  const res = await apiClient.get(`${TENANT_PKG_BASE}/export`, { responseType: 'blob' })
  return res.data as Blob
}

/** POST …/upload — 上传 8-Sheet xlsx，返回 uploadToken */
export async function tenantPackageUpload(file: File) {
  const fd = new FormData()
  fd.append('file', file)
  return post<{ uploadToken?: string }>(`${TENANT_PKG_BASE}/upload`, fd)
}

/** GET …/preview/{token} — 预览校验结果（含跨 Sheet 依赖错误） */
export function tenantPackagePreview(uploadToken: string) {
  return get<unknown>(`${TENANT_PKG_BASE}/preview/${encodeURIComponent(uploadToken)}`)
}

/** GET …/preview/{token}/workbook — 下载带注释预览 workbook */
export async function tenantPackageDownloadPreviewWorkbook(uploadToken: string): Promise<Blob> {
  const res = await apiClient.get(
    `${TENANT_PKG_BASE}/preview/${encodeURIComponent(uploadToken)}/workbook`,
    { responseType: 'blob' },
  )
  return res.data as Blob
}

/** POST …/apply/{token} — 单事务应用合包导入结果 */
export function tenantPackageApply(uploadToken: string, body?: object) {
  return post<string>(`${TENANT_PKG_BASE}/apply/${encodeURIComponent(uploadToken)}`, body ?? {})
}

// ---------------------------------------------------------------------------
// Alert-routing quick-import (one-click upload+validate+apply)
// POST /api/console/config/alert-routings/excel/quick-import
// ---------------------------------------------------------------------------
export function quickImportAlertRoutings(
  file: File,
  opts?: { reason?: string; skipInvalid?: boolean },
) {
  const fd = new FormData()
  fd.append('file', file)
  if (opts?.reason) fd.append('reason', opts.reason)
  if (opts?.skipInvalid != null) fd.append('skipInvalid', String(opts.skipInvalid))
  return post<ExcelQuickImportResponse>('/api/console/config/alert-routings/excel/quick-import', fd)
}
