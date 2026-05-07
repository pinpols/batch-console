import type { Component } from 'vue'
import type { Role } from '@/types'
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
 * - "事件目录"留在观测组(用户翻 Outbox/审计时顺手能查)
 */
export const navigationGroups: NavigationGroup[] = [
  {
    key: 'workspace',
    title: '工作台',
    icon: Histogram,
    children: [
      { title: '控制面板', path: '/ops/summary', minRole: 'VIEWER', icon: TrendCharts },
      { title: '审批中心', path: '/approvals', minRole: 'OPERATOR', icon: Stamp },
      { title: '报表中心', path: '/reports', minRole: 'VIEWER', icon: Download },
      { title: '自助服务', path: '/self-service', minRole: 'OPERATOR', icon: Tickets },
    ],
  },
  {
    key: 'jobs',
    title: '任务管理',
    icon: Management,
    children: [
      { title: '作业定义', path: '/jobs/definitions', minRole: 'VIEWER', icon: List },
      {
        title: '工作流定义',
        path: '/workflow/definitions',
        minRole: 'VIEWER',
        icon: Collection,
      },
      { title: '流水线定义', path: '/jobs/pipelines', minRole: 'VIEWER', icon: Share },
      { title: '工作流编排', path: '/workflow/designer', minRole: 'OPERATOR', icon: Guide },
    ],
  },
  {
    key: 'monitor',
    title: '执行监控',
    icon: Monitor,
    children: [
      { title: '作业实例', path: '/monitor/job-instances', minRole: 'VIEWER', icon: Monitor },
      { title: '作业步骤', path: '/monitor/job-steps', minRole: 'VIEWER', icon: Timer },
      { title: '工作流运行', path: '/monitor/workflow-runs', minRole: 'VIEWER', icon: Promotion },
      { title: '调度快照', path: '/scheduler/snapshot', minRole: 'VIEWER', icon: TrendCharts },
      { title: '批次日与窗口', path: '/scheduler/batch-days', minRole: 'VIEWER', icon: Calendar },
    ],
  },
  {
    key: 'observability',
    title: '观测与告警',
    icon: WarningFilled,
    children: [
      { title: '告警', path: '/observability/alerts', minRole: 'VIEWER', icon: WarningFilled },
      { title: '审计日志', path: '/observability/audits', minRole: 'VIEWER', icon: Memo },
      { title: 'Outbox', path: '/observability/outbox', minRole: 'OPERATOR', icon: Box },
      { title: '综合查询', path: '/observability/queries', minRole: 'VIEWER', icon: Search },
      { title: '事件目录', path: '/system/event-catalog', minRole: 'VIEWER', icon: Collection },
    ],
  },
  {
    key: 'files',
    title: '文件中心',
    icon: FolderOpened,
    children: [
      { title: '文件列表', path: '/files/list', minRole: 'VIEWER', icon: Files },
      { title: '文件模板', path: '/files/templates', minRole: 'VIEWER', icon: Document },
      {
        title: '到达组治理',
        path: '/files/arrival-groups',
        minRole: 'VIEWER',
        icon: CollectionTag,
      },
      { title: '流水线观测', path: '/files/pipeline-obs', minRole: 'VIEWER', icon: DataAnalysis },
    ],
  },
  {
    key: 'config',
    title: '配置发布',
    icon: Operation,
    minRole: 'OPERATOR',
    children: [
      { title: '配置发布', path: '/config/releases', minRole: 'OPERATOR', icon: DocumentChecked },
      { title: '变更与同步', path: '/config/management', minRole: 'OPERATOR', icon: Memo },
      { title: '标签管理', path: '/system/tags', minRole: 'OPERATOR', icon: PriceTag },
      { title: 'Excel 维护', path: '/config/excel', minRole: 'OPERATOR', icon: List },
      { title: '配置批量导入', path: '/config/tenant-package', minRole: 'OPERATOR', icon: Box },
    ],
  },
  {
    key: 'runtime',
    title: '运行时资源',
    icon: Cpu,
    minRole: 'OPERATOR',
    children: [
      { title: 'Worker', path: '/workers/management', minRole: 'OPERATOR', icon: Cpu },
      { title: '触发器', path: '/system/triggers', minRole: 'OPERATOR', icon: Timer },
      { title: '队列与窗口', path: '/governance/queues', minRole: 'ADMIN', icon: Connection },
      { title: '租户配额', path: '/governance/quota', minRole: 'OPERATOR', icon: Briefcase },
    ],
  },
  {
    key: 'system',
    title: '系统',
    icon: Setting,
    minRole: 'OPERATOR',
    children: [
      { title: '租户管理', path: '/system/tenants', minRole: 'OPERATOR', icon: Briefcase },
      { title: '用户账户', path: '/system/user-accounts', minRole: 'ADMIN', icon: Tickets },
      // /system/users(权限自查)从主菜单撤下,改由 Header 右上 dropdown 触发(ADMIN 可见)
      { title: '通知与投递', path: '/system/notifications', minRole: 'OPERATOR', icon: Bell },
      { title: '系统参数', path: '/system/parameters', minRole: 'ADMIN', icon: Setting },
      { title: 'API Key', path: '/system/api-keys', minRole: 'ADMIN', icon: Key },
      { title: 'AI 助手', path: '/system/ai-chat', minRole: 'ADMIN', icon: Document },
      { title: '运维诊断', path: '/ops/diagnostic', minRole: 'ADMIN', icon: Tools },
    ],
  },
]
