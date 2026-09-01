import type { Component } from 'vue'
import type { Role } from '@/types'
import { pageTitle } from '@/constants/pageMeta'
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
  Ticket as Tickets,
  TriangleAlert as WarningFilled,
  // 按设计源逐项对齐的专用图标(从 .dc.html DOM 抠出的每个 nav 项真实图标)
  Check,
  Zap,
  CirclePlay,
  Play,
  Server,
  Building2,
  CalendarCheck,
  Folder as FolderClosed,
  Upload,
} from 'lucide-vue-next'

export interface NavigationItem {
  title: string
  path: string
  icon?: Component
  minRole?: Role
  /** 隐藏出现在侧边栏,但 Command Palette / 内嵌跳转 仍可达 */
  hidden?: boolean
  /**
   * 显式 i18n 标题 key(覆盖按 path 推导的 page.<pathKey>.title)。
   * path 带 query(如 Catch-up = /approvals?tab=catch-up)时,pathToKey 推不出正确 key,
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

/**
 * 侧边栏分组采用 redesign IA v3 的 7 组口径。
 *
 * 后端 `/auth/me` 返回的菜单会参与路由 allowlist,所以这里必须覆盖后端 menu.yml 的全部
 * path;分组按前端设计稿收敛为 7 组。后端 `TENANT_ADMIN` 在前端统一映射为 `OPERATOR`。
 */
export const navigationGroups: NavigationGroup[] = [
  {
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
      { title: pageTitle('/approvals'), path: '/approvals', minRole: 'OPERATOR', icon: Check },
      { title: pageTitle('/reports'), path: '/reports', minRole: 'VIEWER', icon: DataAnalysis },
      {
        title: pageTitle('/self-service'),
        path: '/self-service',
        minRole: 'OPERATOR',
        icon: Zap,
      },
    ],
  },
  {
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
      },
      {
        title: pageTitle('/monitor/workflow-runs'),
        path: '/monitor/workflow-runs',
        minRole: 'VIEWER',
        icon: Promotion,
      },
      // 保留兼容深链和命令面板入口,侧栏统一使用工作流运行监控入口。
      {
        title: pageTitle('/runs'),
        path: '/runs',
        minRole: 'VIEWER',
        icon: CirclePlay,
        hidden: true,
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
  {
    key: 'alerting',
    title: '告警与投递',
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
        title: pageTitle('/observability/alert-routings'),
        path: '/observability/alert-routings',
        minRole: 'OPERATOR',
        icon: Promotion,
        hidden: true,
      },
      {
        title: pageTitle('/system/notifications'),
        path: '/system/notifications',
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
  {
    key: 'definitions',
    title: '作业与流程',
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
        title: pageTitle('/jobs/pipelines'),
        path: '/jobs/pipelines',
        minRole: 'VIEWER',
        icon: DataLine,
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
      },
      {
        title: pageTitle('/config/tenant-package'),
        path: '/config/tenant-package',
        minRole: 'OPERATOR',
        icon: Box,
      },
    ],
  },
  {
    key: 'files',
    title: '文件',
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
      },
      {
        title: pageTitle('/files/pipeline-obs'),
        path: '/files/pipeline-obs',
        minRole: 'VIEWER',
        icon: DataAnalysis,
      },
      {
        title: pageTitle('/files/templates'),
        path: '/files/templates',
        minRole: 'VIEWER',
        icon: Document,
      },
      {
        title: pageTitle('/files/channels'),
        path: '/files/channels',
        minRole: 'VIEWER',
        icon: Connection,
      },
    ],
  },
  {
    key: 'scheduling',
    title: '调度治理',
    icon: DataAnalysis,
    minRole: 'VIEWER',
    children: [
      {
        title: pageTitle('/workers/management'),
        path: '/workers/management',
        minRole: 'OPERATOR',
        icon: Server,
      },
      {
        title: pageTitle('/system/triggers'),
        path: '/system/triggers',
        minRole: 'OPERATOR',
        icon: Timer,
      },
      {
        title: pageTitle('/scheduler/snapshot'),
        path: '/scheduler/snapshot',
        minRole: 'VIEWER',
        icon: TrendCharts,
      },
      {
        title: pageTitle('/scheduler/batch-days'),
        path: '/scheduler/batch-days',
        minRole: 'VIEWER',
        icon: CalendarCheck,
      },
      {
        title: pageTitle('/ops/batch-day-replay'),
        path: '/ops/batch-day-replay',
        minRole: 'OPERATOR',
        icon: DataAnalysis,
      },
      {
        title: pageTitle('/ops/capacity-profile'),
        path: '/ops/capacity-profile',
        minRole: 'VIEWER',
        icon: PieChart,
        hidden: true,
      },
      {
        title: pageTitle('/ops/asset-freshness'),
        path: '/ops/asset-freshness',
        minRole: 'OPERATOR',
        icon: Timer,
        hidden: true,
      },
      // 「Catch-up 审批」入口已去重(用户反馈):与工作台「审批中心」的 catch-up tab
      // 指向同一页面,双入口重复;审批统一从审批中心进。
      {
        title: pageTitle('/governance/calendars'),
        path: '/governance/calendars',
        minRole: 'OPERATOR',
        icon: Calendar,
        hidden: true,
      },
      {
        title: pageTitle('/governance/windows'),
        path: '/governance/windows',
        minRole: 'OPERATOR',
        icon: Clock,
        hidden: true,
      },
      {
        title: pageTitle('/governance/quota'),
        path: '/governance/quota',
        minRole: 'OPERATOR',
        icon: Briefcase,
        hidden: true,
      },
      {
        title: pageTitle('/governance/queues'),
        path: '/governance/queues',
        minRole: 'OPERATOR',
        icon: Tools,
        hidden: true,
      },
      {
        title: pageTitle('/ops/custom-task-types'),
        path: '/ops/custom-task-types',
        minRole: 'OPERATOR',
        icon: Grid,
        hidden: true,
      },
      {
        title: pageTitle('/ops/worker-fingerprints'),
        path: '/ops/worker-fingerprints',
        minRole: 'OPERATOR',
        icon: Aim,
        hidden: true,
      },
      {
        title: pageTitle('/ops/shard-catalog'),
        path: '/ops/shard-catalog',
        minRole: 'ADMIN',
        icon: Coin,
        hidden: true,
      },
      {
        title: pageTitle('/ops/tenant-placements'),
        path: '/ops/tenant-placements',
        minRole: 'ADMIN',
        icon: Collection,
        hidden: true,
      },
    ],
  },
  {
    key: 'system',
    title: '系统管理',
    icon: Setting,
    minRole: 'OPERATOR',
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
        minRole: 'ADMIN',
        icon: Tickets,
      },
      {
        title: pageTitle('/system/users'),
        path: '/system/users',
        minRole: 'ADMIN',
        icon: Tickets,
        hidden: true,
      },
      {
        title: pageTitle('/config/releases'),
        path: '/config/releases',
        minRole: 'OPERATOR',
        icon: Upload,
      },
      {
        title: pageTitle('/config/management'),
        path: '/config/management',
        minRole: 'OPERATOR',
        icon: Operation,
      },
      {
        title: pageTitle('/observability/audits'),
        path: '/observability/audits',
        minRole: 'VIEWER',
        icon: Memo,
      },
      {
        title: pageTitle('/observability/operation-audits'),
        path: '/observability/operation-audits',
        minRole: 'VIEWER',
        icon: Document,
      },
      {
        title: pageTitle('/system/event-catalog'),
        path: '/system/event-catalog',
        minRole: 'VIEWER',
        icon: Collection,
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
        minRole: 'ADMIN',
        icon: Document,
        hidden: true,
      },
      {
        title: pageTitle('/system/api-keys'),
        path: '/system/api-keys',
        minRole: 'ADMIN',
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
        title: pageTitle('/system/atomic-task-types'),
        path: '/system/atomic-task-types',
        minRole: 'OPERATOR',
        icon: Box,
        hidden: true,
      },
    ],
  },
]
