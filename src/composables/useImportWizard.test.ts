import { describe, it, expect } from 'vitest'
import {
  MAX_IMPORT_WORKBOOK_BYTES,
  resolvePreviewWorkbookUrl,
  useImportWizard,
  validateImportWorkbookFile,
} from './useImportWizard'

describe('useImportWizard — 初始状态', () => {
  it('step 从 0 开始,所有 loading 为 false,token / preview 为空', () => {
    const w = useImportWizard()
    expect(w.step.value).toBe(0)
    expect(w.uploadToken.value).toBe('')
    expect(w.file.value).toBeNull()
    expect(w.previewRaw.value).toBeNull()
    expect(w.upLoading.value).toBe(false)
    expect(w.pvLoading.value).toBe(false)
    expect(w.wbLoading.value).toBe(false)
    expect(w.tplLoading.value).toBe(false)
    expect(w.exportLoading.value).toBe(false)
  })

  it('previewStats null 当 preview 未加载', () => {
    const w = useImportWizard()
    expect(w.previewStats.value).toBeNull()
    expect(w.previewWorkbookUrl.value).toBeNull()
    expect(w.issueRows.value).toEqual([])
  })
})

describe('useImportWizard — preview 衍生数据', () => {
  it('previewRaw 设进 totalRows/validRows/invalidRows 后,previewStats 推导成功', () => {
    const w = useImportWizard()
    w.previewRaw.value = { totalRows: 100, validRows: 95, invalidRows: 5 }
    expect(w.previewStats.value).toEqual({
      total: 100,
      valid: 95,
      invalid: 5,
      insert: 0,
      update: 0,
    })
  })

  it('changeSummary.insertRows / updateRows 透传到 previewStats(Excel 维护场景)', () => {
    const w = useImportWizard()
    w.previewRaw.value = {
      totalRows: 10,
      validRows: 10,
      invalidRows: 0,
      changeSummary: { insertRows: 7, updateRows: 3 },
    }
    expect(w.previewStats.value).toMatchObject({ insert: 7, update: 3 })
  })

  it('预览存在问题明细时即使汇总无效数为零也阻止应用', () => {
    const w = useImportWizard()
    w.previewRaw.value = {
      totalRows: 51,
      validRows: 51,
      invalidRows: 0,
      issues: [{ sheetName: 'job_definition', rowNo: 4, message: '引用的模板不存在' }],
    }
    expect(w.hasBlockingIssues.value).toBe(true)
  })

  it('total/valid 都缺失返回 null(没法判断"已预览")', () => {
    const w = useImportWizard()
    w.previewRaw.value = { issues: [] }
    expect(w.previewStats.value).toBeNull()
  })

  it('issueRows 读取后端 message / columnName 字段,缺字段降级空串', () => {
    const w = useImportWizard()
    w.previewRaw.value = {
      issues: [
        { sheetName: 'job_definition', rowNo: 3, columnName: 'job_code', message: '不能为空' },
        {
          sheetName: 'file_template_config',
          rowNo: 1,
          columnName: 'template_code',
          message: '不存在',
        },
        { sheetName: undefined, rowNo: undefined },
      ],
    }
    expect(w.issueRows.value).toEqual([
      { sheetName: 'job_definition', rowNo: 3, columnName: 'job_code', messages: '不能为空' },
      {
        sheetName: 'file_template_config',
        rowNo: 1,
        columnName: 'template_code',
        messages: '不存在',
      },
      { sheetName: '', rowNo: undefined, messages: '' },
    ])
  })

  it('errorRows 读取后端 errorRows(整行值 + 问题),缺字段降级空', () => {
    const w = useImportWizard()
    w.previewRaw.value = {
      errorRows: [
        {
          sheetName: 'file_channel_config',
          rowNo: 2,
          values: { channel_code: 'c1', channel_name: '' },
          messages: ['channel_name 不能为空'],
        },
        { sheetName: undefined, rowNo: undefined },
      ],
    }
    expect(w.errorRows.value).toEqual([
      {
        sheetName: 'file_channel_config',
        rowNo: 2,
        values: { channel_code: 'c1', channel_name: '' },
        messages: ['channel_name 不能为空'],
      },
      { sheetName: '', rowNo: 0, values: {}, messages: [] },
    ])
  })

  it('errorRows 缺 errorRows 字段时为空数组', () => {
    const w = useImportWizard()
    w.previewRaw.value = { issues: [] }
    expect(w.errorRows.value).toEqual([])
  })

  it('previewWorkbookUrl 仅返回安全的相对路径或 HTTPS 地址', () => {
    const w = useImportWizard()
    w.previewRaw.value = { previewWorkbookUrl: '' }
    expect(w.previewWorkbookUrl.value).toBeNull()
    w.previewRaw.value = { previewWorkbookUrl: 'https://x/y.xlsx' }
    expect(w.previewWorkbookUrl.value).toBe('https://x/y.xlsx')
    w.previewRaw.value = { previewWorkbookUrl: '/api/downloads/y.xlsx' }
    expect(w.previewWorkbookUrl.value).toBe('/api/downloads/y.xlsx')
    w.previewRaw.value = { previewWorkbookUrl: 'javascript:alert(1)' }
    expect(w.previewWorkbookUrl.value).toBeNull()
  })
})

describe('useImportWizard — 文件与下载边界', () => {
  const workbook = (name: string, size: number) => ({ name, size }) as File

  it('仅接受不超过 50 MB 的 xlsx 文件', () => {
    expect(
      validateImportWorkbookFile(workbook('tenant.xlsx', MAX_IMPORT_WORKBOOK_BYTES)),
    ).toBeNull()
    expect(validateImportWorkbookFile(workbook('tenant.xls', 1024))).toBe('unsupported-type')
    expect(validateImportWorkbookFile(workbook('tenant.xlsm', 1024))).toBe('unsupported-type')
    expect(validateImportWorkbookFile(workbook('tenant.xlsx', MAX_IMPORT_WORKBOOK_BYTES + 1))).toBe(
      'too-large',
    )
  })

  it('拒绝脚本、data、blob、协议相对和外部 HTTP 下载地址', () => {
    const origin = 'http://localhost:5173'
    expect(resolvePreviewWorkbookUrl('javascript:alert(1)', origin)).toBeNull()
    expect(resolvePreviewWorkbookUrl('data:text/plain,test', origin)).toBeNull()
    expect(resolvePreviewWorkbookUrl('blob:http://localhost:5173/id', origin)).toBeNull()
    expect(resolvePreviewWorkbookUrl('//evil.example/file.xlsx', origin)).toBeNull()
    expect(resolvePreviewWorkbookUrl('http://evil.example/file.xlsx', origin)).toBeNull()
  })

  it('本地 HTTP 仅允许同源地址，生产地址要求 HTTPS', () => {
    expect(
      resolvePreviewWorkbookUrl(
        'http://localhost:5173/api/downloads/file.xlsx',
        'http://localhost:5173',
      ),
    ).toBe('http://localhost:5173/api/downloads/file.xlsx')
    expect(
      resolvePreviewWorkbookUrl(
        'http://console.example/api/downloads/file.xlsx',
        'https://console.example',
      ),
    ).toBeNull()
    expect(resolvePreviewWorkbookUrl('https://files.example/file.xlsx')).toBe(
      'https://files.example/file.xlsx',
    )
  })
})
