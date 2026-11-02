import type { ConsoleFilePresignUploadResponse } from '@/types/console-api'

/** 只接受当前租户和当前文件对应的应用托管上传地址。 */
export function validateUploadSession(
  session: ConsoleFilePresignUploadResponse,
  tenantId: string,
): boolean {
  if (
    session.uploadMode !== 'APP_MANAGED' ||
    session.uploadMethod !== 'PUT' ||
    session.contentField !== 'file' ||
    !Number.isSafeInteger(session.fileId) ||
    session.fileId <= 0
  ) {
    return false
  }
  try {
    const uploadUrl = new URL(session.uploadUrl, 'https://console.invalid')
    return (
      uploadUrl.origin === 'https://console.invalid' &&
      uploadUrl.pathname === `/api/console/files/${session.fileId}/content` &&
      uploadUrl.searchParams.get('tenantId') === tenantId
    )
  } catch {
    return false
  }
}
