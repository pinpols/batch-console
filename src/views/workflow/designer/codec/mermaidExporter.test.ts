import { describe, it, expect } from 'vitest'
import { exportMermaid } from './mermaidExporter'

describe('exportMermaid', () => {
  it('empty snapshot → header only', () => {
    const out = exportMermaid({ nodes: [], edges: [] })
    expect(out).toBe('graph TD')
  })

  it('linear DAG: START → JOB → END renders shapes and edges', () => {
    const out = exportMermaid({
      nodes: [
        { id: 's', nodeCode: 's', nodeName: 'Start', nodeType: 'START', x: 0, y: 0 },
        { id: 'j', nodeCode: 'j', nodeName: 'Job', nodeType: 'JOB', x: 100, y: 0 },
        { id: 'e', nodeCode: 'e', nodeName: 'End', nodeType: 'END', x: 200, y: 0 },
      ],
      edges: [
        { id: 'e1', source: 's', target: 'j' },
        { id: 'e2', source: 'j', target: 'e' },
      ],
    })
    expect(out).toContain('s(("Start"))')
    expect(out).toContain('j["Job"]')
    expect(out).toContain('e(("End"))')
    expect(out).toContain('s --> j')
    expect(out).toContain('j --> e')
  })

  it('GATEWAY with labeled branches renders diamond + labeled edges', () => {
    const out = exportMermaid({
      nodes: [
        { id: 'g', nodeCode: 'g', nodeName: 'gw', nodeType: 'GATEWAY', x: 0, y: 0 },
        { id: 'a', nodeCode: 'a', nodeName: 'A', nodeType: 'JOB', x: 100, y: 0 },
        { id: 'b', nodeCode: 'b', nodeName: 'B', nodeType: 'JOB', x: 100, y: 100 },
      ],
      edges: [
        { id: 'e1', source: 'g', target: 'a', label: 'yes' },
        { id: 'e2', source: 'g', target: 'b', label: 'no' },
      ],
    })
    expect(out).toContain('g{"gw"}')
    expect(out).toContain('g -->|yes| a')
    expect(out).toContain('g -->|no| b')
  })
})
