import { describe, expect, it } from 'vitest'
import { workflowRunMermaidClassDefs, workflowRunStatusClass } from './workflowStatusTheme'

describe('workflowStatusTheme', () => {
  it('maps workflow run statuses to visual classes', () => {
    expect(workflowRunStatusClass('RUNNING')).toBe('running')
    expect(workflowRunStatusClass('SUCCEEDED')).toBe('success')
    expect(workflowRunStatusClass('PARTIAL_FAILED')).toBe('failed')
    expect(workflowRunStatusClass('READY')).toBe('waiting')
    expect(workflowRunStatusClass('TERMINATED')).toBe('cancelled')
    expect(workflowRunStatusClass('UNKNOWN')).toBeNull()
  })

  it('emits mermaid class definitions for every visual class', () => {
    expect(workflowRunMermaidClassDefs()).toContain('classDef running')
    expect(workflowRunMermaidClassDefs()).toContain('classDef success')
    expect(workflowRunMermaidClassDefs()).toContain('classDef failed')
    expect(workflowRunMermaidClassDefs()).toContain('classDef waiting')
    expect(workflowRunMermaidClassDefs()).toContain('classDef cancelled')
  })
})
