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

function currentTenantParams() {
  return { tenantId: readStoredTenantId() }
}

/** GET …/template — 下载租户配置包空白模板 */
export async function tenantPackageDownloadTemplate(): Promise<Blob> {
  const res = await apiClient.get(`${TENANT_PKG_BASE}/template`, {
    params: currentTenantParams(),
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
export function tenantPackageApply(uploadToken: string, body: TenantPackageApplyRequest = {}) {
  return post<TenantPackageApplyResponse>(
    `${TENANT_PKG_BASE}/apply/${encodeURIComponent(uploadToken)}`,
    body,
  )
}
