// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import {
  workflowRunMermaidClassDefs,
  workflowRunStatusClass,
  workflowRunVisualCssVars,
} from './workflowStatusTheme'

afterEach(() => {
  document.documentElement.removeAttribute('style')
  document.documentElement.classList.remove('dark')
})

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

  it('状态色与全站语义 token 同源，CSS 变量随主题变化', () => {
    expect(workflowRunVisualCssVars['--workflow-run-running-fill']).toBe('var(--color-primary)')
    expect(workflowRunVisualCssVars['--workflow-run-success-fill']).toBe('var(--color-success)')
    expect(workflowRunVisualCssVars['--workflow-run-failed-fill']).toBe('var(--color-danger)')
    expect(workflowRunVisualCssVars['--workflow-run-waiting-fill']).toBe('var(--color-warning)')
  })

  it('Mermaid 类定义读取当前主题的 token 实际值', () => {
    document.documentElement.style.setProperty('--color-success', '#00aa00')
    expect(workflowRunMermaidClassDefs()).toContain('classDef success fill:#00aa00')
  })

  it('读取不到 token 时回落到浅色主题色板', () => {
    expect(workflowRunMermaidClassDefs()).toContain('classDef running fill:#1f4fd1')
  })
})
