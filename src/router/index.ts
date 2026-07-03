import {
  createRouter,
  createWebHistory,
  type RouteLocationNormalized,
  type RouteRecordRaw,
} from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { usePermissionStore } from '@/stores/permission'
import { useRouteProgressStore } from '@/stores/routeProgress'
import { ElMessage } from 'element-plus'
import { logError, logRoute } from '@/utils/logger'
import { isMobile } from '@/layout-mobile/composables/useMobileDetect'
import { applyPageMetaToRoutes } from '@/constants/pageMeta'
import { i18n } from '@/locales'
import type { Role } from '@/types'

/**
 * 移动端兜底首页：没有对应移动页时的最终回退目标。
 */
const MOBILE_HOME = '/m/ops/summary'

/**
 * 移动端仅覆盖关键 5 页。桌面其它路径在移动设备上不自动跳，
 * 但首次落到根路径 / /ops/summary 时会被判断为"首页场景"引导到 /m。
 */
const MOBILE_AUTO_REDIRECT_PATHS = new Set<string>(['/', '/ops/summary'])

/**
 * 桌面深链 → 移动页的降级映射。
 *
 * 移动设备访问桌面深链时（手机上桌面 20 列表格几乎不可用），按下表把常见列表/详情
 * 降级到对应 `/m/*` 移动页；表里没有的桌面路径回退到移动首页 `MOBILE_HOME`，
 * 而不是渲染桌面页。?desktop=1 仍可强制留在桌面版（与 MOBILE_AUTO_REDIRECT 同约定）。
 *
 * - 字符串键：桌面路径前缀（精确或 startsWith 命中）。
 * - 函数值：从 to 路径中解析 :id 等参数，返回移动目标 path；返回 null 则回退首页。
 */
type MobileMapper = (to: RouteLocationNormalized) => string | null

const MOBILE_DEEPLINK_MAP: { prefix: string; to: string | MobileMapper }[] = [
  // 作业实例：列表 + 详情（详情带 :id → /m/jobs/:id）
  {
    prefix: '/monitor/job-instances',
    to: (to) => {
      const m = /^\/monitor\/job-instances\/([^/]+)/.exec(to.path)
      // 分片子页 /:id/partitions 等移动端无对应页，降级到作业详情
      return m ? `/m/jobs/${m[1]}` : '/m/jobs'
    },
  },
  { prefix: '/runs', to: '/m/jobs' },
  { prefix: '/monitor/job-steps', to: '/m/jobs' },
  // 工作流运行：移动端有只读 DAG viewer（/m/workflow/:id）
  {
    prefix: '/monitor/workflow-runs',
    to: (to) => {
      const m = /^\/monitor\/workflow-runs\/([^/]+)/.exec(to.path)
      return m ? `/m/workflow/${m[1]}` : '/m/jobs'
    },
  },
  {
    prefix: '/workflow/viewer',
    to: (to) => {
      const m = /^\/workflow\/viewer\/([^/]+)/.exec(to.path)
      return m ? `/m/workflow/${m[1]}` : null
    },
  },
  // 作业/工作流/流水线定义：移动端无编辑页，回退首页
  { prefix: '/jobs/definitions', to: MOBILE_HOME },
  { prefix: '/jobs/pipelines', to: MOBILE_HOME },
  { prefix: '/workflow/definitions', to: MOBILE_HOME },
  // 文件中心：列表 + 模板/渠道/到达组等子页统一降级到移动文件页
  { prefix: '/files', to: '/m/files' },
  // 告警
  { prefix: '/observability/alerts', to: '/m/alerts' },
  { prefix: '/alerts', to: '/m/alerts' },
  // 审批 / Catch-up
  { prefix: '/scheduler/catch-up-approvals', to: '/m/catchup' },
  { prefix: '/approvals', to: '/m/approvals' },
  // 投递失败 Outbox
  { prefix: '/observability/outbox', to: '/m/outbox' },
  // 执行日志（旧 /logs 与综合查询日志 Tab）
  { prefix: '/logs', to: '/m/logs' },
  // Worker
  { prefix: '/workers', to: '/m/workers' },
  // 运维快照/控制面板
  { prefix: '/ops/summary', to: MOBILE_HOME },
]

/**
 * 解析移动设备访问桌面路径时应降级到的 `/m/*` 目标；无映射返回 null（不分流，保持原行为）。
 */
