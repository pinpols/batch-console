import { apiClient } from '@/api/client'

export type ReportExcelKey =
  | 'config-releases'
  | 'secrets'
  | 'change-logs'
  | 'audits'
  | 'scheduler-snapshot'
  | 'scheduler-history'
  | 'workers'
  | 'outbox-retries'
  | 'outbox-deliveries'

/** 只导出报表 — blob，不经 JSON 信封解析 */
export function exportReportExcel(key: ReportExcelKey, params?: Record<string, string>) {
  return apiClient.get(`/api/console/reports/excel/${key}`, {
    params,
    responseType: 'blob',
  })
}

export function parseFilenameFromContentDisposition(
  header: string | undefined,
  fallback: string,
): string {
  if (!header) return fallback
  const m = /filename\*?=(?:UTF-8'')?["']?([^"';]+)/i.exec(header)
  if (!m?.[1]) return fallback
  try {
    return decodeURIComponent(m[1].replace(/["']/g, ''))
  } catch {
    return m[1]
  }
}

/** 触发浏览器下载；失败时抛错由调用方提示 */
export async function downloadReportExcel(
  key: ReportExcelKey,
  params: Record<string, string>,
  fallbackFilename: string,
): Promise<void> {
  const res = await exportReportExcel(key, params)
  const blob = res.data as Blob
  const name = parseFilenameFromContentDisposition(
    res.headers['content-disposition'],
    fallbackFilename,
  )
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name.endsWith('.xlsx') ? name : `${name}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
