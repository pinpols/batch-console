import { apiClient, get, post } from '@/api/client'
import { readStoredTenantId } from '@/api/interceptors'
import type { components } from '@/types/api.generated'

const TENANT_PKG_BASE = '/api/console/config/tenant-package/excel'

export type TenantPackageUploadResponse =
  components['schemas']['TenantConfigPackageExcelUploadResponse']
export type TenantPackagePreviewResponse =
  components['schemas']['TenantConfigPackageExcelPreviewResponse']
export type TenantPackageApplyRequest =
  components['schemas']['TenantConfigPackageExcelApplyRequest']
export type TenantPackageApplyResponse =
  components['schemas']['TenantConfigPackageExcelApplyResponse']
export type TenantPackagePatchRequest =
  components['schemas']['TenantConfigPackageExcelPatchRequest']
export type TenantPackageGuideResponse =
  components['schemas']['TenantConfigPackageExcelGuideResponse']
export type TenantPackageSheetGuide = components['schemas']['TenantConfigPackageSheetGuide']
export type TenantPackageColumnGuide = components['schemas']['TenantConfigPackageColumnGuide']
export type TenantPackageSampleScenario =
  | 'ALL'
  | 'IMPORT'
  | 'EXPORT'
  | 'IMPORT_DELIMITED'
  | 'IMPORT_FIXED_WIDTH'
  | 'IMPORT_EXCEL'
  | 'IMPORT_XML'
  | 'IMPORT_JSON'
  | 'EXPORT_DELIMITED'
  | 'EXPORT_FIXED_WIDTH'
  | 'EXPORT_EXCEL'
  | 'EXPORT_JSON'
  | 'PROCESS'
  | 'DISPATCH'
  | 'ATOMIC'
  | 'WORKFLOW'
  | 'SCHEDULE'

export async function refreshTenantPackagePreviewOnConflict(
  error: unknown,
  refresh: () => Promise<unknown>,
): Promise<'not-conflict' | 'refreshed' | 'refresh-failed'> {
  const response = (error as { response?: { status?: number; data?: { code?: string } } } | null)
    ?.response
  if (response?.status !== 409 || response.data?.code !== 'STATE_CONFLICT') {
    return 'not-conflict'
  }
  try {
    await refresh()
    return 'refreshed'
  } catch {
    return 'refresh-failed'
  }
}

function currentTenantParams() {
  return { tenantId: readStoredTenantId() }
}

/** GET …/scenario-template — 下载所选业务场景的空白模板 */
export async function tenantPackageDownloadTemplate(
  scenarios: TenantPackageSampleScenario[],
): Promise<Blob> {
  if (scenarios.length === 0) {
    throw new Error('Select at least one configuration scenario')
  }
  const params = new URLSearchParams()
  for (const scenario of scenarios) {
    params.append('scenarios', scenario)
  }
  const res = await apiClient.get(`${TENANT_PKG_BASE}/scenario-template`, {
    params,
    responseType: 'blob',
  })
  return res.data as Blob
}

/** GET …/sample-template — 下载场景化示例配置包模板 */
export async function tenantPackageDownloadSampleTemplate(
  scenarios: TenantPackageSampleScenario[],
): Promise<Blob> {
  if (scenarios.length === 0) {
    throw new Error('Select at least one configuration scenario')
  }
  const params = new URLSearchParams()
  for (const scenario of scenarios) {
    params.append('scenarios', scenario)
  }
  const res = await apiClient.get(`${TENANT_PKG_BASE}/sample-template`, {
    params,
    responseType: 'blob',
  })
  return res.data as Blob
}

/** GET …/export — 导出当前租户全量配置包 */
export async function tenantPackageExport(): Promise<Blob> {
  const res = await apiClient.get(`${TENANT_PKG_BASE}/export`, {
    params: currentTenantParams(),
    responseType: 'blob',
  })
  return res.data as Blob
}

/** GET …/guide — 读取当前配置包各 Sheet 的字段填写说明 */
export function tenantPackageGuide(): Promise<TenantPackageGuideResponse> {
  return get<TenantPackageGuideResponse>(`${TENANT_PKG_BASE}/guide`)
}

/** POST …/upload — 上传 xlsx，返回 token 与各 sheet 行数 */
export async function tenantPackageUpload(file: File) {
  const fd = new FormData()
  fd.append('file', file)
  return post<TenantPackageUploadResponse>(`${TENANT_PKG_BASE}/upload`, fd, {
    params: currentTenantParams(),
  })
}

/** GET …/preview/{token} — 预览校验结果 */
export function tenantPackagePreview(uploadToken: string) {
  return get<TenantPackagePreviewResponse>(
    `${TENANT_PKG_BASE}/preview/${encodeURIComponent(uploadToken)}`,
  )
}

/**
 * POST …/preview/{token}/patch — 出错行内联编辑回写 + 重校验,返回新预览。
 * 不落库,仍需 apply。values 只需传被改动的列(后端只合并该行已有列键)。
 */
export function tenantPackagePatchRow(
  uploadToken: string,
  body: TenantPackagePatchRequest,
): Promise<TenantPackagePreviewResponse> {
  return post<TenantPackagePreviewResponse>(
    `${TENANT_PKG_BASE}/preview/${encodeURIComponent(uploadToken)}/patch`,
    body,
  )
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
export function tenantPackageApply(uploadToken: string, body: TenantPackageApplyRequest) {
  return post<TenantPackageApplyResponse>(
    `${TENANT_PKG_BASE}/apply/${encodeURIComponent(uploadToken)}`,
    body,
  )
}