function resolveMobileTarget(to: RouteLocationNormalized): string | null {
  for (const rule of MOBILE_DEEPLINK_MAP) {
    if (to.path === rule.prefix || to.path.startsWith(`${rule.prefix}/`)) {
      const target = typeof rule.to === 'function' ? rule.to(to) : rule.to
      return target ?? MOBILE_HOME
    }
  }
  return null
}

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/login/Login.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/',
    component: () => import('@/layout/DefaultLayout.vue'),
    meta: { requiresAuth: true },
    redirect: '/ops/summary',
    children: [
      {
        path: 'ops/summary',
        name: 'ops-summary',
        component: () => import('@/views/ops/OpsSummary.vue'),
        meta: {
          title: '控制面板',
          description: '控制面快照与快捷入口',
          activeMenu: '/ops/summary',
          minRole: 'VIEWER',
          // 应用入口/首页:不展示返回按钮(向"上层"无可去)
          hideBackButton: true,
        },
      },
      {
        path: 'approvals',
        name: 'approvals',
        component: () => import('@/views/approvals/ApprovalList.vue'),
        meta: {
          title: '审批中心',
          description: '待办与批量审批',
          activeMenu: '/approvals',
          minRole: 'OPERATOR',
        },
      },
      {
        path: 'config/releases',
        name: 'config-releases',
        component: () => import('@/views/config/ConfigReleaseList.vue'),
        meta: {
          title: '发布管理',
          activeMenu: '/config/releases',
          minRole: 'OPERATOR',
        },
      },
      {
        path: 'config/tenant-package',
        name: 'tenant-package-import',
        component: () => import('@/views/config/TenantPackageImportWizard.vue'),
        meta: {
          title: '配置批量导入',
          activeMenu: '/config/tenant-package',
          minRole: 'OPERATOR',
        },
      },
      {
        path: 'reports',
        name: 'reports',
        component: () => import('@/views/reports/ReportExportHub.vue'),
        meta: {
          title: '报表中心',
          activeMenu: '/reports',
          minRole: 'VIEWER',
        },
      },
      {
        path: 'ops/custom-task-types',
        name: 'custom-task-types',
        component: () => import('@/views/ops/CustomTaskTypeList.vue'),
        meta: {
          title: '自定义 taskType',
          description: '租户 SDK 上报的自定义 taskType(只读)',
          activeMenu: '/ops/custom-task-types',
          minRole: 'OPERATOR',
        },
      },
      {
        path: 'ops/worker-fingerprints',
        name: 'worker-fingerprints',
        component: () => import('@/views/ops/WorkerFingerprintBoard.vue'),
        meta: {
          title: 'Worker fingerprint 看板',
          description: '按 build/sdk 维度查看本租户活跃 worker(SDK Phase 5 / 灰度切流)',
          activeMenu: '/ops/worker-fingerprints',
          minRole: 'OPERATOR',
        },
      },
      {
        path: 'ops/capacity-profile',
        name: 'ops-capacity-profile',
        component: () => import('@/views/ops/CapacityProfile.vue'),
        meta: {
          title: '容量画像',
          description: '按租户、作业或 Worker 聚合运行耗时、吞吐和文件处理量。',
          activeMenu: '/ops/capacity-profile',
          minRole: 'VIEWER',
        },
      },
      {
        path: 'ops/asset-freshness',
        name: 'ops-asset-freshness',
        component: () => import('@/views/ops/AssetFreshnessPolicies.vue'),
        meta: {
          title: '资产新鲜度策略',
          description: '管理 JOB asset freshness SLA 策略,驱动缺失和过期告警。',
          activeMenu: '/ops/asset-freshness',
          minRole: 'OPERATOR',
        },
      },
      {
        path: 'system/atomic-task-types',
        name: 'atomic-task-types',
        component: () => import('@/views/system/AtomicTaskTypeCenter.vue'),
        meta: {
          title: 'Atomic 节点配置中心',
          description: '查看平台四类原子节点 schema + 安全闸状态',
          activeMenu: '/system/atomic-task-types',
          minRole: 'OPERATOR',
        },
      },
      { path: 'files', redirect: '/files/list' },
      {
        path: 'files/list',
        name: 'file-list',
        component: () => import('@/views/file-center/FileList.vue'),
        meta: {
          title: '文件列表',
          description: '文件中心的数据看板与检索入口',
          activeMenu: '/files/list',
          minRole: 'VIEWER',
        },
      },
      {
        path: 'files/templates',
        name: 'file-template-list',
        component: () => import('@/views/file-center/FileTemplateList.vue'),
        meta: {
          title: '文件模板',
          activeMenu: '/files/templates',
          minRole: 'VIEWER',
          mode: 'templates',
        },
      },
      {
        path: 'files/channels',
        name: 'file-channel-list',
        component: () => import('@/views/file-center/FileTemplateList.vue'),
        meta: {
          title: '文件渠道',
          // 与 /files/templates 同组件(FileTemplateList 的 channels tab)。activeMenu 指已注册的
          // /files/templates,否则后端菜单 allowlist 守卫把本路由弹回首页(不跳转)。
          activeMenu: '/files/templates',
          minRole: 'VIEWER',
          mode: 'channels',
        },
      },
      {
        path: 'files/arrival-groups',
        name: 'file-arrival',
        component: () => import('@/views/file-center/ArrivalGroupList.vue'),
        meta: {
          title: '到达组治理',
          activeMenu: '/files/arrival-groups',
          minRole: 'VIEWER',
        },
      },
      {
        path: 'files/pipeline-obs',
        name: 'file-pipeline-obs',
        component: () => import('@/views/file-center/FilePipelineObservability.vue'),
        meta: {
          title: '流水线观测',
          activeMenu: '/files/pipeline-obs',
          minRole: 'VIEWER',
        },
      },
      {
        path: 'jobs/definitions',
        name: 'job-definitions',
        component: () => import('@/views/job/JobDefinitionList.vue'),
        meta: {
          title: '作业定义',
          activeMenu: '/jobs/definitions',
          minRole: 'VIEWER',
        },
      },
      {
        path: 'jobs/definitions/new',
        name: 'job-definition-wizard',
        component: () => import('@/views/job/JobDefinitionWizard.vue'),
        meta: {
          title: '新建作业向导',
          activeMenu: '/jobs/definitions',
          minRole: 'ADMIN',
        },
      },
      {
        path: 'jobs/definitions/:id',
        name: 'job-definition-detail',
        component: () => import('@/views/job/JobDefinitionDetail.vue'),
        meta: {
          title: '作业详情',
          activeMenu: '/jobs/definitions',
          minRole: 'VIEWER',
        },
      },
      {
        path: 'workflow/definitions',
        name: 'workflow-definitions',
        component: () => import('@/views/workflow/WorkflowDefinitionList.vue'),
        meta: {
          title: '工作流定义',
          activeMenu: '/workflow/definitions',
          minRole: 'VIEWER',
        },
      },
      {
        path: 'jobs/pipelines',
        name: 'pipeline-definitions',
        component: () => import('@/views/job/PipelineDefinitionList.vue'),
        meta: {
          title: '流水线定义',
          activeMenu: '/jobs/pipelines',
          minRole: 'VIEWER',
        },
      },
      {
        path: 'workflow/viewer/:id',
        name: 'workflow-viewer',
        component: () => import('@/views/workflow/WorkflowMermaidViewer.vue'),
        meta: {
          title: 'Workflow DAG 视图',
          activeMenu: '/workflow/definitions',
          minRole: 'VIEWER',
        },
      },
      {
        // Workflow DAG 编辑器 Spike 阶段(file-batch-system/docs/design/workflow-dag-designer.md §8)。
        // :id 可选,空 = 新建;Spike 阶段保存只 console.log,MVP 接 BE PUT /full + 单人锁。
        path: 'workflow/designer/:id?',
        name: 'workflow-designer',
        component: () => import('@/views/workflow/designer/WorkflowDesigner.vue'),
        meta: {
          title: 'Workflow 设计器',
          activeMenu: '/workflow/designer',
          minRole: 'OPERATOR',
        },
      },
      {
        // Workflow 版本对比 diff(Polish 阶段)。BE 暂无 versions 列表端点,
        // from 端降级为空,仅展示当前版本 nodes;路由参数保留供后续扩展。
        path: 'workflow/designer/:id/diff/:fromVersion/:toVersion',
        name: 'workflow-designer-diff',
        component: () => import('@/views/workflow/designer/diff/WorkflowDesignerDiff.vue'),
        meta: {
          title: 'Workflow 版本对比',
          activeMenu: '/workflow/designer',
          minRole: 'VIEWER',
        },
      },
      { path: 'monitor/instances', redirect: '/monitor/job-instances' },
      {
        path: 'runs',
        name: 'runs-overview',
        component: () => import('@/views/runs/RunsOverview.vue'),
        meta: {
          title: '全部运行',
          activeMenu: '/runs',
          minRole: 'VIEWER',
        },
      },
      {
        path: 'monitor/job-instances',
        name: 'job-instance-list',
        component: () => import('@/views/monitor/JobInstanceList.vue'),
        meta: {
          title: '作业运行',
          activeMenu: '/monitor/job-instances',
          minRole: 'VIEWER',
        },
      },
      {
        path: 'monitor/job-instances/:id',
        name: 'job-instance-detail',
        component: () => import('@/views/monitor/JobInstanceDetail.vue'),
        meta: {
          title: '作业实例详情',
          activeMenu: '/monitor/job-instances',
          minRole: 'VIEWER',
        },
      },
      {
        path: 'monitor/job-instances/:id/partitions',
        name: 'partition-view',
        component: () => import('@/views/monitor/PartitionView.vue'),
        meta: {
          title: '作业分片',
          activeMenu: '/monitor/job-instances',
          minRole: 'VIEWER',
        },
      },
      {
        path: 'monitor/job-steps',
        name: 'job-step-list',
        component: () => import('@/views/monitor/JobStepInstanceList.vue'),
        meta: {
          title: '作业步骤',
          activeMenu: '/monitor/job-steps',
          minRole: 'VIEWER',
        },
      },
      {
        path: 'monitor/workflow-runs',
        name: 'workflow-run-list',
        component: () => import('@/views/monitor/WorkflowRunList.vue'),
        meta: {
          title: '工作流运行',
          activeMenu: '/monitor/workflow-runs',
          minRole: 'VIEWER',
        },
      },
      {
        path: 'monitor/workflow-runs/:id',
        name: 'workflow-run-detail',
        component: () => import('@/views/monitor/WorkflowRunDetail.vue'),
        meta: {
          title: '工作流运行详情',
          activeMenu: '/monitor/workflow-runs',
          minRole: 'VIEWER',
        },
      },
      // 执行日志已合到"综合查询"的 ExecutionLogs Tab,顶级 /logs 撤掉。
      // route 保留 redirect 兼容旧书签。函数式 redirect 透传 query(traceId 等)。
      // 函数式 redirect:透传原 query(traceId 等),并强制带 tab=executionLogs。
      // 整条 route 标 as RouteRecordRaw 避免 vue-router 严格类型上的 union 投影问题。
      {
        path: 'logs',
        redirect: (to: RouteLocationNormalized) => ({
          path: '/observability/queries',
          query: { ...to.query, tab: 'executionLogs' },
        }),
      } as RouteRecordRaw,
      { path: 'alerts', redirect: '/observability/alerts' },
      { path: 'alerts/list', redirect: '/observability/alerts' },
      {
        path: 'observability/alerts',
        name: 'observability-alerts',
        component: () => import('@/views/observability/AlertList.vue'),
        meta: {
          title: '告警',
          activeMenu: '/observability/alerts',
          minRole: 'VIEWER',
        },
      },
      {
        path: 'observability/alert-routings',
        name: 'observability-alert-routings',
        component: () => import('@/views/observability/AlertRoutingPanel.vue'),
        meta: {
          title: '告警路由',
          activeMenu: '/observability/alert-routings',
          minRole: 'OPERATOR',
        },
      },
      {
        path: 'observability/trace',
        name: 'observability-trace',
        component: () => import('@/views/observability/TraceDiagnostic.vue'),
        meta: {
          title: 'Trace 诊断',
          description: '按 traceId 跨域聚合查询(作业/工作流/文件/审计/告警/Outbox 等)',
          activeMenu: '/observability/trace',
          minRole: 'VIEWER',
        },
      },
      {
        path: 'observability/lineage',
        name: 'observability-lineage',
        component: () => import('@/views/observability/LineageEvidence.vue'),
        meta: {
          title: '血缘证据',
          description: '按 result_version 或 businessKey 查询证据链与资产分区就绪状态。',
          activeMenu: '/observability/lineage',
          minRole: 'VIEWER',
        },
      },
      {
        path: 'observability/audits',
        name: 'observability-audits',
        component: () => import('@/views/observability/AuditList.vue'),
        meta: {
          title: '文件审计',
          activeMenu: '/observability/audits',
          minRole: 'VIEWER',
        },
      },
      {
        path: 'observability/operation-audits',
        name: 'observability-operation-audits',
        component: () => import('@/views/observability/OperationAuditList.vue'),
        meta: {
          title: '操作审计',
          description: '控制台用户写操作留痕(@AuditAction 切面)',
          activeMenu: '/observability/operation-audits',
          minRole: 'VIEWER',
        },
      },
      {
        path: 'observability/outbox',
        name: 'observability-outbox',
        component: () => import('@/views/observability/OutboxList.vue'),
        meta: {
          title: 'Outbox',
          activeMenu: '/observability/outbox',
          minRole: 'OPERATOR',
        },
      },
      { path: 'workers', redirect: '/workers/management' },
      {
        path: 'workers/management',
        name: 'worker-management',
        component: () => import('@/views/worker/WorkerManagement.vue'),
        meta: {
          title: 'Worker',
          activeMenu: '/workers/management',
          minRole: 'OPERATOR',
        },
      },
      {
        path: 'workers/my-workers',
        name: 'my-workers',
        component: () => import('@/views/worker/MyWorkers.vue'),
        meta: {
          title: '我的 Worker',
          activeMenu: '/workers/my-workers',
          minRole: 'VIEWER',
        },
      },
      { path: 'workers/list', redirect: '/workers/management' },
      { path: 'workers/channels', redirect: '/workers/management' },
      {
        path: 'scheduler/snapshot',
        name: 'scheduler-snapshot',
        component: () => import('@/views/scheduler/SchedulerSnapshot.vue'),
        meta: {
          title: '调度快照',
          activeMenu: '/scheduler/snapshot',
          minRole: 'VIEWER',
        },
      },
      {
        path: 'scheduler/batch-days',
        name: 'batch-day-list',
        component: () => import('@/views/scheduler/BatchDayList.vue'),
        meta: {
          title: '批次日与窗口',
          activeMenu: '/scheduler/batch-days',
          minRole: 'VIEWER',
        },
      },
      {
        path: 'scheduler/batch-days/:bizDate',
        name: 'batch-day-window',
        component: () => import('@/views/scheduler/BatchDayWindow.vue'),
        meta: {
          title: '批次日窗口',
          activeMenu: '/scheduler/batch-days',
          minRole: 'VIEWER',
        },
      },
      // Catch-up 审批已合并到 /approvals?tab=catch-up;旧链接 redirect 兼容
      { path: 'scheduler/catch-up-approvals', redirect: '/approvals?tab=catch-up' },
      {
        path: 'governance/quota',
        name: 'quota-panel',
        component: () => import('@/views/governance/QuotaPanel.vue'),
        meta: {
          title: '租户配额',
          activeMenu: '/governance/quota',
          minRole: 'OPERATOR',
        },
      },
      {
        path: 'governance/queues',
        name: 'queue-config',
        component: () => import('@/views/governance/QueueConfig.vue'),
        meta: {
          title: '队列',
          activeMenu: '/governance/queues',
          minRole: 'ADMIN',
          mode: 'queues',
        },
      },
      {
        path: 'governance/windows',
        name: 'governance-windows',
        component: () => import('@/views/governance/QueueConfig.vue'),
        meta: {
          title: '批次窗口',
          // 与 /governance/queues 同组件(QueueConfig 的 windows tab)。activeMenu 指向已注册菜单项
          // /governance/queues,否则后端菜单 allowlist 守卫会把本路由弹回首页(不跳转)。
          activeMenu: '/governance/queues',
          minRole: 'ADMIN',
          mode: 'windows',
        },
      },
      {
        path: 'governance/calendars',
        name: 'governance-calendars',
        component: () => import('@/views/governance/QueueConfig.vue'),
        meta: {
          title: '业务日历',
          // 同上:QueueConfig 的 calendars tab,activeMenu 指 /governance/queues 避免被守卫弹回。
          activeMenu: '/governance/queues',
          minRole: 'ADMIN',
          mode: 'calendars',
        },
      },
      {
        path: 'system/tenants',
        name: 'tenant-list',
        component: () => import('@/views/system/TenantList.vue'),
        meta: {
          title: '租户实例',
          activeMenu: '/system/tenants',
          minRole: 'OPERATOR',
        },
      },
      {
        path: 'system/user-accounts',
        name: 'user-account-list',
        component: () => import('@/views/system/UserAccountList.vue'),
        meta: {
          title: '登录账户',
          activeMenu: '/system/user-accounts',
          minRole: 'ADMIN',
        },
      },
      {
        path: 'system/users',
        name: 'user-role',
        component: () => import('@/views/system/UserRole.vue'),
        meta: {
          title: '权限自查',
          activeMenu: '/system/users',
          minRole: 'ADMIN',
        },
      },
      {
        // 自助账号 / 改密码 — 所有登录角色都可访问(P0.1 + P1 等 BE 实施)
        path: 'system/me',
        name: 'my-account',
        component: () => import('@/views/system/MyAccount.vue'),
        meta: {
          title: '我的账户',
          activeMenu: '/system/me',
        },
      },
      {
        path: 'system/ai-chat',
        name: 'ai-chat',
        component: () => import('@/views/system/AiChat.vue'),
        meta: {
          title: 'AI 助手',
          activeMenu: '/system/ai-chat',
          minRole: 'ADMIN',
        },
      },
      {
        path: 'system/api-keys',
        name: 'api-key-list',
        component: () => import('@/views/system/ApiKeyList.vue'),
        meta: {
          title: 'API Key',
          activeMenu: '/system/api-keys',
          minRole: 'ADMIN',
        },
      },
      {
        path: 'system/triggers',
        name: 'trigger-list',
        component: () => import('@/views/system/TriggerList.vue'),
        meta: {
          title: '触发器',
          activeMenu: '/system/triggers',
          minRole: 'OPERATOR',
        },
      },
      {
        path: 'system/parameters',
        name: 'system-parameters',
        component: () => import('@/views/system/SystemParameterList.vue'),
        meta: {
          title: '系统参数',
          activeMenu: '/system/parameters',
          minRole: 'ADMIN',
        },
      },
      { path: 'system/webhooks', redirect: '/system/notifications' },
      {
        path: 'system/tags',
        name: 'tag-management',
        component: () => import('@/views/system/TagManagement.vue'),
        meta: {
          title: '标签管理',
          activeMenu: '/system/tags',
          minRole: 'OPERATOR',
        },
      },
      {
        path: 'system/event-catalog',
        name: 'event-catalog',
        component: () => import('@/views/observability/EventCatalog.vue'),
        meta: {
          title: '事件目录',
          activeMenu: '/system/event-catalog',
          minRole: 'VIEWER',
        },
      },
      {
        path: 'config/management',
        name: 'config-management',
        component: () => import('@/views/system/ConfigManagement.vue'),
        meta: {
          title: '变更与同步',
          activeMenu: '/config/management',
          minRole: 'OPERATOR',
        },
      },
      { path: 'config/change-logs', redirect: '/config/management' },
      { path: 'config/sync', redirect: '/config/management' },
      {
        path: 'ops/diagnostic',
        name: 'ops-diagnostic',
        component: () => import('@/views/ops/OpsDiagnostic.vue'),
        meta: {
          title: '运维诊断',
          activeMenu: '/ops/diagnostic',
          minRole: 'ADMIN',
        },
      },
      {
        path: 'ops/shard-catalog',
        name: 'shard-catalog',
        component: () => import('@/views/ops/ShardCatalogList.vue'),
        meta: {
          title: '分片目录',
          activeMenu: '/ops/shard-catalog',
          minRole: 'ADMIN',
        },
      },
      {
        path: 'ops/tenant-placements',
        name: 'tenant-placements',
        component: () => import('@/views/ops/TenantPlacementList.vue'),
        meta: {
          title: '租户分片',
          activeMenu: '/ops/tenant-placements',
          minRole: 'ADMIN',
        },
      },
      { path: 'ops/toolbox', redirect: '/ops/diagnostic' },
      { path: 'system/cluster-diagnostic', redirect: '/ops/diagnostic' },
      {
        path: 'ops/batch-day-replay',
        name: 'batch-day-replay',
        component: () => import('@/views/ops/BatchDayReplay.vue'),
        meta: {
          title: '批次日重放',
          activeMenu: '/ops/batch-day-replay',
          // TENANT_ADMIN 可以提交+查看(本租户),ADMIN 可以审批
          minRole: 'OPERATOR',
        },
      },
      {
        path: 'system/notifications',
        name: 'notification-management',
        component: () => import('@/views/system/NotificationManagement.vue'),
        meta: {
          title: '通知与投递',
          activeMenu: '/system/notifications',
          minRole: 'OPERATOR',
        },
      },
      {
        path: 'observability/queries',
        name: 'observability-queries',
        component: () => import('@/views/observability/ObservabilityQueryTabs.vue'),
        meta: {
          title: '综合查询',
          activeMenu: '/observability/queries',
          minRole: 'VIEWER',
        },
      },
      {
        path: 'self-service',
        name: 'self-service-panel',
        component: () => import('@/views/system/SelfServicePanel.vue'),
        meta: {
          title: '自助服务',
          activeMenu: '/self-service',
          minRole: 'OPERATOR',
        },
      },
      { path: 'self-service/tenant', redirect: '/self-service' },
      { path: 'self-service/jobs', redirect: '/self-service' },
    ],
  },
  // ─── Mobile 独立路由（/m/*）—— 桌面层级零耦合，共享 store/api/composables ───
  //
  // 设计:**5 主功能 Tab + 5 应急深链**(共 10 路由,详见 MobileTabBar.vue 注释)。
  //
  // 底部 Tab(5 项,常驻可见):
  //   /m/alerts、/m/approvals、/m/ops/summary、/m/jobs、/m/workers
  //
  // 应急深链(5 项,无 Tab 入口,只从外部链入,删之前先确认产品):
  //   /m/jobs/:id   ← Tab 点击 drill-down
  //   /m/catchup    ← PWA push 通知 / 邮件
  //   /m/files      ← 扫码 / 上游链
  //   /m/outbox     ← PWA push 通知(投递失败)
  //   /m/logs       ← traceId 跨页跳转 / 错误链
  {
    path: '/m',
    component: () => import('@/layout-mobile/MobileLayout.vue'),
    meta: { requiresAuth: true, mobile: true },
    redirect: '/m/ops/summary',
    children: [
      {
        path: 'ops/summary',
        name: 'm-ops-summary',
        component: () => import('@/views-mobile/MOpsSummary.vue'),
        meta: { title: '控制面板', minRole: 'VIEWER' },
      },
      {
        path: 'approvals',
        name: 'm-approvals',
        component: () => import('@/views-mobile/MApprovals.vue'),
        meta: { title: '审批中心', minRole: 'OPERATOR' },
      },
      {
        path: 'alerts',
        name: 'm-alerts',
        component: () => import('@/views-mobile/MAlerts.vue'),
        meta: { title: '告警', minRole: 'VIEWER' },
      },
      {
        path: 'jobs',
        name: 'm-jobs',
        component: () => import('@/views-mobile/MJobInstances.vue'),
        meta: { title: '作业实例', minRole: 'VIEWER' },
      },
      {
        path: 'jobs/:id',
        name: 'm-job-detail',
        component: () => import('@/views-mobile/MJobInstanceDetail.vue'),
        meta: { title: '作业实例详情', minRole: 'VIEWER' },
      },
      {
        // M3:移动只读 workflow DAG viewer。深链 /m/workflow/:id?runId=NNN
        // oncall 从告警 push / 邮件链入,只看不操作
        path: 'workflow/:id',
        name: 'm-workflow-viewer',
        component: () => import('@/views-mobile/MWorkflowViewer.vue'),
        meta: { title: 'Workflow DAG', minRole: 'VIEWER' },
      },
      {
        path: 'catchup',
        name: 'm-catchup',
        component: () => import('@/views-mobile/MCatchUp.vue'),
        meta: { title: 'Catch-up 审批', minRole: 'OPERATOR' },
      },
      {
        path: 'files',
        name: 'm-files',
        component: () => import('@/views-mobile/MFileList.vue'),
        meta: { title: '文件', minRole: 'VIEWER' },
      },
      {
        path: 'workers',
        name: 'm-workers',
        component: () => import('@/views-mobile/MWorkers.vue'),
        meta: { title: 'Worker', minRole: 'VIEWER' },
      },
      {
        path: 'outbox',
        name: 'm-outbox',
        component: () => import('@/views-mobile/MOutbox.vue'),
        meta: { title: 'Outbox', minRole: 'VIEWER' },
      },
      {
        path: 'logs',
        name: 'm-logs',
        component: () => import('@/views-mobile/MExecutionLog.vue'),
        meta: { title: '执行日志', minRole: 'VIEWER' },
      },
    ],
  },
  {
    path: '/maintenance',
    name: 'maintenance',
    component: () => import('@/views/MaintenancePage.vue'),
    meta: { requiresAuth: false, title: '系统维护中' },
  },
  {
    path: '/setup/initial-tenant',
    name: 'initial-tenant-setup',
    component: () => import('@/views/setup/InitialTenantSetup.vue'),
    meta: { requiresAuth: true, title: '首次部署 · 创建租户' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFound.vue'),
    meta: { requiresAuth: false },
  },
]

