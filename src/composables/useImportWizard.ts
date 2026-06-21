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
  /** 后端返字段,之前前端丢弃 — 现在用于在表里显式列"出错的列" */
  columnName?: string
  messages: string
}

export interface SheetStats {
  sheetName: string
  total: number
  valid: number
  invalid: number
}

/** 出错行明细(后端 errorRows):整行单元格值 + 该行所有问题,供预览页内联编辑。 */
export interface PreviewErrorRow {
  sheetName: string
  rowNo: number
  values: Record<string, string>
  messages: string[]
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
  /** 后端 sheets[]:每张 sheet 的 valid/invalid 拆分,定位"哪张表坏了" */
  sheetStats: ComputedRef<SheetStats[]>
  /** 后端 errorRows[]:出错行整行单元格值 + 问题,供预览页内联编辑 */
  errorRows: ComputedRef<PreviewErrorRow[]>
  /** 是否存在阻塞性错误:`invalidRows > 0`。Apply 应当 disabled。 */
  hasBlockingIssues: ComputedRef<boolean>
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
      columnName: typeof i.columnName === 'string' ? i.columnName : undefined,
      messages: Array.isArray(i.messages)
        ? (i.messages as string[]).join('; ')
        : Array.isArray(i.message)
          ? (i.message as string[]).join('; ')
          : String(i.messages ?? i.message ?? ''),
    }))
  })

  const sheetStats = computed<SheetStats[]>(() => {
    const p = previewRaw.value
    if (!p || !Array.isArray(p.sheets)) return []
    return (p.sheets as Record<string, unknown>[]).map((s) => ({
      sheetName: String(s.sheetName ?? ''),
      total: typeof s.totalRows === 'number' ? s.totalRows : 0,
      valid: typeof s.validRows === 'number' ? s.validRows : 0,
      invalid: typeof s.invalidRows === 'number' ? s.invalidRows : 0,
    }))
  })

  const errorRows = computed<PreviewErrorRow[]>(() => {
    const p = previewRaw.value
    if (!p || !Array.isArray(p.errorRows)) return []
    return (p.errorRows as Record<string, unknown>[]).map((r) => ({
      sheetName: String(r.sheetName ?? ''),
      rowNo: typeof r.rowNo === 'number' ? r.rowNo : Number(r.rowNo ?? 0),
      values: r.values && typeof r.values === 'object' ? (r.values as Record<string, string>) : {},
      messages: Array.isArray(r.messages) ? (r.messages as string[]) : [],
    }))
  })

  const hasBlockingIssues = computed<boolean>(() => {
    const inv = previewStats.value?.invalid
    if (typeof inv === 'number') return inv > 0
    return issueRows.value.length > 0
  })

  function onFile(u: UploadFile) {
    file.value = u.raw ?? null
  }

  function setRawFile(f: File) {
    file.value = f
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
    sheetStats,
    errorRows,
    hasBlockingIssues,
    onFile,
    setRawFile,
    triggerBlobDownload,
  }
}
