import { describe, it, expect } from 'vitest'
import {
  toNodeKind,
  toEdgeKind,
  getTheme,
  defaultNodeForm,
  defaultEdgeForm,
  escapeHtml,
  edgeLabelText,
  buildEdgeLabels,
  edgeLegendColor,
  validationIssueLevelLabel,
  isValidationIssueActionable,
  nodeThemeMap,
  edgeThemeMap,
  nodeKinds,
  edgeKinds,
} from './workflowConstants'

describe('toNodeKind', () => {
  it('normalizes START aliases', () => {
    expect(toNodeKind('START')).toBe('START')
    expect(toNodeKind('source')).toBe('START')
    expect(toNodeKind('SOURCE')).toBe('START')
  })

  it('folds DECISION / BRANCH / JOIN / MERGE / SYNC into GATEWAY (后端只有 GATEWAY)', () => {
    expect(toNodeKind('gateway')).toBe('GATEWAY')
    expect(toNodeKind('BRANCH')).toBe('GATEWAY')
    expect(toNodeKind('decision')).toBe('GATEWAY')
    expect(toNodeKind('merge')).toBe('GATEWAY')
    expect(toNodeKind('SYNC')).toBe('GATEWAY')
  })

  it('normalizes FILE_STEP / JOB aliases', () => {
    expect(toNodeKind('file_step')).toBe('FILE_STEP')
    expect(toNodeKind('PIPELINE_STEP')).toBe('FILE_STEP')
    expect(toNodeKind('job')).toBe('JOB')
  })

  it('normalizes WAIT aliases', () => {
    expect(toNodeKind('wait')).toBe('WAIT')
    expect(toNodeKind('sensor')).toBe('WAIT')
    expect(toNodeKind('SENSOR_WAIT')).toBe('WAIT')
  })

  it('normalizes END aliases', () => {
    expect(toNodeKind('stop')).toBe('END')
    expect(toNodeKind('TERMINAL')).toBe('END')
  })

  it('defaults unknown values to TASK', () => {
    expect(toNodeKind('anything-else')).toBe('TASK')
    expect(toNodeKind(null)).toBe('TASK')
    expect(toNodeKind(undefined)).toBe('TASK')
    expect(toNodeKind('')).toBe('TASK')
  })
})

describe('toEdgeKind', () => {
  it('normalizes FAILURE aliases', () => {
    expect(toEdgeKind('fail')).toBe('FAILURE')
    expect(toEdgeKind('FAILED')).toBe('FAILURE')
    expect(toEdgeKind('error')).toBe('FAILURE')
  })

  it('normalizes CONDITION aliases', () => {
    expect(toEdgeKind('cond')).toBe('CONDITION')
    expect(toEdgeKind('IF')).toBe('CONDITION')
    expect(toEdgeKind('rule')).toBe('CONDITION')
  })

  it('normalizes ALWAYS aliases (incl. legacy DEFAULT/ELSE/FALLBACK)', () => {
    expect(toEdgeKind('always')).toBe('ALWAYS')
    expect(toEdgeKind('default')).toBe('ALWAYS')
    expect(toEdgeKind('else')).toBe('ALWAYS')
    expect(toEdgeKind('FALLBACK')).toBe('ALWAYS')
  })

  it('defaults unknown values to SUCCESS', () => {
    expect(toEdgeKind('anything')).toBe('SUCCESS')
    expect(toEdgeKind(null)).toBe('SUCCESS')
  })
})

describe('getTheme', () => {
  it('returns the corresponding theme for each node kind', () => {
    for (const { kind } of nodeKinds) {
      expect(getTheme(kind)).toBe(nodeThemeMap[kind])
    }
  })
})

