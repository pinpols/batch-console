import { describe, expect, it } from 'vitest'
import { toWorkflowSaveEdges, toWorkflowSaveNodes } from './workflowSaveMapper'

describe('workflowSaveMapper', () => {
  it('preserves every persisted node execution field during full save', () => {
    const [node] = toWorkflowSaveNodes([
      {
        nodeCode: 'load_orders',
        nodeName: 'Load orders',
        nodeType: 'JOB',
        x: 120,
        y: 240,
        jobCode: 'LOAD_ORDERS',
        workerGroup: 'import-workers',
        windowCode: 'NIGHT',
        nodeOrder: 20,
        retryPolicy: 'EXPONENTIAL',
        maxRetries: 3,
        timeoutSeconds: 90,
        crossDayDependencies: '[{"alias":"previous_day","jobCode":"LOAD_SOURCE"}]',
        crossDayDependencyTimeoutSeconds: 7200,
        enabled: false,
      },
    ])

    expect(node).toMatchObject({
      nodeCode: 'load_orders',
      relatedJobCode: 'LOAD_ORDERS',
      workerGroup: 'import-workers',
      windowCode: 'NIGHT',
      nodeOrder: 20,
      retryPolicy: 'EXPONENTIAL',
      retryMaxCount: 3,
      timeoutSeconds: 90,
      crossDayDependencies: '[{"alias":"previous_day","jobCode":"LOAD_SOURCE"}]',
      crossDayDependencyTimeoutSeconds: 7200,
      enabled: false,
    })
    expect(JSON.parse(node.nodeParams)).toMatchObject({ x: 120, y: 240 })
  })

  it('preserves edge type and disabled state instead of downgrading to SUCCESS', () => {
    expect(
      toWorkflowSaveEdges([
        {
          sourceNodeCode: 'gateway',
          targetNodeCode: 'fallback',
          label: 'onFailure',
          edgeType: 'FAILURE',
          enabled: false,
        },
      ]),
    ).toEqual([
      {
        fromNodeCode: 'gateway',
        toNodeCode: 'fallback',
        edgeType: 'FAILURE',
        conditionExpr: 'onFailure',
        enabled: false,
      },
    ])
  })

  it('uses the persisted edge default when an old graph has no edge type', () => {
    expect(
      toWorkflowSaveEdges([
        {
          sourceNodeCode: 'start',
          targetNodeCode: 'load_orders',
        },
      ]),
    ).toEqual([
      {
        fromNodeCode: 'start',
        toNodeCode: 'load_orders',
        edgeType: 'SUCCESS',
        conditionExpr: undefined,
        enabled: undefined,
      },
    ])
  })

  it('preserves ALWAYS edges used by existing start and end paths', () => {
    expect(
      toWorkflowSaveEdges([
        {
          sourceNodeCode: 'start',
          targetNodeCode: 'load_orders',
          edgeType: 'ALWAYS',
        },
      ]),
    ).toMatchObject([{ edgeType: 'ALWAYS' }])
  })
})