applyPageMetaToRoutes(routes)

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach(async (to, from) => {
  if (to.fullPath !== from.fullPath) {
    useRouteProgressStore().start()
  }

  const auth = useAuthStore()
  const permission = usePermissionStore()

  // 维护期(enabled=true 且非 readOnly):除维护页/登录页外都重定向到 /maintenance
  // readOnly 模式不强跳,让用户继续读;写按钮由 store.writesFrozen 禁用
  const app = useAppStore()
  if (
    app.maintenance.enabled &&
    !app.maintenance.readOnly &&
    to.name !== 'maintenance' &&
    to.name !== 'login'
  ) {
    return { name: 'maintenance', query: { redirect: to.fullPath } }
  }

  if (to.meta.requiresAuth === false) return true

  if (!auth.isLoggedIn) return { name: 'login', query: { redirect: to.fullPath } }

  // 移动设备访问桌面首页/深链时自动分流到移动端。?desktop=1 可强制留在桌面版。
  // 先处理首页场景，再按 MOBILE_DEEPLINK_MAP 把常见列表/详情降级到对应 /m/* 页，
  // 没有对应移动页的桌面深链回退到 MOBILE_HOME，而不是渲染桌面 20 列页。
  if (isMobile() && to.query.desktop !== '1' && !to.path.startsWith('/m')) {
    if (MOBILE_AUTO_REDIRECT_PATHS.has(to.path)) {
      return { path: MOBILE_HOME }
    }
    const mobileTarget = resolveMobileTarget(to)
    // 透传原 query（traceId / tab / runId 等），避免降级丢上下文。
    if (mobileTarget && mobileTarget !== to.path) {
      return { path: mobileTarget, query: to.query }
    }
  }

  // Workflow 设计器是桌面专属编排工具(X6 画布拖拽,触摸屏不可用)。手机端兜底:
  // 有 id → 转移动只读 DAG 查看器(看同一个 workflow,体验连贯);新建(无 id)→
  // 提示用桌面 + 回移动首页。?desktop=1 强制留桌面版(同上 mobile 重定向约定)。
  if (to.name === 'workflow-designer' && isMobile() && to.query.desktop !== '1') {
    ElMessage.warning(i18n.global.t('workflowDesignerMvp.mobileDesignerGuard'))
    const designerId = Array.isArray(to.params.id) ? to.params.id[0] : to.params.id
    if (designerId) return { name: 'm-workflow-viewer', params: { id: designerId } }
    return { path: '/m/ops/summary' }
  }

  if (!auth.userInfo) {
    try {
      await auth.fetchMe()
    } catch (err) {
      // 只有 401 真鉴权过期才登出。5xx / 网络不可达 / 超时等保留登录态,
      // 让用户停在原页,由 axios 拦截器 toast 提示;否则 BE 一抖动就把全员踢回登录页。
      const status = (err as { response?: { status?: number } } | null)?.response?.status
      if (status === 401) {
        await auth.logout()
        return { name: 'login', query: { redirect: to.fullPath } }
      }
      // 透明放行:userInfo 仍为 null,各页面自身 loadXxx 会再次失败 + toast,
      // 但用户不会被无声踢出。
    }
  }

  // P1 强制首次/重置后改密码(BE 字段 mustChangePassword);字段缺失视为 false 不拦
  // 例外:/system/me 自己,以及 login/logout 类路径,不能拦否则死循环
  if (
    auth.userInfo?.mustChangePassword === true &&
    to.path !== '/system/me' &&
    !to.path.startsWith('/login')
  ) {
    return { path: '/system/me', query: { mustChange: '1' } }
  }

  // 首登向导:系统 0 租户时,ADMIN 必须先建第一个租户。其它角色无创建权限,
  // 在登录页 BE 已校验过账户必有 tenant 绑定;到这里依旧 0 租户属于异常,放行让
  // 业务页空态自行提示。检测带内存缓存(系统级状态变化频率极低),向导创建后
  // 主动 invalidate。
  if (
    auth.hasPermission('ROLE_ADMIN') &&
    to.path !== '/setup/initial-tenant' &&
    to.name !== 'login'
  ) {
    try {
      const { systemHasTenants } = await import('@/api/setup')
      const hasTenants = await systemHasTenants()
      if (!hasTenants) {
        return { path: '/setup/initial-tenant' }
      }
    } catch (err) {
      // 探测失败不拦截 —— 让用户继续,避免 BE 抖动把 admin 锁在向导外。
      // 业务页加载失败由各自 loader 处理。
      logError('[router] systemHasTenants probe failed', err)
    }
  }

  const minRole = to.meta.minRole as string | undefined
  if (minRole && !permission.canAccessRole(minRole as Role)) {
    return { path: '/' }
  }

  const permissions = to.meta.permissions as string[] | undefined
  if (permissions && !permission.canAccessPermissions(permissions)) {
    return { path: '/' }
  }

  // 后端 /auth/me 下发的菜单是当前租户+authorities 的最终可见性来源。
  // 静态 minRole 只表示前端粗粒度等级；当后端菜单存在时，路由也必须按菜单 allowlist 收口，
  // 避免用户通过 URL、历史标签或命令面板进入已被后端隐藏的页面。
  const activeMenu = to.meta.activeMenu as string | undefined
  const menuPath = activeMenu || to.path
  const allowWithoutMenu = to.path === '/system/me' || to.path.startsWith('/m/')
  if (!allowWithoutMenu && !permission.hasBackendMenuAccess(menuPath)) {
    return { path: '/' }
  }

  return true
})

router.afterEach((to, from) => {
  useRouteProgressStore().finish()
  const title = (to.meta.title as string) || to.name?.toString() || to.path
  logRoute(`页面切换:${title}`, {
    path: to.fullPath,
    from: from.fullPath,
    name: to.name?.toString(),
  })
})

router.onError((err, to) => {
  useRouteProgressStore().finish()

  const message = err instanceof Error ? err.message : String(err)
  logError(`路由错误:${message}`, {
    kind: 'router',
    message,
    path: to?.fullPath,
  })

  // 典型线上场景：发布后用户缓存了旧 chunk，点击菜单会报 “Loading chunk failed”
  // 这里做一次性自动恢复（避免卡在空白页/进度条不消失）。
  const isChunkLoadError =
    /Loading chunk \d+ failed/i.test(message) ||
    /Loading CSS chunk \d+ failed/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message)

  if (isChunkLoadError) {
    const key = '__router_chunk_reload_once__'
    const alreadyReloaded = sessionStorage.getItem(key) === '1'
    if (!alreadyReloaded) {
      sessionStorage.setItem(key, '1')
      // 保留当前路径（含 query/hash），避免刷新后回到首页。
      window.location.replace(to?.fullPath || window.location.href)
    }
  }
})

export default router
