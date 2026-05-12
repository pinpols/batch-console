import { apiClient } from '@/api/client'

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
 * 独立 Excel 仅保留 template/export；导入统一走 tenant-package。
 */
export const EXCEL_TEMPLATE_EXPORT_DOMAINS = [
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
] as const satisfies readonly ExcelDomain[]

// ---------------------------------------------------------------------------
// 单域路径表（全 10 个 domain）
// template / export 端点保留；upload / preview / apply 已并入 tenant-package。
// ---------------------------------------------------------------------------
const paths: Record<ExcelDomain, { template: string; export: string }> = {
  'file-templates': {
    template: '/api/console/config/file-templates/excel/template',
    export: '/api/console/config/file-templates/excel/export',
  },
  'file-channels': {
    template: '/api/console/config/file-channels/excel/template',
    export: '/api/console/config/file-channels/excel/export',
  },
  workflows: {
    template: '/api/console/config/workflows/excel/template',
    export: '/api/console/config/workflows/excel/export',
  },
  'job-definitions': {
    template: '/api/console/config/job-definitions/excel/template',
    export: '/api/console/config/job-definitions/excel/export',
  },
  'alert-routings': {
    template: '/api/console/config/alert-routings/excel/template',
    export: '/api/console/config/alert-routings/excel/export',
  },
  'batch-windows': {
    template: '/api/console/config/batch-windows/excel/template',
    export: '/api/console/config/batch-windows/excel/export',
  },
  'business-calendars': {
    template: '/api/console/config/business-calendars/excel/template',
    export: '/api/console/config/business-calendars/excel/export',
  },
  'pipeline-definitions': {
    template: '/api/console/config/pipeline-definitions/excel/template',
    export: '/api/console/config/pipeline-definitions/excel/export',
  },
  'quota-policies': {
    template: '/api/console/config/quota-policies/excel/template',
    export: '/api/console/config/quota-policies/excel/export',
  },
  'resource-queues': {
    template: '/api/console/config/resource-queues/excel/template',
    export: '/api/console/config/resource-queues/excel/export',
  },
}

export function excelPaths(domain: ExcelDomain) {
  return paths[domain]
}

/** GET /api/console/config/{domain}/excel/template — 下载单域空白模板（xlsx blob） */
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
