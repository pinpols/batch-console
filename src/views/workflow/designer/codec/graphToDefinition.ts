/**
 * designer nodes/edges → `workflow_definition.definition_json`。
 *
 * Spike 阶段保存按钮 console.log 即可,但已实现完整反向 codec,MVP 接 BE PUT /full 无需改。
 */

import type { DesignerSnapshot, WorkflowDefinitionJson } from '../types'

export function graphToDefinition(snapshot: DesignerSnapshot): WorkflowDefinitionJson {
  return {
    nodes: snapshot.nodes.map((n) => {
      // attrs 里可能有上次 codec 残留的字段;保留为透传以避免丢失 GATEWAY 等未识别配置
      const passthrough = { ...(n.attrs ?? {}) }
      delete passthrough.nodeCode
      delete passthrough.nodeName
      delete passthrough.nodeType
      delete passthrough.x
      delete passthrough.y
      return {
        nodeCode: n.nodeCode,
        nodeName: n.nodeName,
        nodeType: n.nodeType,
        x: n.x,
        y: n.y,
        ...passthrough,
      }
    }),
    edges: snapshot.edges.map((e) => {
      const passthrough = { ...(e.attrs ?? {}) }
      delete passthrough.sourceNodeCode
      delete passthrough.targetNodeCode
      delete passthrough.label
      return {
        ...passthrough,
        sourceNodeCode: e.source,
        targetNodeCode: e.target,
        ...(e.label ? { label: e.label } : {}),
      }
    }),
  }
}
