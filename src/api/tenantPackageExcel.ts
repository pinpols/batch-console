import { apiClient, get, post } from '@/api/client'

const TENANT_PKG_BASE = '/api/console/config/tenant-package/excel'

/** GET …/template — 下载租户配置包空白模板 */
export async function tenantPackageDownloadTemplate(): Promise<Blob> {
  const res = await apiClient.get(`${TENANT_PKG_BASE}/template`, { responseType: 'blob' })
  return res.data as Blob
}

/** GET …/export — 导出当前租户全量配置包 */
export async function tenantPackageExport(): Promise<Blob> {
  const res = await apiClient.get(`${TENANT_PKG_BASE}/export`, { responseType: 'blob' })
  return res.data as Blob
}

/** POST …/upload — 上传 xlsx，返回 uploadToken */
export async function tenantPackageUpload(file: File) {
  const fd = new FormData()
  fd.append('file', file)
  return post<{ uploadToken?: string }>(`${TENANT_PKG_BASE}/upload`, fd)
}

/** GET …/preview/{token} — 预览校验结果 */
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
