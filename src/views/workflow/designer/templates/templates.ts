/**
 * Workflow 设计器内置模板(Polish 阶段)。
 *
 * 4 个内置模板,纯前端 hard-code definition_json,不接 BE 模板表(后续可扩):
 * - linear3:线性 START → JOB_A → JOB_B → JOB_C → END
 * - fanOut:扇出 START → GATEWAY → 3 branches → 3 END
 * - fanIn:扇出 + 合并 START → GATEWAY → 2 JOB → 共同 END
 * - approval:JOB → APPROVAL → JOB
 *
 * 节点 x/y 坐标已预排,用户拉入后无需再点"自动布局"。
 */
import type { WorkflowDefinitionJson } from '../types'

export interface DesignerTemplate {
  key: 'linear3' | 'fanOut' | 'fanIn' | 'approval'
  labelKey: string
  descKey: string
  definition: WorkflowDefinitionJson
}

const linear3: WorkflowDefinitionJson = {
  nodes: [
    { nodeCode: 'start', nodeName: 'START', nodeType: 'START', x: 80, y: 80 },
    { nodeCode: 'job_a', nodeName: 'JOB A', nodeType: 'JOB', x: 260, y: 80 },
    { nodeCode: 'job_b', nodeName: 'JOB B', nodeType: 'JOB', x: 440, y: 80 },
    { nodeCode: 'job_c', nodeName: 'JOB C', nodeType: 'JOB', x: 620, y: 80 },
    { nodeCode: 'end', nodeName: 'END', nodeType: 'END', x: 800, y: 80 },
  ],
  edges: [
    { sourceNodeCode: 'start', targetNodeCode: 'job_a' },
    { sourceNodeCode: 'job_a', targetNodeCode: 'job_b' },
    { sourceNodeCode: 'job_b', targetNodeCode: 'job_c' },
    { sourceNodeCode: 'job_c', targetNodeCode: 'end' },
  ],
}

const fanOut: WorkflowDefinitionJson = {
  nodes: [
    { nodeCode: 'start', nodeName: 'START', nodeType: 'START', x: 80, y: 200 },
    { nodeCode: 'gateway', nodeName: 'GATEWAY', nodeType: 'GATEWAY', x: 260, y: 200 },
    { nodeCode: 'job_a', nodeName: 'JOB A', nodeType: 'JOB', x: 440, y: 80 },
    { nodeCode: 'job_b', nodeName: 'JOB B', nodeType: 'JOB', x: 440, y: 200 },
    { nodeCode: 'job_c', nodeName: 'JOB C', nodeType: 'JOB', x: 440, y: 320 },
    { nodeCode: 'end_a', nodeName: 'END A', nodeType: 'END', x: 620, y: 80 },
    { nodeCode: 'end_b', nodeName: 'END B', nodeType: 'END', x: 620, y: 200 },
    { nodeCode: 'end_c', nodeName: 'END C', nodeType: 'END', x: 620, y: 320 },
  ],
  edges: [
    { sourceNodeCode: 'start', targetNodeCode: 'gateway' },
    { sourceNodeCode: 'gateway', targetNodeCode: 'job_a', label: 'branch_a' },
    { sourceNodeCode: 'gateway', targetNodeCode: 'job_b', label: 'branch_b' },
    { sourceNodeCode: 'gateway', targetNodeCode: 'job_c', label: 'branch_c' },
    { sourceNodeCode: 'job_a', targetNodeCode: 'end_a' },
    { sourceNodeCode: 'job_b', targetNodeCode: 'end_b' },
    { sourceNodeCode: 'job_c', targetNodeCode: 'end_c' },
  ],
}

const fanIn: WorkflowDefinitionJson = {
  nodes: [
    { nodeCode: 'start', nodeName: 'START', nodeType: 'START', x: 80, y: 200 },
    { nodeCode: 'gateway', nodeName: 'GATEWAY', nodeType: 'GATEWAY', x: 260, y: 200 },
    { nodeCode: 'job_a', nodeName: 'JOB A', nodeType: 'JOB', x: 440, y: 120 },
    { nodeCode: 'job_b', nodeName: 'JOB B', nodeType: 'JOB', x: 440, y: 280 },
    { nodeCode: 'end', nodeName: 'END', nodeType: 'END', x: 620, y: 200 },
  ],
  edges: [
    { sourceNodeCode: 'start', targetNodeCode: 'gateway' },
    { sourceNodeCode: 'gateway', targetNodeCode: 'job_a', label: 'branch_a' },
    { sourceNodeCode: 'gateway', targetNodeCode: 'job_b', label: 'branch_b' },
    { sourceNodeCode: 'job_a', targetNodeCode: 'end' },
    { sourceNodeCode: 'job_b', targetNodeCode: 'end' },
  ],
}

const approval: WorkflowDefinitionJson = {
  nodes: [
    { nodeCode: 'start', nodeName: 'START', nodeType: 'START', x: 80, y: 80 },
    { nodeCode: 'job_pre', nodeName: 'PREPARE', nodeType: 'JOB', x: 260, y: 80 },
    { nodeCode: 'approval', nodeName: 'APPROVAL', nodeType: 'APPROVAL', x: 440, y: 80 },
    { nodeCode: 'job_post', nodeName: 'EXECUTE', nodeType: 'JOB', x: 620, y: 80 },
    { nodeCode: 'end', nodeName: 'END', nodeType: 'END', x: 800, y: 80 },
  ],
  edges: [
    { sourceNodeCode: 'start', targetNodeCode: 'job_pre' },
    { sourceNodeCode: 'job_pre', targetNodeCode: 'approval' },
    { sourceNodeCode: 'approval', targetNodeCode: 'job_post' },
    { sourceNodeCode: 'job_post', targetNodeCode: 'end' },
  ],
}

export const BUILTIN_TEMPLATES: DesignerTemplate[] = [
  { key: 'linear3', labelKey: 'workflowDesignerPolish.templateLinear3', descKey: 'workflowDesignerPolish.templateLinear3Desc', definition: linear3 },
  { key: 'fanOut', labelKey: 'workflowDesignerPolish.templateFanOut', descKey: 'workflowDesignerPolish.templateFanOutDesc', definition: fanOut },
  { key: 'fanIn', labelKey: 'workflowDesignerPolish.templateFanIn', descKey: 'workflowDesignerPolish.templateFanInDesc', definition: fanIn },
  { key: 'approval', labelKey: 'workflowDesignerPolish.templateApproval', descKey: 'workflowDesignerPolish.templateApprovalDesc', definition: approval },
]

export function findTemplate(key: string): DesignerTemplate | undefined {
  return BUILTIN_TEMPLATES.find((t) => t.key === key)
}
