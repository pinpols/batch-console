/**
 * 将设计器节点和边转换为 `workflow_definition.definition_json`。
 *
 * 保存时走后端 definition_json 契约；attrs 保真透传，避免未显式编辑的节点/边字段丢失。
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
