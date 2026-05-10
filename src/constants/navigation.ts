import type { Component } from 'vue'
import type { Role } from '@/types'
import { pageTitle } from '@/constants/pageMeta'
import {
  Bell,
  Box,
  Briefcase,
  Calendar,
  Collection,
  CollectionTag,
  Connection,
  Cpu,
  Document,
  DocumentChecked,
  Files,
  FolderOpened,
  Guide,
  DataAnalysis,
  Download,
  Histogram,
  Key,
  List,
  Management,
  Memo,
  Monitor,
  Operation,
  PriceTag,
  Promotion,
  Reading,
  Search,
  Share,
  Setting,
  Stamp,
  Timer,
  Tickets,
  TrendCharts,
  Tools,
  User,
  OfficeBuilding,
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
 * 侧边栏分组(2026-05 中英文统一 + IA 重排版本)。
 *
 * 命名规则:
 * - 领域对象走中文翻译(Job → 作业 / Workflow → 工作流 / Pipeline → 流水线 / Trigger → 触发器)
 * - 业界专名 / 架构模式名保留英文(Outbox / Worker / API Key / AI / Excel)
 * - 同组里"X 管理"能省就省
 *
 * 结构原则:
 * - 8 组,每组 ≤ 6 项;按"日常使用流"自上而下排
 * - "运行时/调度配置"和"task 定义"分组,前者管"怎么跑"后者管"跑什么"
 * - 顶级"执行日志"撤掉,综合查询里有 ExecutionLogs Tab(/logs 路由 redirect 到 /observability/queries?tab=executionLogs)
 * - 告警、通知、Outbox、事件目录放在观测查询组,方便排障时顺手查上下游
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
        icon: Tickets,
      },
    ],
  },
  {
    key: 'jobs',
    title: '定义与编排',
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
        icon: Share,
      },
      {
        title: pageTitle('/workflow/designer'),
        path: '/workflow/designer',
        minRole: 'OPERATOR',
        icon: Guide,
      },
    ],
  },
  {
    key: 'monitor',
    title: '执行与监控',
    icon: Monitor,
    children: [
      {
        title: pageTitle('/monitor/job-instances'),
        path: '/monitor/job-instances',
        minRole: 'VIEWER',
        icon: Monitor,
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
      {
        title: pageTitle('/scheduler/snapshot'),
        path: '/scheduler/snapshot',
        minRole: 'VIEWER',
        icon: TrendCharts,
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
    key: 'config',
    title: '配置管理',
    icon: Operation,
    minRole: 'OPERATOR',
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
      { title: pageTitle('/config/excel'), path: '/config/excel', minRole: 'OPERATOR', icon: List },
      {
        title: pageTitle('/config/tenant-package'),
        path: '/config/tenant-package',
        minRole: 'OPERATOR',
        icon: Box,
      },
    ],
  },
  {
    key: 'observability',
    title: '观测与查询',
    icon: WarningFilled,
    children: [
      {
        title: pageTitle('/observability/alerts'),
        path: '/observability/alerts',
        minRole: 'VIEWER',
        icon: WarningFilled,
      },
      {
        title: pageTitle('/observability/audits'),
        path: '/observability/audits',
        minRole: 'VIEWER',
        icon: Memo,
      },
      {
        title: pageTitle('/observability/outbox'),
        path: '/observability/outbox',
        minRole: 'OPERATOR',
        icon: Box,
      },
      {
        title: pageTitle('/system/notifications'),
        path: '/system/notifications',
        minRole: 'OPERATOR',
        icon: Bell,
      },
      {
        title: pageTitle('/observability/queries'),
        path: '/observability/queries',
        minRole: 'VIEWER',
        icon: Search,
      },
      {
        title: pageTitle('/system/event-catalog'),
        path: '/system/event-catalog',
        minRole: 'VIEWER',
        icon: Collection,
      },
    ],
  },
  {
    key: 'runtime',
    title: '运行配置',
    icon: Cpu,
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
        icon: Connection,
      },
      {
        title: pageTitle('/governance/quota'),
        path: '/governance/quota',
        minRole: 'OPERATOR',
        icon: Briefcase,
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
        // 租户实例:SaaS 隔离单位 → 用 OfficeBuilding(组织/楼宇),区分于"账户=个人"
        title: pageTitle('/system/tenants'),
        path: '/system/tenants',
        minRole: 'OPERATOR',
        icon: OfficeBuilding,
      },
      {
        // 登录账户:控制台真人账号 → 用 User(单人头像),区分于"租户=组织实例"
        title: pageTitle('/system/user-accounts'),
        path: '/system/user-accounts',
        minRole: 'ADMIN',
        icon: User,
      },
      // /system/users(权限自查)从主菜单撤下,改由 Header 右上 dropdown 触发(ADMIN 可见)
      {
        title: pageTitle('/system/parameters'),
        path: '/system/parameters',
        minRole: 'ADMIN',
        icon: Setting,
      },
      {
        title: pageTitle('/system/api-keys'),
        path: '/system/api-keys',
        minRole: 'ADMIN',
        icon: Key,
      },
      {
        title: pageTitle('/system/ai-chat'),
        path: '/system/ai-chat',
        minRole: 'ADMIN',
        icon: Document,
      },
      {
        title: pageTitle('/ops/diagnostic'),
        path: '/ops/diagnostic',
        minRole: 'ADMIN',
        icon: Tools,
      },
    ],
  },
]
