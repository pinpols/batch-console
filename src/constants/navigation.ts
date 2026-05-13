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
 * 侧边栏分组(2026-05-13 IA v2:7 组方案,易用性优先)。
 *
 * 设计原则:
 * - 每组单一心智:告警与投递 / 配置 / 系统 严格分开,不再"基础设施"杂烩
 * - 组项数控制在 ≤6(系统组项数最多,但全部是同心智的 admin 项)
 * - 排障入口聚焦在 Runs 组(Trace + 实例运行)+ 综合查询(放告警与投递,因主要查投递/审计)
 * - 组 minRole 取组内最小,避免"幽灵分组"
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
    key: 'runs',
    title: '运行',
    icon: VideoPlay,
    children: [
      {
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
        // Trace 在前:更明确的排障入口
        title: pageTitle('/observability/trace'),
        path: '/observability/trace',
        minRole: 'VIEWER',
        icon: Search,
      },
      {
        // 综合查询在后:兜底的跨域排障工具
        title: pageTitle('/observability/queries'),
        path: '/observability/queries',
        minRole: 'VIEWER',
        icon: Search,
      },
    ],
  },
  {
    key: 'definitions',
    title: '作业与工作流',
    icon: Management,
    children: [
      {
        title: pageTitle('/jobs/definitions'),
        path: '/jobs/definitions',
        minRole: 'VIEWER',
        icon: List,
      },
      {
        title: pageTitle('/jobs/pipelines'),
        path: '/jobs/pipelines',
        minRole: 'VIEWER',
        icon: Connection,
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
        icon: EditPen,
      },
    ],
  },
  {
    key: 'files',
    title: '文件',
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
        title: pageTitle('/files/channels'),
        path: '/files/channels',
        minRole: 'VIEWER',
        icon: Connection,
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
    // 告警与投递:严格"系统在发什么消息" + "怎么订阅它"
    key: 'alerting',
    title: '告警与投递',
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
    ],
  },
  {
    // 配置:发布单 / 变更同步 / 标签 / 批量导入 / 事件目录(都属"我要改/查 something")
    key: 'config',
    title: '配置',
    icon: Memo,
    minRole: 'VIEWER',
    children: [
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
    ],
  },
  {
    // 调度:operator 日常调参的运行时资源(Worker / 触发器 / 批次日 / 队列 / 配额)
    key: 'scheduling',
    title: '调度',
    icon: Timer,
    minRole: 'VIEWER',
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
        // 调度快照从"运行"挪到"调度":它是调度器视角(谁在排队/谁要发车),
        // 和 Worker / 触发器 / 队列同心智,而不是某次实例运行
        title: pageTitle('/scheduler/snapshot'),
        path: '/scheduler/snapshot',
        minRole: 'VIEWER',
        icon: Aim,
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
        title: pageTitle('/governance/windows'),
        path: '/governance/windows',
        minRole: 'ADMIN',
        icon: Timer,
      },
      {
        title: pageTitle('/governance/calendars'),
        path: '/governance/calendars',
        minRole: 'ADMIN',
        icon: Calendar,
      },
      {
        title: pageTitle('/governance/quota'),
        path: '/governance/quota',
        minRole: 'OPERATOR',
        icon: PieChart,
      },
    ],
  },
  {
    // 系统:租户/账户/Key/参数 + 审计 + 运维工具(admin 维护类)
    key: 'system',
    title: '系统',
    icon: Tools,
    minRole: 'VIEWER',
    children: [
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
        // 审计日志从"告警与投递"挪进系统组:它是"谁干了什么"的合规追溯,和运维诊断同心智
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
