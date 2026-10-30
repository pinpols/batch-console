import { describe, expect, it } from 'vitest'
import {
  runLifecycleAction,
  canCancelWorkflowExecution,
  canTerminateWorkflowExecution,
} from './runControls'

describe('运行控制', () => {
  it('管理员只在运行中暂停、暂停后恢复', () => {
    expect(runLifecycleAction('RUNNING', true)).toBe('pause')
    expect(runLifecycleAction('PAUSED', true)).toBe('resume')
    for (const status of ['CREATED', 'SUCCESS', 'FAILED', 'CANCELLED', 'TERMINATED', undefined]) {
      expect(runLifecycleAction(status, true)).toBeNull()
    }
  })

  it('只读角色或写冻结不能发起生命周期操作', () => {
    expect(runLifecycleAction('RUNNING', false)).toBeNull()
    expect(runLifecycleAction('PAUSED', false)).toBeNull()
    expect(canCancelWorkflowExecution('RUNNING', false)).toBe(false)
    expect(canTerminateWorkflowExecution('RUNNING', false)).toBe(false)
  })

  it('取消与终止遵循当前后端合法前态', () => {
    expect(canCancelWorkflowExecution('CREATED', true)).toBe(true)
    expect(canCancelWorkflowExecution('RUNNING', true)).toBe(true)
    expect(canTerminateWorkflowExecution('CREATED', true)).toBe(false)
    expect(canTerminateWorkflowExecution('RUNNING', true)).toBe(true)
    for (const status of ['PAUSED', 'SUCCESS', 'FAILED', 'TERMINATED']) {
      expect(canCancelWorkflowExecution(status, true)).toBe(false)
      expect(canTerminateWorkflowExecution(status, true)).toBe(false)
    }
  })
})
