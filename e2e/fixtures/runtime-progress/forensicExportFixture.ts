import { existsSync, rmSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { ControlProgressFixture } from './fixture'
import { requiredEnvironment } from '../closure-recovery/fixture'

export interface ForensicExportDbRow {
  tenantId: string
  exportId: string
  bizDateFrom: string
  bizDateTo: string
  exportFormat: string
  status: string
  storagePath: string | null
  fileSizeBytes: number | null
  sha256: string | null
  rowCounts: Record<string, number> | null
  requestedBy: string
}

interface ForensicExportFileRow {
  exportId: string
  storagePath: string | null
}

/** 取证包验收只清理独占租户的导出行与其专属临时目录中的文件。 */
export class ForensicExportFixture extends ControlProgressFixture {
  readonly storageDir = resolve(requiredEnvironment('E2E_FORENSIC_STORAGE_DIR'))

  forensicState(): ForensicExportDbRow[] {
    return this.ownedSql<ForensicExportDbRow[]>('forensic-export-state')
  }

  cleanupForensic(): { deletedRows: number; filesRemoved: number; remainingRows: number } {
    const files = this.ownedSql<ForensicExportFileRow[]>('forensic-export-cleanup')
    let filesRemoved = 0
    for (const file of files) {
      if (!file.storagePath) continue
      const path = resolve(file.storagePath)
      if (dirname(path) !== this.storageDir || basename(path) !== `${file.exportId}.zip`) {
        throw new Error('Refusing to remove a forensic file outside this fixture storage directory')
      }
      if (existsSync(path)) {
        rmSync(path)
        filesRemoved += 1
      }
    }
    const remainingRows = this.forensicState().length
    return { deletedRows: files.length, filesRemoved, remainingRows }
  }

  protected override ownedSql<T>(
    script:
      | 'credentials-prepare'
      | 'credentials-cleanup'
      | 'pipeline-prepare'
      | 'pipeline-advance'
      | 'pipeline-cleanup'
      | 'batchday-prepare'
      | 'batchday-state'
      | 'batchday-cleanup'
      | 'atomic-config-state'
      | 'atomic-config-cleanup'
      | 'result-version-prepare'
      | 'result-version-state'
      | 'result-version-cleanup'
      | 'worker-progress-state'
      | 'worker-progress-cleanup'
      | 'oidc-identity-state'
      | 'oidc-identity-cleanup'
      | 'forensic-export-state'
      | 'forensic-export-cleanup',
    extra: Record<string, string> = {},
  ): T {
    return super.ownedSql<T>(script, extra)
  }
}
