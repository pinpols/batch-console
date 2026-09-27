import { describe, expect, it } from 'vitest'
import { workerActionsForStatus } from './workerActions'

describe('workerActionsForStatus', () => {
  it('在线节点只展示下线和接管动作', () => {
    expect(workerActionsForStatus('ONLINE')).toEqual(['drain', 'offline', 'takeover'])
  })

  it('排空中节点不再展示排空和预热', () => {
    expect(workerActionsForStatus('DRAINING')).toEqual(['offline', 'takeover'])
  })

  it('离线节点只允许预热', () => {
    expect(workerActionsForStatus('OFFLINE')).toEqual(['warmup'])
  })

  it('已下线或未知状态不展示写操作', () => {
    expect(workerActionsForStatus('DECOMMISSIONED')).toEqual([])
    expect(workerActionsForStatus('UNKNOWN')).toEqual([])
  })
})
