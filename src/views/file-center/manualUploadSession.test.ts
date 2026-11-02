import { describe, expect, it } from 'vitest'
import type { ConsoleFilePresignUploadResponse } from '@/types/console-api'
import { validateUploadSession } from './manualUploadSession'

const validSession: ConsoleFilePresignUploadResponse = {
  fileId: 123,
  status: 'PENDING',
  uploadMode: 'APP_MANAGED',
  uploadMethod: 'PUT',
  contentField: 'file',
  uploadUrl: '/api/console/files/123/content?tenantId=tenant-a',
  storageBucket: 'bucket',
  storagePath: 'path',
  fileName: 'file.csv',
}

describe('应用托管文件上传会话', () => {
  it('接受与文件和当前租户一致的应用托管地址', () => {
    expect(validateUploadSession(validSession, 'tenant-a')).toBe(true)
  })

  it.each([
    [{ uploadUrl: 'https://other.example/api/console/files/123/content?tenantId=tenant-a' }],
    [{ uploadUrl: '/api/console/files/124/content?tenantId=tenant-a' }],
    [{ uploadUrl: '/api/console/files/123/content?tenantId=tenant-b' }],
    [{ uploadUrl: 'http://[' }],
    [{ uploadMode: 'PRESIGNED' }],
    [{ uploadMethod: 'POST' }],
    [{ contentField: 'other' }],
    [{ fileId: 0 }],
    [{ fileId: Number.MAX_SAFE_INTEGER + 1 }],
  ])('拒绝目标或会话属性不一致的上传', (changes) => {
    expect(validateUploadSession({ ...validSession, ...changes }, 'tenant-a')).toBe(false)
  })
})
