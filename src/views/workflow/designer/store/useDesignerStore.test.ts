import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useDesignerStore } from './useDesignerStore'

describe('useDesignerStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('addNode pushes to nodes + marks dirty + records undo step', () => {
    const s = useDesignerStore()
    s.addNode({ nodeCode: 'a', nodeType: 'START', x: 10, y: 20 })
    expect(s.nodes).toHaveLength(1)
    expect(s.nodes[0].nodeCode).toBe('a')
    expect(s.dirty).toBe(true)
    expect(s.canUndo).toBe(true)
  })

  it('addNode auto-selects the new node (inspector focus)', () => {
    const s = useDesignerStore()
    s.addNode({ nodeCode: 'a', nodeType: 'START', x: 0, y: 0 })
    s.addNode({ nodeCode: 'b', nodeType: 'JOB', x: 100, y: 0 })
    expect(Array.from(s.selectedIds)).toEqual(['b'])
  })

  it('addEdge dedupes self-loop and duplicates', () => {
    const s = useDesignerStore()
    s.addNode({ nodeCode: 'a', nodeType: 'START', x: 0, y: 0 })
    s.addNode({ nodeCode: 'b', nodeType: 'JOB', x: 100, y: 0 })
    s.addEdge({ source: 'a', target: 'b' })
    s.addEdge({ source: 'a', target: 'b' }) // dupe
    s.addEdge({ source: 'a', target: 'a' }) // self
    expect(s.edges).toHaveLength(1)
  })

  it('updateEdge preserves execution semantics and can clear a condition label', () => {
    const s = useDesignerStore()
    s.addEdge({ source: 'gateway', target: 'fallback', label: 'ctx.retryable' })
    const edge = s.edges[0]!
    edge.attrs = { edgeType: 'CONDITION', enabled: true }

    s.updateEdge(edge.id, { label: undefined, attrs: { edgeType: 'FAILURE', enabled: false } })

    expect(s.edges[0]).toMatchObject({
      label: undefined,
      attrs: { edgeType: 'FAILURE', enabled: false },
    })
    s.undo()
    expect(s.edges[0]).toMatchObject({
      label: 'ctx.retryable',
      attrs: { edgeType: 'CONDITION', enabled: true },
    })
  })

  it('deleteNode cascades incident edges', () => {
    const s = useDesignerStore()
    s.addNode({ nodeCode: 'a', nodeType: 'START', x: 0, y: 0 })
    s.addNode({ nodeCode: 'b', nodeType: 'JOB', x: 100, y: 0 })
    s.addNode({ nodeCode: 'c', nodeType: 'END', x: 200, y: 0 })
    s.addEdge({ source: 'a', target: 'b' })
    s.addEdge({ source: 'b', target: 'c' })
    s.deleteNode('b')
    expect(s.nodes.map((n) => n.id).sort()).toEqual(['a', 'c'])
    expect(s.edges).toHaveLength(0)
  })

  it('undo restores prior snapshot', () => {
    const s = useDesignerStore()
    s.addNode({ nodeCode: 'a', nodeType: 'START', x: 0, y: 0 })
    s.addNode({ nodeCode: 'b', nodeType: 'JOB', x: 50, y: 0 })
    expect(s.nodes).toHaveLength(2)
    s.undo()
    expect(s.nodes).toHaveLength(1)
    expect(s.nodes[0].nodeCode).toBe('a')
  })

  it('redo replays undone change', () => {
    const s = useDesignerStore()
    s.addNode({ nodeCode: 'a', nodeType: 'START', x: 0, y: 0 })
    s.addNode({ nodeCode: 'b', nodeType: 'JOB', x: 50, y: 0 })
    s.undo()
    s.redo()
    expect(s.nodes).toHaveLength(2)
    expect(s.canRedo).toBe(false)
  })

  it('markClean flips dirty back to false; subsequent mutation re-dirties', () => {
    const s = useDesignerStore()
    s.addNode({ nodeCode: 'a', nodeType: 'START', x: 0, y: 0 })
    expect(s.dirty).toBe(true)
    s.markClean()
    expect(s.dirty).toBe(false)
    s.addNode({ nodeCode: 'b', nodeType: 'END', x: 100, y: 0 })
    expect(s.dirty).toBe(true)
  })

  // P2:套模板 = reset(新内容) 后必须标脏(reset 会把 dirty 置 false)
  it('reset clears dirty but markDirty restores it (template-apply contract)', () => {
    const s = useDesignerStore()
    s.addNode({ nodeCode: 'a', nodeType: 'START', x: 0, y: 0 })
    expect(s.dirty).toBe(true)
    // 模拟 TemplateLibrary.apply():reset 新内容后补标脏
    s.reset({
      nodes: [{ id: 'x', nodeCode: 'x', nodeName: 'x', nodeType: 'START', x: 0, y: 0 }],
      edges: [],
    })
    expect(s.dirty).toBe(false) // reset 自身把 dirty 清掉
    s.markDirty()
    expect(s.dirty).toBe(true) // 套模板后画布应被视为「未保存」
  })

  // P4:一次拖拽 = 一个可撤销单元 —— 拖前 pushUndo(快照旧位置)+ moveNode(写新位置)
  it('pushUndo before moveNode makes a drag undoable back to the pre-drag position', () => {
    const s = useDesignerStore()
    s.addNode({ nodeCode: 'a', nodeType: 'JOB', x: 10, y: 20 })
    s.markClean()
    // 模拟 useX6Graph 的 node:moved 桥接:先 pushUndo(此刻 store 仍是旧坐标),再 moveNode
    s.pushUndo()
    s.moveNode('a', 200, 300)
    expect(s.nodes[0].x).toBe(200)
    expect(s.nodes[0].y).toBe(300)
    expect(s.canUndo).toBe(true)
    s.undo()
    expect(s.nodes[0].x).toBe(10)
    expect(s.nodes[0].y).toBe(20)
  })
})
