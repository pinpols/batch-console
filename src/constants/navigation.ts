import type { Component } from 'vue'
import type { Role } from '@/types'
import { pageTitle } from '@/constants/pageMeta'
import {
  Aim,
  Bell,
  BellFilled,
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
  /** 隐藏出现在侧边栏,但 Command Palette / 内嵌跳转 仍可达 */
  hidden?: boolean
}

export interface NavigationGroup {
  key: string
  title: string
  icon: Component
  minRole?: Role
  children: NavigationItem[]
}

/**
 * 侧边栏分组(2026-06-21 IA v4:7 组 → 5 组,激进精简整合)。
 *
 * 设计:把"运行 + 文件可观测 + 告警"合并为「运行监控」、"作业与工作流 + 文件资产"合并为
 * 「作业与文件」,顶层从 7 组降到 5 组,减少扫描视窗。可见项保持精简(高频侧栏可见,
 * 低频 hidden:true 仅从 ⌘K / 内嵌跳转可达——路由与页面零删除、功能零损失)。
 *
 * 5 组单一心智:
 *   ① 工作台   —— 进系统先看什么 + 待我处理(总览 / 审批 / 自助)
 *   ② 运行监控 —— 跑得怎么样 + 出事看哪(运行/实例/工作流/链路/告警/诊断)
 *   ③ 作业与文件 —— 我配了什么(作业 / 管道 / 工作流 / 文件资产)
 *   ④ 调度治理 —— 谁在调度 + 资源配额(worker / 触发器 / 快照 / 批次日 / 治理)
 *   ⑤ 系统管理 —— 租户账号 + 配置发布 + 审计(admin 维护)
 *
 * 原则:每组单一心智、组项数 ≤8;高频侧栏、低频 ⌘K;旧 group key i18n 留兜底。
 * 参考 docs/engineering/page-naming-convention.md。
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
      {
        title: pageTitle('/self-service'),
        path: '/self-service',
        minRole: 'OPERATOR',
        icon: Service,
      },
      {
        title: pageTitle('/reports'),
        path: '/reports',
        minRole: 'VIEWER',
        icon: Download,
        hidden: true,
      },
    ],
  },
  {
    // 运行监控:运行态 + 排障 + 告警同心智合一(原"运行"+"告警与投递"+文件可观测)
    key: 'runtime',
    title: '运行监控',
    icon: VideoPlay,
    minRole: 'VIEWER',
    children: [
      { title: pageTitle('/runs'), path: '/runs', minRole: 'VIEWER', icon: View },
      {
        title: pageTitle('/monitor/job-instances'),
        path: '/monitor/job-instances',
        minRole: 'VIEWER',
        icon: Operation,
      },
      {
        title: pageTitle('/monitor/workflow-runs'),
        path: '/monitor/workflow-runs',
        minRole: 'VIEWER',
        icon: Promotion,
      },
      {
        title: pageTitle('/observability/trace'),
        path: '/observability/trace',
        minRole: 'VIEWER',
        icon: Search,
      },
      {
        title: pageTitle('/observability/lineage'),
        path: '/observability/lineage',
        minRole: 'VIEWER',
        icon: Connection,
        hidden: true,
      },
      {
        title: pageTitle('/observability/alerts'),
        path: '/observability/alerts',
        minRole: 'VIEWER',
        icon: WarningFilled,
      },
      {
        title: pageTitle('/ops/diagnostic'),
        path: '/ops/diagnostic',
        minRole: 'ADMIN',
        icon: DataAnalysis,
      },
      // ─── hidden,⌘K / 内嵌跳转可达 ───
      {
        title: pageTitle('/monitor/job-steps'),
        path: '/monitor/job-steps',
        minRole: 'VIEWER',
        icon: Memo,
        hidden: true,
      },
      {
        title: pageTitle('/observability/queries'),
        path: '/observability/queries',
        minRole: 'VIEWER',
        icon: Search,
        hidden: true,
      },
      { title: pageTitle('/logs'), path: '/logs', minRole: 'VIEWER', icon: Reading, hidden: true },
      {
        title: pageTitle('/observability/alert-routings'),
        path: '/observability/alert-routings',
        minRole: 'OPERATOR',
        icon: Connection,
        hidden: true,
      },
      {
        title: pageTitle('/observability/outbox'),
        path: '/observability/outbox',
        minRole: 'OPERATOR',
        icon: MessageBox,
        hidden: true,
      },
      {
        title: pageTitle('/system/notifications'),
        path: '/system/notifications',
        minRole: 'OPERATOR',
        icon: Bell,
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
        title: pageTitle('/ops/batch-day-replay'),
        path: '/ops/batch-day-replay',
        minRole: 'ADMIN',
        icon: Calendar,
        hidden: true,
      },
    ],
  },
  {
    // 作业与文件:配置态资产(原"作业与工作流"+"文件")
    key: 'assets',
    title: '作业与文件',
    icon: Management,
    minRole: 'VIEWER',
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
      { title: pageTitle('/files/list'), path: '/files/list', minRole: 'VIEWER', icon: Files },
      // ─── hidden,⌘K / 内嵌跳转可达 ───
      {
        title: pageTitle('/files/templates'),
        path: '/files/templates',
        minRole: 'VIEWER',
        icon: Document,
        hidden: true,
      },
      {
        title: pageTitle('/files/channels'),
        path: '/files/channels',
        minRole: 'VIEWER',
        icon: Connection,
        hidden: true,
      },
      {
        title: pageTitle('/files/arrival-groups'),
        path: '/files/arrival-groups',
        minRole: 'VIEWER',
        icon: CollectionTag,
        hidden: true,
      },
      {
        title: pageTitle('/config/tenant-package'),
        path: '/config/tenant-package',
        minRole: 'OPERATOR',
        icon: Box,
        hidden: true,
      },
    ],
  },
  {
    // 调度治理:运行时调度资源 + 治理配额
    key: 'scheduling',
    title: '调度治理',
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
        icon: VideoPlay,
      },
      {
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
      // ─── hidden,⌘K / 内嵌跳转可达 ───
      {
        title: pageTitle('/governance/quota'),
        path: '/governance/quota',
        minRole: 'OPERATOR',
        icon: PieChart,
        hidden: true,
      },
      {
        title: pageTitle('/governance/queues'),
        path: '/governance/queues',
        minRole: 'ADMIN',
        icon: Management,
        hidden: true,
      },
      {
        title: pageTitle('/governance/windows'),
        path: '/governance/windows',
        minRole: 'ADMIN',
        icon: Timer,
        hidden: true,
      },
      {
        title: pageTitle('/governance/calendars'),
        path: '/governance/calendars',
        minRole: 'ADMIN',
        icon: Calendar,
        hidden: true,
      },
      {
        title: pageTitle('/ops/custom-task-types'),
        path: '/ops/custom-task-types',
        minRole: 'OPERATOR',
        icon: Cpu,
        hidden: true,
      },
      {
        title: pageTitle('/ops/worker-fingerprints'),
        path: '/ops/worker-fingerprints',
        minRole: 'OPERATOR',
        icon: Cpu,
        hidden: true,
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
      {
        title: pageTitle('/scheduler/catch-up-approvals'),
        path: '/scheduler/catch-up-approvals',
        minRole: 'OPERATOR',
        icon: Stamp,
        hidden: true,
      },
    ],
  },
  {
    // 系统管理:租户账号 + 配置发布 + 审计 + 平台运维(原"配置与系统")
    key: 'system',
    title: '系统管理',
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
      // ─── hidden,⌘K / 内嵌跳转可达 ───
      {
        title: pageTitle('/system/users'),
        path: '/system/users',
        minRole: 'VIEWER',
        icon: User,
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
      {
        title: pageTitle('/observability/audits'),
        path: '/observability/audits',
        minRole: 'VIEWER',
        icon: Notebook,
        hidden: true,
      },
      {
        title: pageTitle('/observability/operation-audits'),
        path: '/observability/operation-audits',
        minRole: 'VIEWER',
        icon: Notebook,
        hidden: true,
      },
      {
        title: pageTitle('/system/tags'),
        path: '/system/tags',
        minRole: 'OPERATOR',
        icon: PriceTag,
        hidden: true,
      },
      {
        title: pageTitle('/ops/shard-catalog'),
        path: '/ops/shard-catalog',
        minRole: 'ADMIN',
        icon: Connection,
        hidden: true,
      },
      {
        title: pageTitle('/ops/tenant-placements'),
        path: '/ops/tenant-placements',
        minRole: 'ADMIN',
        icon: Collection,
        hidden: true,
      },
      {
        title: pageTitle('/system/event-catalog'),
        path: '/system/event-catalog',
        minRole: 'VIEWER',
        icon: Reading,
        hidden: true,
      },
      {
        title: pageTitle('/system/ai-chat'),
        path: '/system/ai-chat',
        minRole: 'ADMIN',
        icon: ChatLineRound,
        hidden: true,
      },
    ],
  },
]
