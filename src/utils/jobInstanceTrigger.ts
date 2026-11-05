/**
 * 作业实例的触发来源展示值。
 *
 * 工作流节点派发的子实例 triggerType 恒为 EVENT（后端内部的“由工作流派发”标记），
 * 用户关心的手动 / 定时来源在根运行上，后端以 rootTriggerType 返回；非工作流派发的实例没有根运行，
 * 仍以自身 triggerType 为准。
 */
export function jobInstanceTriggerSource(row: {
  triggerType?: string | null
  rootTriggerType?: string | null
}): string | undefined {
  return row.rootTriggerType || row.triggerType || undefined
}
