import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePermissionStore } from '@/stores/permission'
import type { Role } from '@/types'

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
          title: '运营概览',
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
          title: '配置发布',
          activeMenu: '/config/releases',
          minRole: 'OPERATOR',
        },
      },
      {
        path: 'config/excel/:domain',
        name: 'config-excel',
        component: () => import('@/views/config/ExcelMaintenanceWizard.vue'),
        meta: {
          title: 'Excel 维护',
          activeMenu: '/config/excel/file-templates',
          minRole: 'OPERATOR',
        },
      },
      {
        path: 'reports',
        name: 'reports',
        component: () => import('@/views/reports/ReportExportHub.vue'),
        meta: {
          title: '报表导出',
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
        path: 'files/arrival-groups',
        name: 'file-arrival',
        component: () => import('@/views/file-center/ArrivalGroupList.vue'),
        meta: {
          title: '文件组到达治理',
          activeMenu: '/files/arrival-groups',
          minRole: 'VIEWER',
        },
      },
      {
        path: 'jobs/definitions',
        name: 'job-definitions',
        component: () => import('@/views/job/JobDefinitionList.vue'),
        meta: {
          title: 'Job 定义',
          activeMenu: '/jobs/definitions',
          minRole: 'VIEWER',
        },
      },
      {
        path: 'workflow/definitions',
        name: 'workflow-definitions',
        component: () => import('@/views/workflow/WorkflowDefinitionList.vue'),
        meta: {
          title: 'Workflow 定义',
          activeMenu: '/workflow/definitions',
          minRole: 'VIEWER',
        },
      },
      {
        path: 'workflow/designer/:code?',
        name: 'workflow-designer',
        component: () => import('@/views/workflow/WorkflowDesigner.vue'),
        meta: {
          title: 'Workflow 编排',
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
          title: 'Job Instance 列表',
          activeMenu: '/monitor/job-instances',
          minRole: 'VIEWER',
        },
      },
      {
        path: 'monitor/job-instances/:id',
        name: 'job-instance-detail',
        component: () => import('@/views/monitor/JobInstanceDetail.vue'),
        meta: {
          title: 'Job Instance 详情',
          activeMenu: '/monitor/job-instances',
          minRole: 'VIEWER',
        },
      },
      {
        path: 'monitor/job-instances/:id/partitions',
        name: 'partition-view',
        component: () => import('@/views/monitor/PartitionView.vue'),
        meta: {
          title: 'Job Step / 分片',
          activeMenu: '/monitor/job-instances',
          minRole: 'VIEWER',
        },
      },
      {
        path: 'monitor/job-steps',
        name: 'job-step-list',
        component: () => import('@/views/monitor/JobStepInstanceList.vue'),
        meta: {
          title: 'Job Step Instance',
          activeMenu: '/monitor/job-steps',
          minRole: 'VIEWER',
        },
      },
      {
        path: 'monitor/workflow-runs',
        name: 'workflow-run-list',
        component: () => import('@/views/monitor/WorkflowRunList.vue'),
        meta: {
          title: 'Workflow Run 列表',
          activeMenu: '/monitor/workflow-runs',
          minRole: 'VIEWER',
        },
      },
      {
        path: 'monitor/workflow-runs/:id',
        name: 'workflow-run-detail',
        component: () => import('@/views/monitor/WorkflowRunDetail.vue'),
        meta: {
          title: 'Workflow Run 详情',
          activeMenu: '/monitor/workflow-runs',
          minRole: 'VIEWER',
        },
      },
      {
        path: 'logs',
        name: 'execution-log',
        component: () => import('@/views/log/ExecutionLog.vue'),
        meta: {
          title: '执行日志',
          activeMenu: '/logs',
          minRole: 'VIEWER',
        },
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
      { path: 'workers', redirect: '/workers/list' },
      {
        path: 'workers/list',
        name: 'worker-list',
        component: () => import('@/views/worker/WorkerList.vue'),
        meta: {
          title: 'Worker 列表',
          activeMenu: '/workers/list',
          minRole: 'OPERATOR',
        },
      },
      {
        path: 'workers/channels',
        name: 'dispatch-channels',
        component: () => import('@/views/worker/DispatchChannel.vue'),
        meta: {
          title: '文件渠道',
          activeMenu: '/workers/channels',
          minRole: 'OPERATOR',
        },
      },
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
        path: 'governance/quota',
        name: 'quota-panel',
        component: () => import('@/views/governance/QuotaPanel.vue'),
        meta: {
          title: '租户配额面板',
          activeMenu: '/governance/quota',
          minRole: 'OPERATOR',
        },
      },
      {
        path: 'governance/queues',
        name: 'queue-config',
        component: () => import('@/views/governance/QueueConfig.vue'),
        meta: {
          title: '队列 & 窗口',
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
          minRole: 'ADMIN',
        },
      },
      {
        path: 'system/users',
        name: 'user-role',
        component: () => import('@/views/system/UserRole.vue'),
        meta: {
          title: '用户 & 角色',
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
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  const permission = usePermissionStore()

  if (to.meta.requiresAuth === false) return true

  if (!auth.isLoggedIn) return { name: 'login', query: { redirect: to.fullPath } }

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

export default router