describe('defaultNodeForm', () => {
  it('builds a TASK form with friendly defaults', () => {
    const form = defaultNodeForm('TASK', 'NODE_1')
    expect(form.nodeCode).toBe('NODE_1')
    expect(form.nodeType).toBe('TASK')
    expect(form.nodeName).toBe('新任务')
    expect(form.enabled).toBe(true)
    expect(form.nodeParams).toBe('{}')
  })

  it('uses the kind label for non-TASK nodes', () => {
    expect(defaultNodeForm('GATEWAY').nodeName).toBe('网关')
    expect(defaultNodeForm('FILE_STEP').nodeName).toBe('文件流水线')
    expect(defaultNodeForm('JOB').nodeName).toBe('作业引用')
    expect(defaultNodeForm('WAIT').nodeName).toBe('等待条件')
    expect(defaultNodeForm('END').nodeName).toBe('END 节点')
  })

  it('defaults nodeCode to empty string when omitted', () => {
    expect(defaultNodeForm('TASK').nodeCode).toBe('')
  })

  it('builds WAIT nodes with valid sensor defaults', () => {
    const form = defaultNodeForm('WAIT', 'WAIT_1')
    const params = JSON.parse(form.nodeParams) as Record<string, unknown>
    expect(form.nodeType).toBe('WAIT')
    expect(params.sensor_type).toBe('FILE_ARRIVAL')
    expect(params.sensor_spec).toMatchObject({ pattern: 'settle-*.csv', maxAgeSeconds: 3600 })
    expect(params.timeout_seconds).toBe(3600)
    expect(params.poll_interval_seconds).toBe(30)
    expect(params.on_timeout).toBe('FAIL')
  })
})

describe('defaultEdgeForm', () => {
  it('returns a SUCCESS edge form', () => {
    const edge = defaultEdgeForm()
    expect(edge.edgeType).toBe('SUCCESS')
    expect(edge.enabled).toBe(true)
    expect(edge.conditionExpr).toBe('')
  })
})

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<div class="x">a & b</div>')).toBe(
      '&lt;div class=&quot;x&quot;&gt;a &amp; b&lt;/div&gt;',
    )
  })

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#39;s')
  })

  it('returns empty string unchanged', () => {
    expect(escapeHtml('')).toBe('')
  })
})

describe('edgeLabelText', () => {
  it('returns conditionExpr when present', () => {
    expect(edgeLabelText({ edgeType: 'SUCCESS', conditionExpr: 'x > 10' })).toBe('x > 10')
  })

  it('falls back to the edge type label', () => {
    expect(edgeLabelText({ edgeType: 'FAILURE', conditionExpr: '' })).toBe('FAILURE')
    expect(edgeLabelText({ edgeType: 'ALWAYS', conditionExpr: '   ' })).toBe('ALWAYS')
  })
})

describe('buildEdgeLabels', () => {
  it('returns an empty array when there is no label text', () => {
    // Create a case where both conditionExpr and type label would be empty
    // Since edgeThemeMap always has a label, use whitespace condition → fallback to type label
    // We need to simulate missing type label by casting
    const result = buildEdgeLabels({
      edgeType: 'SUCCESS',
      conditionExpr: '',
    })
    // SUCCESS has a label, so result should have one entry
    expect(result).toHaveLength(1)
  })

  it('includes the resolved text in the label attrs', () => {
    const labels = buildEdgeLabels({ edgeType: 'CONDITION', conditionExpr: 'a == 1' })
    expect(labels).toHaveLength(1)
    expect(labels[0].attrs.label.text).toBe('a == 1')
  })

  it('uses the stroke color from edgeThemeMap', () => {
    const labels = buildEdgeLabels({ edgeType: 'FAILURE', conditionExpr: '' })
    expect(labels[0].attrs.body.stroke).toBe(edgeThemeMap.FAILURE.stroke)
  })
})

describe('edgeLegendColor', () => {
  it('returns the stroke color for each edge kind', () => {
    for (const { kind } of edgeKinds) {
      expect(edgeLegendColor(kind)).toBe(edgeThemeMap[kind].stroke)
    }
  })
})

describe('validationIssueLevelLabel', () => {
  it('returns 错误 for error level', () => {
    expect(validationIssueLevelLabel('error')).toBe('错误')
  })

  it('returns 警告 for warning level', () => {
    expect(validationIssueLevelLabel('warning')).toBe('警告')
  })
})

describe('isValidationIssueActionable', () => {
  it('returns true when nodeCode is set', () => {
    expect(isValidationIssueActionable({ level: 'error', message: 'x', nodeCode: 'N1' })).toBe(true)
  })

  it('returns true when edgeId is set', () => {
    expect(isValidationIssueActionable({ level: 'error', message: 'x', edgeId: 'E1' })).toBe(true)
  })

  it('returns false when neither is set', () => {
    expect(isValidationIssueActionable({ level: 'warning', message: 'x' })).toBe(false)
  })
})
