import { describe, it, expect } from 'vitest'
import type { MetaOption } from '@/api/meta'
import { resolveStatusMeta, STATUS_TAG_CATEGORIES } from './statusTagResolve'

const enumsWith = (obj: Record<string, MetaOption[]>) => obj

describe('resolveStatusMeta — label 优先级', () => {
  it('returns label from /meta/enums when available (backend-backed category)', () => {
    const metaEnums = enumsWith({
      instanceStatus: [
        { value: 'RUNNING', label: '运行中(后端)' },
        { value: 'FAILED', label: '失败(后端)' },
      ],
    })
    expect(resolveStatusMeta('RUNNING', 'instance', metaEnums)).toEqual({
      label: '运行中(后端)',
      type: 'success',
    })
  })

  it('falls back to local meta when category has no metaKeys (yn/log/batchDay/sla)', () => {
    expect(resolveStatusMeta('true', 'yn', null)).toEqual({ label: '是', type: 'success' })
    expect(resolveStatusMeta('INFO', 'log', null)).toEqual({ label: 'INFO', type: 'info' })
    expect(resolveStatusMeta('OPEN', 'batchDay', null)).toEqual({ label: '开窗', type: 'success' })
    expect(resolveStatusMeta('BREACH', 'sla', null)).toEqual({ label: '违规', type: 'danger' })
  })

  it('falls back to raw value when metaEnums undefined and no local label', () => {
    expect(resolveStatusMeta('RUNNING', 'instance', undefined)).toEqual({
      label: 'RUNNING',
      type: 'success', // 颜色仍来自本地 color map
    })
  })

  it('falls back to fallback arg when value empty', () => {
    expect(resolveStatusMeta('', 'instance', undefined, '暂无')).toEqual({
      label: '暂无',
      type: 'info',
    })
  })

  it('falls back to em-dash when value empty and no fallback', () => {
    expect(resolveStatusMeta('', 'instance', undefined)).toEqual({ label: '—', type: 'info' })
  })

  it('skips empty metaEnums group and walks to local/fallback', () => {
    expect(resolveStatusMeta('UNKNOWN_X', 'instance', {})).toEqual({
      label: 'UNKNOWN_X',
      type: 'info',
    })
  })

  it('tries multiple metaKeys in order (deliveryStatus fallback to alternate key)', () => {
    const metaEnums = enumsWith({
      deliveryStatus: [{ value: 'SUCCESS', label: '备选 key 命中' }],
    })
    // 首选 key webhookDeliveryStatus 不存在,应退到 deliveryStatus
    expect(resolveStatusMeta('SUCCESS', 'deliveryStatus', metaEnums).label).toBe('备选 key 命中')
  })
})

describe('resolveStatusMeta — type 解析', () => {
  it('returns color from local color map', () => {
    expect(resolveStatusMeta('FAILED', 'instance', null).type).toBe('danger')
    expect(resolveStatusMeta('NORMAL', 'trigger', null).type).toBe('success')
    expect(resolveStatusMeta('EMAIL', 'channelType', null).type).toBe('primary')
  })

  it('returns info for unknown values when no local label override', () => {
    expect(resolveStatusMeta('UNKNOWN_STATUS', 'instance', null).type).toBe('info')
  })

  it('uses local.type for categories without color map (yn/log/batchDay/sla)', () => {
    expect(resolveStatusMeta('false', 'yn', null).type).toBe('info')
    expect(resolveStatusMeta('ERROR', 'log', null).type).toBe('danger')
    expect(resolveStatusMeta('PROCESSING', 'batchDay', null).type).toBe('primary')
  })
})

describe('resolveStatusMeta — 后端新增 enum 值只靠颜色表兜底', () => {
  it('backend adds new value → backend label shows, color falls to info (no local crash)', () => {
    const metaEnums = enumsWith({
      triggerStatus: [{ value: 'SUSPENDED', label: '已中止' }],
    })
    // 前端 triggerStatusColor 没有 SUSPENDED —— 颜色 info,label 来自后端
    expect(resolveStatusMeta('SUSPENDED', 'trigger', metaEnums)).toEqual({
      label: '已中止',
      type: 'info',
    })
  })
})

describe('STATUS_TAG_CATEGORIES —— 配置完整性', () => {
  it('every backend-backed category declares at least one metaKey', () => {
    const frontendOnly: string[] = ['log', 'yn', 'batchDay', 'sla']
    for (const [cat, cfg] of Object.entries(STATUS_TAG_CATEGORIES)) {
      if (frontendOnly.includes(cat)) {
        expect(cfg.metaKeys, `${cat} should have no metaKeys`).toBeUndefined()
        expect(cfg.local, `${cat} should have local`).toBeDefined()
      } else {
        expect(cfg.metaKeys, `${cat} should have metaKeys`).toBeDefined()
        expect(cfg.metaKeys!.length).toBeGreaterThan(0)
      }
    }
  })
})
