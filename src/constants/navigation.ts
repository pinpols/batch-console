import type { Component } from 'vue'
import type { Role } from '@/types'
import { pageTitle } from '@/constants/pageMeta'
import {
  Aim,
  Bell,
  Box,
  Calendar,
  ChatLineRound,
  Collection,
  CollectionTag,
  Connection,
  Cpu,
  DataAnalysis,
  Document,
  DocumentChecked,
  Download,
  EditPen,
  Files,
  FolderOpened,
  Histogram,
  Key,
  List,
  Management,
  Memo,
  MessageBox,
  Notebook,
  OfficeBuilding,
  Operation,
  PieChart,
  PriceTag,
  Promotion,
  Reading,
  Search,
  Service,
  Setting,
  Stamp,
  Timer,
  Tools,
  TrendCharts,
  User,
  VideoPlay,
  View,
  WarningFilled,
} from '@element-plus/icons-vue'

export interface NavigationItem {
  title: string
  path: string
  icon?: Component
  minRole?: Role
}

export interface NavigationGroup {
  key: string
  title: string
  icon: Component
  minRole?: Role
  children: NavigationItem[]
}

/**
 * 侧边栏分组(2026-05-13 IA 重排,从 8 组降到 6 组)。
 *
 * 改动:
 * - 新增 Runs 组(全部运行 / 作业运行 / 工作流运行 / 步骤 / 调度快照 / Trace),取代旧"执行与监控"
 * - 告警与配置(原 observability + config 合并),把告警/告警路由 + 发布/变更/标签/批量导入 + 事件目录 + 综合查询 放一起
 * - 基础设施(原"运行配置" + "系统管理" + Outbox/通知/审计/运维诊断/AI 合并),admin 类全归一组
 * - 定义组从"定义与编排"改名为"定义"
 *
 * 参考 docs/ui/2026-05-13-ia-refactor-and-run-centric.md
 */
