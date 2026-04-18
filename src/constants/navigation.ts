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

/** 与设计文档对齐的侧边栏（路径即路由 path） */
export const navigationGroups: NavigationGroup[] = [
  {
    key: 'ops',
    title: '运营概览',
    icon: Histogram,
    children: [
      { title: '控制面板快照', path: '/ops/summary', minRole: 'VIEWER', icon: TrendCharts },
      { title: '审批中心', path: '/approvals', minRole: 'OPERATOR', icon: Stamp },
      { title: '导出中心', path: '/reports', minRole: 'VIEWER', icon: Download },
      { title: '自助服务', path: '/self-service', minRole: 'OPERATOR', icon: Tickets },
      { title: '运维诊断', path: '/ops/diagnostic', minRole: 'ADMIN', icon: Tools },
    ],
  },
  {
    key: 'config',
    title: '配置与发布',
    icon: Operation,
    minRole: 'OPERATOR',
    children: [
      { title: '配置发布', path: '/config/releases', minRole: 'OPERATOR', icon: DocumentChecked },
      { title: 'Excel 维护', path: '/config/excel', minRole: 'OPERATOR', icon: List },
      { title: '合并导入', path: '/config/tenant-package', minRole: 'OPERATOR', icon: Box },
      { title: '配置管理', path: '/config/management', minRole: 'OPERATOR', icon: Memo },
      { title: '标签管理', path: '/system/tags', minRole: 'OPERATOR', icon: PriceTag },
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
        title: '文件组到达治理',
        path: '/files/arrival-groups',
        minRole: 'VIEWER',
        icon: CollectionTag,
      },
      { title: '流水线观测', path: '/files/pipeline-obs', minRole: 'VIEWER', icon: DataAnalysis },
    ],
  },
  {
    key: 'jobs',
    title: '任务管理',
    icon: Management,
    children: [
      { title: 'Job 定义', path: '/jobs/definitions', minRole: 'VIEWER', icon: List },
      {
        title: 'Workflow 定义',
        path: '/workflow/definitions',
        minRole: 'VIEWER',
        icon: Collection,
      },
      { title: 'Pipeline 定义', path: '/jobs/pipelines', minRole: 'VIEWER', icon: Share },
      { title: 'Workflow 编排', path: '/workflow/designer', minRole: 'OPERATOR', icon: Guide },
    ],
  },
  {
    key: 'monitor',
    title: '执行与观测',
    icon: Monitor,
    children: [
      { title: 'Job Instance', path: '/monitor/job-instances', minRole: 'VIEWER', icon: Monitor },
      { title: 'Job Step Instance', path: '/monitor/job-steps', minRole: 'VIEWER', icon: Timer },
      { title: 'Workflow Run', path: '/monitor/workflow-runs', minRole: 'VIEWER', icon: Promotion },
      { title: '日志', path: '/logs', minRole: 'VIEWER', icon: Reading },
      { title: '告警', path: '/observability/alerts', minRole: 'VIEWER', icon: WarningFilled },
      { title: '审计', path: '/observability/audits', minRole: 'VIEWER', icon: Memo },
      { title: 'Outbox', path: '/observability/outbox', minRole: 'OPERATOR', icon: Box },
      { title: '可观测性查询', path: '/observability/queries', minRole: 'VIEWER', icon: Search },
      { title: '事件目录', path: '/system/event-catalog', minRole: 'VIEWER', icon: Collection },
    ],
  },
  {
    key: 'scheduler',
    title: '调度与治理',
    icon: DataAnalysis,
    minRole: 'VIEWER',
    children: [
      { title: '调度快照', path: '/scheduler/snapshot', minRole: 'VIEWER', icon: TrendCharts },
      { title: '批次日与窗口', path: '/scheduler/batch-days', minRole: 'VIEWER', icon: Calendar },
      {
        title: 'Catch-up 审批',
        path: '/scheduler/catch-up-approvals',
        minRole: 'VIEWER',
        icon: Memo,
      },
      { title: '租户配额', path: '/governance/quota', minRole: 'OPERATOR', icon: Briefcase },
      { title: '队列 & 窗口', path: '/governance/queues', minRole: 'ADMIN', icon: Tools },
      { title: 'Worker 管理', path: '/workers/management', minRole: 'OPERATOR', icon: Cpu },
      { title: 'Trigger 管理', path: '/system/triggers', minRole: 'OPERATOR', icon: Timer },
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
      { title: '当前登录态', path: '/system/users', minRole: 'ADMIN', icon: Tickets },
      { title: 'AI 助手', path: '/system/ai-chat', minRole: 'ADMIN', icon: Document },
      { title: 'API Key', path: '/system/api-keys', minRole: 'ADMIN', icon: Key },
      { title: '系统参数', path: '/system/parameters', minRole: 'ADMIN', icon: Setting },
      { title: '通知与投递', path: '/system/notifications', minRole: 'OPERATOR', icon: Bell },
    ],
  },
]
