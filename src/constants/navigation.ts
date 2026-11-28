import type { Component } from 'vue'
import type { Role } from '@/types'
import { pageTitle, pageTitleKey } from '@/constants/pageMeta'
// 还原设计:侧栏/导航用 Lucide 线性图标(设计稿同款 stroke-width=2 细线),
// 以别名映射到原 EP 名,下方结构不变。
import {
  Crosshair as Aim,
  Bell,
  Package as Box,
  Briefcase,
  Calendar,
  Clock,
  Coins as Coin,
  Layers as Collection,
  Tags as CollectionTag,
  Share2 as Connection,
  Cpu,
  BarChart3 as DataAnalysis,
  Activity as DataLine,
  FileText as Document,
  FileCheck as DocumentChecked,
  Download,
  Files,
  FolderOpen as FolderOpened,
  LayoutGrid as Grid,
  LayoutDashboard as Histogram,
  Key,
  List,
  SlidersHorizontal as Management,
  ClipboardList as Memo,
  Settings2 as Operation,
  PieChart,
  Tag as PriceTag,
  Send as Promotion,
  BookOpen as Reading,
  Search,
  Settings as Setting,
  Stamp,
  Timer,
  Wrench as Tools,
  TrendingUp as TrendCharts,
  ShieldCheck,
  UserCog,
  TriangleAlert as WarningFilled,
  // 按设计源逐项对齐的专用图标(从 .dc.html DOM 抠出的每个 nav 项真实图标)
  Check,
  Zap,
  Play,
  Server,
  Building2,
  CalendarCheck,
  Folder as FolderClosed,
  Upload,
} from '@lucide/vue'

export interface NavigationItem {
  title: string
  path: string
  icon?: Component
  minRole?: Role
  /** 精确 authority 白名单；用于无法由 VIEWER/OPERATOR/ADMIN 层级表达的角色能力。 */
  authorities?: string[]
  /** 后端 /auth/me 动态能力；用于受功能开关和白名单共同控制的入口。 */
  capabilities?: string[]
  /** 后端菜单未同步新入口时，可复用已有且权限受限的菜单路径作为 allowlist。 */
  menuAccessFallbacks?: string[]
  /** 隐藏出现在侧边栏,但 Command Palette / 内嵌跳转 仍可达 */
  hidden?: boolean
  /** 侧栏同组内的小标题标识（对应 nav.subGroup.<key>） */
  subGroup?: string
  /**
   * 显式 i18n 标题 key(覆盖按 path 推导的 page.<pathKey>.title)。
   * path 带 query(如 Catch-up = /approvals?tab=catch-up)且标题不等同基础路由时，
   * 用它指向原页的 key 保证中英都翻。
   */
  titleKey?: string
}

export interface NavigationGroup {
  key: string
  title: string
  icon: Component
  minRole?: Role
  children: NavigationItem[]
}

export function navigationItemTitleKey(item: NavigationItem): string {
  return item.titleKey ?? pageTitleKey(item.path)
}

const navigationGroupOrder = [
  'workspace',
  'definitions',
  'files',
  'scheduling',
  'monitor',
  'alerting',
  'system',
] as const

export type NavigationGroupKey = (typeof navigationGroupOrder)[number]

/**
 * 侧边栏分组以用户任务组织；保留既有 7 组、路由与权限，不另建任务导航框架。
 *
 * 后端 `/auth/me` 返回的菜单会参与路由 allowlist,所以这里必须覆盖后端 menu.yml 的全部
 * path;只调整分组表达，不改变后端 `/auth/me` 菜单 allowlist。后端 `TENANT_ADMIN` 在前端统一映射为 `OPERATOR`。
 */
