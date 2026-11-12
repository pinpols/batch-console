/** 移动页使用对应桌面业务入口的菜单权限；定义 ID 与运行 ID 保持各自入口。 */
export const mobileMenuAccess: Record<string, string> = {
  'm-ops-summary': '/ops/summary',
  'm-approvals': '/approvals',
  'm-alerts': '/observability/alerts',
  'm-jobs': '/monitor/job-instances',
  'm-job-detail': '/monitor/job-instances',
  'm-workflow-run': '/monitor/workflow-runs',
  'm-workflow-viewer': '/workflow/definitions',
  'm-files': '/files/list',
  'm-workers': '/workers/management',
  'm-outbox': '/observability/outbox',
  'm-logs': '/observability/queries',
}
