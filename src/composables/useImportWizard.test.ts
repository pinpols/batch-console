import { describe, it, expect } from 'vitest'
import { useImportWizard } from './useImportWizard'

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

  it('total/valid 都缺失返回 null(没法判断"已预览")', () => {
    const w = useImportWizard()
    w.previewRaw.value = { issues: [] }
    expect(w.previewStats.value).toBeNull()
  })

  it('issueRows 把 messages 数组拼成分号串,缺字段降级空串', () => {
    const w = useImportWizard()
    w.previewRaw.value = {
      issues: [
        { sheetName: 'Job', rowNo: 3, messages: ['col A 缺失', 'col B 非法'] },
        { sheetName: 'File', rowNo: 1, messages: '单条字符串' },
        { sheetName: undefined, rowNo: undefined },
      ],
    }
    expect(w.issueRows.value).toEqual([
      { sheetName: 'Job', rowNo: 3, messages: 'col A 缺失; col B 非法' },
      { sheetName: 'File', rowNo: 1, messages: '单条字符串' },
      { sheetName: '', rowNo: undefined, messages: '' },
    ])
  })

  it('previewWorkbookUrl 仅当字段为非空字符串时返回值', () => {
    const w = useImportWizard()
    w.previewRaw.value = { previewWorkbookUrl: '' }
    expect(w.previewWorkbookUrl.value).toBeNull()
    w.previewRaw.value = { previewWorkbookUrl: 'https://x/y.xlsx' }
    expect(w.previewWorkbookUrl.value).toBe('https://x/y.xlsx')
  })
})
