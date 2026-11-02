import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useDesignerStore } from './useDesignerStore'

describe('设计器检查器草稿', () => {
  beforeEach(() => setActivePinia(createPinia()))

  function setup() {
    const store = useDesignerStore()
    store.reset({
      nodes: [
        {
          id: 'a',
          nodeCode: 'a',
          nodeName: '原名称',
          nodeType: 'JOB',
          x: 0,
          y: 0,
          attrs: { skipExpression: 'old' },
        },
        { id: 'b', nodeCode: 'b', nodeName: 'B', nodeType: 'END', x: 1, y: 0 },
      ],
      edges: [
        { id: 'e', source: 'a', target: 'b', label: 'old', attrs: { edgeType: 'CONDITION' } },
      ],
    })
    store.setMeta({ tenantId: 'ta', id: 1 })
    store.setLock({ isMine: true, lockedBy: 'me', expiresAt: '' })
    return store
  }

  it('失锁后切换选中项仍保留多元素草稿，恢复锁后可一起应用并撤销', () => {
    const store = setup()
    store.setInspectorDraft('nodeName', 'a', '待保存')
    store.setInspectorDraft('edgeCondition', 'e', 'x > 10')
    store.setLock({ isMine: false, lockedBy: 'other', expiresAt: '' })
    store.setSelection(['b'])
    expect(store.getInspectorDraft('nodeName', 'a')?.value).toBe('待保存')
    expect(store.applyInspectorDrafts()).toBe(false)
    expect(store.nodes[0].nodeName).toBe('原名称')
    store.setLock({ isMine: true, lockedBy: 'me', expiresAt: '' })
    expect(store.applyInspectorDrafts()).toBe(true)
    expect(store.nodes[0].nodeName).toBe('待保存')
    expect(store.edges[0].label).toBe('x > 10')
    expect(store.inspectorDrafts).toHaveLength(0)
    store.undo()
    expect(store.nodes[0].nodeName).toBe('原名称')
    store.undo()
    expect(store.edges[0].label).toBe('old')
  })

  it('底层值变化或元素删除时不自动覆盖草稿，用户可明确丢弃或覆盖', () => {
    const store = setup()
    store.setInspectorDraft('nodeName', 'a', '草稿')
    store.updateNode('a', { nodeName: '其他更改' })
    expect(store.inspectorDraftConflicts).toHaveLength(1)
    expect(store.applyInspectorDrafts()).toBe(false)
    expect(store.nodes[0].nodeName).toBe('其他更改')
    expect(store.resolveInspectorDraft('nodeName', 'a', 'apply')).toBe(true)
    expect(store.nodes[0].nodeName).toBe('草稿')
    store.setInspectorDraft('edgeCondition', 'e', '草稿条件')
    store.deleteEdge('e')
    expect(store.applyInspectorDrafts()).toBe(false)
    expect(store.resolveInspectorDraft('edgeCondition', 'e', 'apply')).toBe(false)
    expect(store.resolveInspectorDraft('edgeCondition', 'e', 'discard')).toBe(true)
    expect(store.inspectorDrafts).toHaveLength(0)
  })

  it('重置作用域清除草稿，JSON 替换不能静默丢弃草稿', () => {
    const store = setup()
    store.setInspectorDraft('nodeName', 'a', '草稿')
    expect(store.replaceGraphFromJson({ nodes: [], edges: [] })).toBe(false)
    expect(store.getInspectorDraft('nodeName', 'a')?.value).toBe('草稿')
    store.reset()
    store.setMeta({ tenantId: 'tb', id: 2 })
    expect(store.inspectorDrafts).toHaveLength(0)
  })

  it('画布汇聚方式已变更时不能把旧阈值草稿写入其他模式', () => {
    const store = setup()
    store.nodes.push({
      id: 'g',
      nodeCode: 'g',
      nodeName: 'g',
      nodeType: 'GATEWAY',
      x: 0,
      y: 0,
      attrs: { joinMode: 'N_OF', joinThreshold: 1 },
    })
    store.edges.push({ id: 'ag', source: 'a', target: 'g' }, { id: 'bg', source: 'b', target: 'g' })
    store.setInspectorDraft('gatewayThreshold', 'g', '2')
    store.updateNode('g', { attrs: { joinMode: 'ANY', joinThreshold: undefined } })
    expect(store.applyInspectorDrafts()).toBe(false)
    expect(store.resolveInspectorDraft('gatewayThreshold', 'g', 'apply')).toBe(false)
    expect(store.nodes.find((node) => node.id === 'g')?.attrs?.joinThreshold).toBeUndefined()
    expect(store.getInspectorDraft('gatewayThreshold', 'g')?.value).toBe('2')
  })
})
