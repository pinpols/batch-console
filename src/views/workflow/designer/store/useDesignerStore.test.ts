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

  it('addEdge dedupes self-loop and duplicates', () => {
    const s = useDesignerStore()
    s.addNode({ nodeCode: 'a', nodeType: 'START', x: 0, y: 0 })
    s.addNode({ nodeCode: 'b', nodeType: 'JOB', x: 100, y: 0 })
    s.addEdge({ source: 'a', target: 'b' })
    s.addEdge({ source: 'a', target: 'b' }) // dupe
    s.addEdge({ source: 'a', target: 'a' }) // self
    expect(s.edges).toHaveLength(1)
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
})
