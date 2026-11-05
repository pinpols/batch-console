/**
 * 调度类型与触发模式的兼容表，与后端 ScheduleTriggerModes / WorkflowScheduleUpdateRequest 一致：
 * CRON、FIXED_RATE 只接受 SCHEDULED、MIXED；EVENT 只接受 EVENT、MIXED；MANUAL（及缺省）只接受 MANUAL、API、MIXED。
 * 调度器只注册 SCHEDULED / MIXED，“Cron + 手动”会显示为定时却永不触发，后端创建作业时也会拒绝。
 */
export function isTriggerModeCompatible(
  scheduleType: string | null | undefined,
  triggerMode: string | null | undefined,
): boolean {
  if (!triggerMode || triggerMode === 'MIXED') return true
  switch (scheduleType) {
    case 'CRON':
    case 'FIXED_RATE':
      return triggerMode === 'SCHEDULED'
    case 'EVENT':
      return triggerMode === 'EVENT'
    default:
      return triggerMode === 'MANUAL' || triggerMode === 'API'
  }
}