const navigationGroupsByKey = {
  workspace: {
    key: 'workspace',
    title: '工作台',
    icon: Histogram,
    minRole: 'VIEWER',
    children: [
      {
        title: pageTitle('/ops/summary'),
        path: '/ops/summary',
        minRole: 'VIEWER',
        icon: Grid,
      },
      {
        title: pageTitle('/approvals'),
        path: '/approvals',
        minRole: 'OPERATOR',
        authorities: ['ROLE_ADMIN', 'ROLE_TENANT_ADMIN'],
        icon: Check,
      },
      { title: pageTitle('/reports'), path: '/reports', minRole: 'VIEWER', icon: DataAnalysis },
      {
        title: pageTitle('/self-service'),
        path: '/self-service',
        minRole: 'VIEWER',
        authorities: ['ROLE_ADMIN', 'ROLE_TENANT_ADMIN', 'ROLE_TENANT_USER'],
        icon: Zap,
      },
    ],
  },
  monitor: {
    key: 'monitor',
    title: '运行监控',
    icon: Aim,
    minRole: 'VIEWER',
    children: [
      {
        title: pageTitle('/monitor/job-instances'),
        path: '/monitor/job-instances',
        minRole: 'VIEWER',
        icon: Play,
      },
      {
        title: pageTitle('/monitor/job-steps'),
        path: '/monitor/job-steps',
        minRole: 'VIEWER',
        icon: Timer,
        hidden: true,
      },
      {
        title: pageTitle('/monitor/workflow-runs'),
        path: '/monitor/workflow-runs',
        minRole: 'VIEWER',
        icon: Promotion,
      },
      // 「执行日志」入口改为「综合查询」直达(用户反馈:点执行日志落到标题为综合查询的
      // tab 页,导航高亮与页标题对不上);/logs 路由 redirect 保留兼容旧深链。
      {
        title: pageTitle('/observability/queries'),
        path: '/observability/queries',
        minRole: 'VIEWER',
        icon: Reading,
      },
      {
        title: pageTitle('/observability/trace'),
        path: '/observability/trace',
        minRole: 'VIEWER',
        icon: Search,
      },
      {
        title: pageTitle('/observability/usage'),
        path: '/observability/usage',
        minRole: 'VIEWER',
        authorities: ['ROLE_ADMIN', 'ROLE_TENANT_ADMIN', 'ROLE_AUDITOR'],
        icon: DataAnalysis,
      },
      {
        title: pageTitle('/ops/diagnostic'),
        path: '/ops/diagnostic',
        minRole: 'ADMIN',
        icon: Tools,
      },
      {
        title: pageTitle('/observability/lineage'),
        path: '/observability/lineage',
        minRole: 'VIEWER',
        icon: DataLine,
        hidden: true,
      },
    ],
  },
  alerting: {
    key: 'alerting',
    title: '告警投递',
    icon: Bell,
    minRole: 'VIEWER',
    children: [
      {
        title: pageTitle('/observability/alerts'),
        path: '/observability/alerts',
        minRole: 'VIEWER',
        icon: Bell,
      },
      {
        title: pageTitle('/observability/job-monitoring-policies'),
        path: '/observability/job-monitoring-policies',
        titleKey: 'nav.menuJobMonitoring',
        minRole: 'OPERATOR',
        menuAccessFallbacks: ['/ops/asset-freshness'],
        icon: Timer,
      },
      {
        title: pageTitle('/observability/alert-routings'),
        path: '/observability/alert-routings',
        minRole: 'OPERATOR',
        icon: Promotion,
        hidden: true,
      },
      {
        title: pageTitle('/system/notifications'),
        path: '/system/notifications',
        titleKey: 'nav.menuNotificationDelivery',
        minRole: 'OPERATOR',
        icon: Bell,
      },
      {
        title: pageTitle('/observability/outbox'),
        path: '/observability/outbox',
        minRole: 'OPERATOR',
        icon: Promotion,
      },
    ],
  },
  definitions: {
    key: 'definitions',
    title: '作业编排',
    icon: Management,
    minRole: 'VIEWER',
    children: [
      {
        title: pageTitle('/jobs/definitions'),
        path: '/jobs/definitions',
        minRole: 'VIEWER',
        icon: Box,
      },
      {
        title: pageTitle('/workflow/definitions'),
        path: '/workflow/definitions',
        minRole: 'VIEWER',
        icon: Collection,
      },
      {
        title: pageTitle('/workflow/designer'),
        path: '/workflow/designer',
        minRole: 'OPERATOR',
        icon: Aim,
        hidden: true,
      },
      {
        title: pageTitle('/config/tenant-package'),
        path: '/config/tenant-package',
        titleKey: 'nav.menuConfigurationImport',
        minRole: 'OPERATOR',
        icon: Box,
        hidden: true,
      },
    ],
  },
  files: {
    key: 'files',
    title: '文件管理',
    icon: FolderOpened,
    minRole: 'VIEWER',
    children: [
      {
        title: pageTitle('/files/list'),
        path: '/files/list',
        minRole: 'VIEWER',
        icon: FolderClosed,
      },
      {
        title: pageTitle('/files/arrival-groups'),
        path: '/files/arrival-groups',
        minRole: 'VIEWER',
        icon: CollectionTag,
        hidden: true,
      },
      {
        title: pageTitle('/files/pipeline-obs'),
        path: '/files/pipeline-obs',
        minRole: 'VIEWER',
        icon: DataAnalysis,
        hidden: true,
      },
      {
        title: pageTitle('/files/templates'),
        path: '/files/templates',
        minRole: 'VIEWER',
        authorities: ['ROLE_ADMIN', 'ROLE_TENANT_ADMIN', 'ROLE_AUDITOR'],
        icon: Document,
      },
      {
        title: pageTitle('/files/channels'),
        path: '/files/channels',
        minRole: 'VIEWER',
        authorities: ['ROLE_ADMIN', 'ROLE_TENANT_ADMIN', 'ROLE_AUDITOR'],
        icon: Connection,
        hidden: true,
      },
    ],
  },
  scheduling: {
    key: 'scheduling',
    title: '调度资源',
    icon: DataAnalysis,
    minRole: 'VIEWER',
    children: [
      {
        title: pageTitle('/scheduler/snapshot'),
        path: '/scheduler/snapshot',
        minRole: 'VIEWER',
        subGroup: 'schedulingRuntime',
        icon: TrendCharts,
      },
      {
        title: pageTitle('/scheduler/batch-days'),
        path: '/scheduler/batch-days',
        minRole: 'VIEWER',
        subGroup: 'schedulingRuntime',
        icon: CalendarCheck,
      },
      {
        title: pageTitle('/system/triggers'),
        path: '/system/triggers',
        minRole: 'OPERATOR',
        subGroup: 'schedulingRuntime',
        icon: Timer,
      },
      {
        title: pageTitle('/workers/management'),
        path: '/workers/management',
        minRole: 'OPERATOR',
        subGroup: 'schedulingRuntime',
        icon: Server,
      },
      {
        title: pageTitle('/ops/batch-day-replay'),
        path: '/ops/batch-day-replay',
        minRole: 'OPERATOR',
        icon: DataAnalysis,
        hidden: true,
      },
      {
        title: pageTitle('/governance/calendars'),
        path: '/governance/calendars',
        minRole: 'OPERATOR',
        authorities: ['ROLE_ADMIN', 'ROLE_TENANT_ADMIN'],
        subGroup: 'schedulingRules',
        icon: Calendar,
      },
      {
        title: pageTitle('/governance/windows'),
        path: '/governance/windows',
        minRole: 'ADMIN',
        subGroup: 'schedulingRules',
        icon: Clock,
      },
      {
        title: pageTitle('/governance/queues'),
        path: '/governance/queues',
        minRole: 'ADMIN',
        subGroup: 'schedulingRules',
        icon: Tools,
      },
      {
        title: pageTitle('/governance/quota'),
        path: '/governance/quota',
        minRole: 'ADMIN',
        subGroup: 'schedulingRules',
        icon: Briefcase,
      },
    ],
  },
  system: {
    key: 'system',
    title: '平台管理',
    icon: Setting,
    minRole: 'VIEWER',
    children: [
      {
        title: pageTitle('/system/tenants'),
        path: '/system/tenants',
        minRole: 'OPERATOR',
        icon: Building2,
      },
      {
        title: pageTitle('/system/user-accounts'),
        path: '/system/user-accounts',
        minRole: 'OPERATOR',
        authorities: ['ROLE_ADMIN', 'ROLE_TENANT_ADMIN'],
        icon: UserCog,
      },
      {
        title: pageTitle('/config/releases'),
        path: '/config/releases',
        minRole: 'VIEWER',
        authorities: ['ROLE_ADMIN', 'ROLE_TENANT_ADMIN', 'ROLE_AUDITOR'],
        icon: Upload,
      },
      {
        title: pageTitle('/config/management'),
        path: '/config/management',
        minRole: 'VIEWER',
        authorities: ['ROLE_ADMIN', 'ROLE_TENANT_ADMIN', 'ROLE_AUDITOR'],
        icon: Operation,
      },
      {
        title: pageTitle('/observability/audit'),
        path: '/observability/audit',
        minRole: 'VIEWER',
        authorities: ['ROLE_ADMIN', 'ROLE_TENANT_ADMIN', 'ROLE_AUDITOR'],
        menuAccessFallbacks: ['/observability/audits', '/observability/operation-audits'],
        icon: Memo,
      },
      {
        title: pageTitle('/system/settings'),
        path: '/system/settings',
        minRole: 'OPERATOR',
        menuAccessFallbacks: ['/system/parameters', '/system/tags', '/system/atomic-task-types'],
        icon: Setting,
      },
      {
        title: pageTitle('/system/tags'),
        path: '/system/tags',
        minRole: 'OPERATOR',
        icon: PriceTag,
        hidden: true,
      },
      {
        title: pageTitle('/system/ai-chat'),
        path: '/system/ai-chat',
        minRole: 'VIEWER',
        capabilities: ['AI_ASSISTANT_USE'],
        icon: Document,
        hidden: true,
      },
      {
        title: pageTitle('/system/api-keys'),
        path: '/system/api-keys',
        minRole: 'VIEWER',
        authorities: ['ROLE_ADMIN', 'ROLE_TENANT_ADMIN', 'ROLE_TENANT_USER'],
        icon: Key,
        hidden: true,
      },
      {
        title: pageTitle('/system/parameters'),
        path: '/system/parameters',
        minRole: 'ADMIN',
        icon: Setting,
        hidden: true,
      },
      {
        title: pageTitle('/system/maintenance'),
        path: '/system/maintenance',
        minRole: 'ADMIN',
        authorities: ['ROLE_ADMIN'],
        icon: Tools,
        menuAccessFallbacks: ['/system/parameters'],
        hidden: true,
      },
      {
        title: pageTitle('/system/atomic-task-types'),
        path: '/system/atomic-task-types',
        minRole: 'OPERATOR',
        icon: Box,
        hidden: true,
      },
      {
        title: pageTitle('/ops/shard-catalog'),
        path: '/ops/shard-catalog',
        minRole: 'ADMIN',
        menuAccessFallbacks: ['/ops/tenant-placements'],
        icon: Coin,
        hidden: true,
      },
    ],
  },
} satisfies {
  [Key in NavigationGroupKey]: NavigationGroup & { key: Key }
}

export const navigationGroups: NavigationGroup[] = navigationGroupOrder.map(
  (key) => navigationGroupsByKey[key],
)
