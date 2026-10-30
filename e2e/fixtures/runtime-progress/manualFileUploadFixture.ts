import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { expect } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'
import { ControlProgressFixture } from './fixture'

interface ManualUploadState {
  fileId: number | null
  fileCount: number
  objectFileCount: number
  fileSizeBytes: number | null
  fileStatus: string | null
  storageBucket: string | null
  storagePath: string | null
  uploadMode: string | null
  arrivalState: string | null
  arrivalConfirmedAt: string | null
  bizDate: string | null
  metadataBizDate: string | null
  fileGroupCode: string | null
  bundleWorkflowCode: string | null
  bundleTemplateCode: string | null
  requiredFileSet: string | null
  workflowDefinitionId: number | null
  workflowRunId: number | null
  workflowRunCount: number
  workflowRunStatus: string | null
  workflowNodeStatuses: string[]
  auditOperations: string[]
  channelCount: number
  expectationCount: number
  templateCount: number
}

/** 真实托管上传验收；业务动作由页面和 Console API 执行，SQL只读回并精确清理独占记录。 */
export class ManualFileUploadFixture extends ControlProgressFixture {
  readonly objectStorageNamespace = process.env.E2E_OBJECT_STORAGE_NAMESPACE?.trim() ?? ''
  readonly channelCode = `upload-${randomUUID().replaceAll('-', '')}`
  readonly fileName = `manual-${randomUUID().replaceAll('-', '')}.csv`
  readonly workflowCode = `manual_upload_${randomUUID().replaceAll('-', '')}`
  readonly fileGroupCode = `manual_upload_${randomUUID().replaceAll('-', '')}`
  readonly templateCode = `manual_upload_${randomUUID().replaceAll('-', '')}`
  readonly auditorName = `upload-auditor-${randomUUID()}`
  readonly userName = `upload-user-${randomUUID()}`

  prepareUploadBundleTarget() {
    return this.ownedSql<{ workflowDefinitionId: number; uploadTargetCount: number }>(
      'manual-upload-target-prepare',
      {
        workflow_code: this.workflowCode,
        file_group_code: this.fileGroupCode,
        template_code: this.templateCode,
      },
    )
  }

  prepareUploadRoles() {
    return this.ownedSql<{ roleAccountsCreated: number }>('manual-upload-roles-prepare', {
      auditor_name: this.auditorName,
      user_name: this.userName,
    })
  }

  uploadState(): ManualUploadState {
    return this.ownedSql<ManualUploadState>('manual-upload-state', {
      channel_code: this.channelCode,
      file_name: this.fileName,
      workflow_code: this.workflowCode,
      file_group_code: this.fileGroupCode,
      template_code: this.templateCode,
    })
  }

  removeUploadedObject(bucket: string | null, path: string | null) {
    if (!bucket || !path) return
    const backendRoot = resolve(__dirname, '../../../../file-batch-system')
    const minioClient = resolve(backendRoot, 'scripts/lib/minio-mc.sh')
    try {
      execFileSync(
        'bash',
        [minioClient, 'rm', '--force', `local/${bucket}/${this.physicalObjectPath(path)}`],
        {
          cwd: backendRoot,
          encoding: 'utf8',
          timeout: 45_000,
          stdio: 'pipe',
        },
      )
    } catch (error) {
      const commandError = error as { message?: string; stderr?: Buffer | string }
      const details = `${commandError.message ?? ''}\n${commandError.stderr?.toString() ?? ''}`
      const missingObjectIsAlreadyClean = /Object does not exist/.test(details)
      if (!missingObjectIsAlreadyClean) throw error
    }
  }

  readUploadedObject(bucket: string, path: string) {
    const backendRoot = resolve(__dirname, '../../../../file-batch-system')
    const minioClient = resolve(backendRoot, 'scripts/lib/minio-mc.sh')
    return execFileSync(
      'bash',
      [minioClient, 'cat', `local/${bucket}/${this.physicalObjectPath(path)}`],
      {
        cwd: backendRoot,
        timeout: 45_000,
        stdio: 'pipe',
      },
    )
  }

  private physicalObjectPath(path: string) {
    if (!this.objectStorageNamespace) return path
    if (!/^[a-z0-9][a-z0-9_-]{0,47}$/.test(this.objectStorageNamespace)) {
      throw new Error('E2E_OBJECT_STORAGE_NAMESPACE is invalid')
    }
    return `${this.objectStorageNamespace}/${path}`
  }

  cleanupUploadRows() {
    return this.ownedSql<Record<string, number>>('manual-upload-cleanup', {
      channel_code: this.channelCode,
      file_name: this.fileName,
      workflow_code: this.workflowCode,
      file_group_code: this.fileGroupCode,
      template_code: this.templateCode,
    })
  }

  cleanupUploadRoles() {
    return this.ownedSql<{ roleAccountsRemaining: number }>('manual-upload-roles-cleanup', {
      auditor_name: this.auditorName,
      user_name: this.userName,
    })
  }

  async ensureWorkflowTerminal(request: APIRequestContext) {
    const run = this.uploadState()
    if (!run.workflowRunId || !run.workflowRunStatus) return
    if (run.workflowRunStatus === 'PAUSED') {
      expect(
        (
          await this.mutate(request, `/api/console/workflow-runs/${run.workflowRunId}/resume`, {})
        ).status(),
      ).toBe(200)
    }
    if (!['SUCCESS', 'FAILED', 'TERMINATED'].includes(run.workflowRunStatus)) {
      expect(
        (
          await this.mutate(
            request,
            `/api/console/workflow-runs/${run.workflowRunId}/terminate`,
            {},
          )
        ).status(),
      ).toBe(200)
    }
    await expect
      .poll(() => this.uploadState().workflowRunStatus, { timeout: 45_000 })
      .toMatch(/^(SUCCESS|FAILED|TERMINATED)$/)
  }
}
