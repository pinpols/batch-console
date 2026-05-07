import { ref, computed, type ComputedRef, type Ref } from 'vue'
import type { UploadFile } from 'element-plus'

export interface PreviewStats {
  total: number | string
  valid: number | string
  invalid: number | string
  /** Excel 维护向导专用;TenantPackage 后端不返回时恒为 0,模板里别引用就好 */
  insert: number
  update: number
}

export interface PreviewIssue {
  sheetName: string
  rowNo: unknown
  messages: string
}

export interface ImportWizardState {
  step: Ref<number>
  file: Ref<File | null>
  uploadToken: Ref<string>
  upLoading: Ref<boolean>
  pvLoading: Ref<boolean>
  wbLoading: Ref<boolean>
  tplLoading: Ref<boolean>
  exportLoading: Ref<boolean>
  previewRaw: Ref<Record<string, unknown> | null>
  previewStats: ComputedRef<PreviewStats | null>
  previewWorkbookUrl: ComputedRef<string | null>
  issueRows: ComputedRef<PreviewIssue[]>
  onFile: (u: UploadFile) => void
  triggerBlobDownload: (blob: Blob, filename: string) => void
}

/**
 * upload→preview→apply 三步导入向导的共享状态。
 * 实际 API 调用由调用方按 domain 自行接(后端 endpoint 不一致,无法在此封装)。
 */
export function useImportWizard(): ImportWizardState {
  const step = ref(0)
  const file = ref<File | null>(null)
  const uploadToken = ref('')
  const upLoading = ref(false)
  const pvLoading = ref(false)
  const wbLoading = ref(false)
  const tplLoading = ref(false)
  const exportLoading = ref(false)
  const previewRaw = ref<Record<string, unknown> | null>(null)

  const previewStats = computed<PreviewStats | null>(() => {
    const p = previewRaw.value
    if (!p) return null
    const total = typeof p.totalRows === 'number' ? p.totalRows : undefined
    const valid = typeof p.validRows === 'number' ? p.validRows : undefined
    const invalid = typeof p.invalidRows === 'number' ? p.invalidRows : undefined
    if (total === undefined && valid === undefined) return null
    const changeSummary =
      p.changeSummary && typeof p.changeSummary === 'object'
        ? (p.changeSummary as Record<string, unknown>)
        : {}
    const insert = typeof changeSummary.insertRows === 'number' ? changeSummary.insertRows : 0
    const update = typeof changeSummary.updateRows === 'number' ? changeSummary.updateRows : 0
    return { total: total ?? '—', valid: valid ?? '—', invalid: invalid ?? '—', insert, update }
  })

  const previewWorkbookUrl = computed<string | null>(() => {
    const url = previewRaw.value?.previewWorkbookUrl
    return typeof url === 'string' && url ? url : null
  })

  const issueRows = computed<PreviewIssue[]>(() => {
    const p = previewRaw.value
    if (!p || !Array.isArray(p.issues)) return []
    return (p.issues as Record<string, unknown>[]).map((i) => ({
      sheetName: String(i.sheetName ?? ''),
      rowNo: i.rowNo,
      messages: Array.isArray(i.messages)
        ? (i.messages as string[]).join('; ')
        : String(i.messages ?? ''),
    }))
  })

  function onFile(u: UploadFile) {
    file.value = u.raw ?? null
  }

  function triggerBlobDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return {
    step,
    file,
    uploadToken,
    upLoading,
    pvLoading,
    wbLoading,
    tplLoading,
    exportLoading,
    previewRaw,
    previewStats,
    previewWorkbookUrl,
    issueRows,
    onFile,
    triggerBlobDownload,
  }
}
