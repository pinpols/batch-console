import { describe, expect, it } from 'vitest'
import { jobInstanceTriggerSource } from './jobInstanceTrigger'

describe('作业实例触发来源', () => {
  it('工作流派发的子实例展示根运行的触发来源', () => {
    expect(jobInstanceTriggerSource({ triggerType: 'EVENT', rootTriggerType: 'MANUAL' })).toBe(
      'MANUAL',
    )
  })
  it('没有根运行时退回实例自身的触发类型', () => {
    expect(jobInstanceTriggerSource({ triggerType: 'API', rootTriggerType: null })).toBe('API')
  })
  it('两者都缺失时返回 undefined，由调用方显示占位', () => {
    expect(jobInstanceTriggerSource({})).toBeUndefined()
  })
})