export const navigationGroups: NavigationGroup[] = [
  {
    key: 'workspace',
    title: '工作台',
    icon: Histogram,
    children: [
      {
        title: pageTitle('/ops/summary'),
        path: '/ops/summary',
        minRole: 'VIEWER',
        icon: TrendCharts,
      },
      { title: pageTitle('/approvals'), path: '/approvals', minRole: 'OPERATOR', icon: Stamp },
      { title: pageTitle('/reports'), path: '/reports', minRole: 'VIEWER', icon: Download },
      {
        title: pageTitle('/self-service'),
        path: '/self-service',
        minRole: 'OPERATOR',
        icon: Service,
      },
    ],
  },
  {
    // 新顶级 Runs 组:把所有"运行实例"相关入口集中,oncall 排障"先来这里"
    key: 'runs',
    title: 'Runs',
    icon: VideoPlay,
    children: [
      {
        // 全部运行:跨实体最近运行聚合页(P0 新增)
        title: pageTitle('/runs'),
        path: '/runs',
        minRole: 'VIEWER',
        icon: View,
      },
      {
        title: pageTitle('/monitor/job-instances'),
        path: '/monitor/job-instances',
        minRole: 'VIEWER',
        icon: VideoPlay,
      },
      {
        title: pageTitle('/monitor/workflow-runs'),
        path: '/monitor/workflow-runs',
        minRole: 'VIEWER',
        icon: Promotion,
      },
      {
        title: pageTitle('/monitor/job-steps'),
        path: '/monitor/job-steps',
        minRole: 'VIEWER',
        icon: Operation,
      },
      {
        title: pageTitle('/scheduler/snapshot'),
        path: '/scheduler/snapshot',
        minRole: 'VIEWER',
        icon: Aim,
      },
      {
        title: pageTitle('/observability/trace'),
        path: '/observability/trace',
        minRole: 'VIEWER',
        icon: Search,
      },
    ],
  },
  {
    key: 'definitions',
    title: '定义',
    icon: Management,
    children: [
      {
        title: pageTitle('/jobs/definitions'),
        path: '/jobs/definitions',
        minRole: 'VIEWER',
        icon: List,
      },
      {
        title: pageTitle('/workflow/definitions'),
        path: '/workflow/definitions',
        minRole: 'VIEWER',
        icon: Collection,
      },
      {
        title: pageTitle('/jobs/pipelines'),
        path: '/jobs/pipelines',
        minRole: 'VIEWER',
        icon: Connection,
      },
      {
        title: pageTitle('/workflow/designer'),
        path: '/workflow/designer',
        minRole: 'OPERATOR',
        icon: EditPen,
      },
    ],
  },
  {
    key: 'files',
    title: '文件中心',
    icon: FolderOpened,
    children: [
      { title: pageTitle('/files/list'), path: '/files/list', minRole: 'VIEWER', icon: Files },
      {
        title: pageTitle('/files/templates'),
        path: '/files/templates',
        minRole: 'VIEWER',
        icon: Document,
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
    ],
  },
  {
    // 告警与配置:告警/路由 + 配置发布/变更/标签/批量导入 + 事件目录 + 综合查询
    key: 'alerting',
    title: '告警与配置',
    icon: WarningFilled,
    minRole: 'VIEWER',
    children: [
      {
        title: pageTitle('/observability/alerts'),
        path: '/observability/alerts',
        minRole: 'VIEWER',
        icon: WarningFilled,
      },
      {
        title: pageTitle('/observability/alert-routings'),
        path: '/observability/alert-routings',
        minRole: 'OPERATOR',
        icon: Bell,
      },
      {
        title: pageTitle('/config/releases'),
        path: '/config/releases',
        minRole: 'OPERATOR',
        icon: DocumentChecked,
      },
      {
        title: pageTitle('/config/management'),
        path: '/config/management',
        minRole: 'OPERATOR',
        icon: Memo,
      },
      {
        title: pageTitle('/system/tags'),
        path: '/system/tags',
        minRole: 'OPERATOR',
        icon: PriceTag,
      },
      {
        title: pageTitle('/config/tenant-package'),
        path: '/config/tenant-package',
        minRole: 'OPERATOR',
        icon: Box,
      },
      {
        title: pageTitle('/system/event-catalog'),
        path: '/system/event-catalog',
        minRole: 'VIEWER',
        icon: Reading,
      },
      {
        title: pageTitle('/observability/queries'),
        path: '/observability/queries',
        minRole: 'VIEWER',
        icon: Search,
      },
    ],
  },
  {
    // 基础设施:运行时调度参数 + 租户/账户/参数/Key + Outbox/通知/审计/诊断/AI
    key: 'infra',
    title: '基础设施',
    icon: Tools,
    minRole: 'OPERATOR',
    children: [
      {
        title: pageTitle('/workers/management'),
        path: '/workers/management',
        minRole: 'OPERATOR',
        icon: Cpu,
      },
      {
        title: pageTitle('/system/triggers'),
        path: '/system/triggers',
        minRole: 'OPERATOR',
        icon: Timer,
      },
      {
        title: pageTitle('/scheduler/batch-days'),
        path: '/scheduler/batch-days',
        minRole: 'VIEWER',
        icon: Calendar,
      },
      {
        title: pageTitle('/governance/queues'),
        path: '/governance/queues',
        minRole: 'ADMIN',
        icon: Management,
      },
      {
        title: pageTitle('/governance/quota'),
        path: '/governance/quota',
        minRole: 'OPERATOR',
        icon: PieChart,
      },
      {
        title: pageTitle('/system/tenants'),
        path: '/system/tenants',
        minRole: 'OPERATOR',
        icon: OfficeBuilding,
      },
      {
        title: pageTitle('/system/user-accounts'),
        path: '/system/user-accounts',
        minRole: 'ADMIN',
        icon: User,
      },
      {
        title: pageTitle('/system/api-keys'),
        path: '/system/api-keys',
        minRole: 'ADMIN',
        icon: Key,
      },
      {
        title: pageTitle('/system/parameters'),
        path: '/system/parameters',
        minRole: 'ADMIN',
        icon: Setting,
      },
      {
        title: pageTitle('/observability/outbox'),
        path: '/observability/outbox',
        minRole: 'OPERATOR',
        icon: MessageBox,
      },
      {
        title: pageTitle('/system/notifications'),
        path: '/system/notifications',
        minRole: 'OPERATOR',
        icon: Bell,
      },
      {
        title: pageTitle('/observability/audits'),
        path: '/observability/audits',
        minRole: 'VIEWER',
        icon: Notebook,
      },
      {
        title: pageTitle('/ops/diagnostic'),
        path: '/ops/diagnostic',
        minRole: 'ADMIN',
        icon: DataAnalysis,
      },
      {
        title: pageTitle('/system/ai-chat'),
        path: '/system/ai-chat',
        minRole: 'ADMIN',
        icon: ChatLineRound,
      },
    ],
  },
]
