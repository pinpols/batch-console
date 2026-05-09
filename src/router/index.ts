import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePermissionStore } from '@/stores/permission'
import { useRouteProgressStore } from '@/stores/routeProgress'
import { logError, logRoute } from '@/utils/logger'
import { isMobile } from '@/layout-mobile/composables/useMobileDetect'
import { applyPageMetaToRoutes } from '@/constants/pageMeta'
import type { Role } from '@/types'

/**
 * 移动端仅覆盖关键 5 页。桌面其它路径在移动设备上不自动跳，
 * 但首次落到根路径 / /ops/summary 时会被判断为"首页场景"引导到 /m。
 */
const MOBILE_AUTO_REDIRECT_PATHS = new Set<string>(['/', '/ops/summary'])

const routes = [
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
        path: 'config/excel',
        name: 'config-excel',
        component: () => import('@/views/config/ExcelMaintenanceWizard.vue'),
        meta: {
          title: 'Excel 维护',
          activeMenu: '/config/excel',
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
        path: 'config/excel/:domain',
        redirect: (to) => ({
          path: '/config/excel',
          query: {
            ...to.query,
            domain: String(to.params.domain ?? 'file-templates'),
          },
        }),
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
        path: 'workflow/designer/:code?',
        name: 'workflow-designer',
        component: () => import('@/views/workflow/WorkflowDesigner.vue'),
        meta: {
          title: '编排设计器',
          activeMenu: '/workflow/designer',
          minRole: 'OPERATOR',
        },
      },
      { path: 'monitor/instances', redirect: '/monitor/job-instances' },
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
      {
        path: 'logs',
        redirect: (to) => ({
          path: '/observability/queries',
          query: { ...to.query, tab: 'executionLogs' },
        }),
      },
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
        path: 'observability/audits',
        name: 'observability-audits',
        component: () => import('@/views/observability/AuditList.vue'),
        meta: {
          title: '审计日志',
          activeMenu: '/observability/audits',
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
          title: '队列与窗口',
          activeMenu: '/governance/queues',
          minRole: 'ADMIN',
        },
      },
      {
        path: 'system/tenants',
        name: 'tenant-list',
        component: () => import('@/views/system/TenantList.vue'),
        meta: {
          title: '租户管理',
          activeMenu: '/system/tenants',
          minRole: 'OPERATOR',
        },
      },
      {
        path: 'system/user-accounts',
        name: 'user-account-list',
        component: () => import('@/views/system/UserAccountList.vue'),
        meta: {
          title: '用户账户',
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
      { path: 'ops/toolbox', redirect: '/ops/diagnostic' },
      { path: 'system/cluster-diagnostic', redirect: '/ops/diagnostic' },
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
        path: 'catchup',
        name: 'm-catchup',
        component: () => import('@/views-mobile/MCatchUp.vue'),
        meta: { title: 'Catch-up 审批', minRole: 'VIEWER' },
      },
    ],
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

  if (to.meta.requiresAuth === false) return true

  if (!auth.isLoggedIn) return { name: 'login', query: { redirect: to.fullPath } }

  // 移动设备访问桌面首页时自动跳到移动端。?desktop=1 可强制留在桌面版。
  if (
    MOBILE_AUTO_REDIRECT_PATHS.has(to.path) &&
    to.query.desktop !== '1' &&
    isMobile() &&
    !to.path.startsWith('/m')
  ) {
    return { path: '/m/ops/summary' }
  }

  if (!auth.userInfo) {
    try {
      await auth.fetchMe()
    } catch {
      await auth.logout()
      return { name: 'login', query: { redirect: to.fullPath } }
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
