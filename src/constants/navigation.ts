import type { Component } from 'vue'
import type { Role } from '@/types'
import {
  Bell,
  Cpu,
  DataAnalysis,
  Document,
  FolderOpened,
  Histogram,
  Monitor,
  Setting,
  Tools,
  Tickets,
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

/** 与设计文档 §4、§8 对齐的侧边栏（路径即路由 path） */
export const navigationGroups: NavigationGroup[] = [
  {
    key: 'ops',
    title: '运营概览',
    icon: Histogram,
    children: [{ title: '控制面快照', path: '/ops/summary', minRole: 'VIEWER' }],
  },
  {
    key: 'approvals',
    title: '审批',
    icon: Tickets,
    minRole: 'OPERATOR',
    children: [{ title: '审批中心', path: '/approvals', minRole: 'OPERATOR' }],
  },
  {
    key: 'config',
    title: '配置与发布',
    icon: Setting,
    minRole: 'OPERATOR',
    children: [
      { title: '配置发布', path: '/config/releases', minRole: 'OPERATOR' },
      {
        title: 'Excel：File Templates',
        path: '/config/excel/file-templates',
        minRole: 'OPERATOR',
      },
      {
        title: 'Excel：File Channels',
        path: '/config/excel/file-channels',
        minRole: 'OPERATOR',
      },
      { title: 'Excel：Workflows', path: '/config/excel/workflows', minRole: 'OPERATOR' },
      {
        title: 'Excel：Job Definitions',
        path: '/config/excel/job-definitions',
        minRole: 'OPERATOR',
      },
    ],
  },
  {
    key: 'reports',
    title: '报表导出',
    icon: Document,
    minRole: 'VIEWER',
    children: [{ title: '导出中心', path: '/reports', minRole: 'VIEWER' }],
  },
  {
    key: 'files',
    title: '文件中心',
    icon: FolderOpened,
    children: [
      { title: '文件列表', path: '/files/list', minRole: 'VIEWER' },
      { title: '文件组到达治理', path: '/files/arrival-groups', minRole: 'VIEWER' },
    ],
  },
  {
    key: 'jobs',
    title: '任务管理',
    icon: Setting,
    children: [
      { title: 'Job 定义', path: '/jobs/definitions', minRole: 'VIEWER' },
      { title: 'Workflow 定义', path: '/workflow/definitions', minRole: 'VIEWER' },
      { title: 'Workflow 编排', path: '/workflow/designer', minRole: 'OPERATOR' },
    ],
  },
  {
    key: 'monitor',
    title: '执行监控',
    icon: Monitor,
    children: [
      { title: 'Job Instance', path: '/monitor/job-instances', minRole: 'VIEWER' },
      { title: 'Job Step Instance', path: '/monitor/job-steps', minRole: 'VIEWER' },
      { title: 'Workflow Run', path: '/monitor/workflow-runs', minRole: 'VIEWER' },
    ],
  },
  {
    key: 'observability',
    title: '观测',
    icon: Bell,
    children: [
      { title: '执行日志', path: '/logs', minRole: 'VIEWER' },
      { title: '告警', path: '/observability/alerts', minRole: 'VIEWER' },
      { title: '审计', path: '/observability/audits', minRole: 'VIEWER' },
      { title: 'Outbox', path: '/observability/outbox', minRole: 'OPERATOR' },
    ],
  },
  {
    key: 'workers',
    title: 'Worker',
    icon: Cpu,
    minRole: 'OPERATOR',
    children: [
      { title: 'Worker 列表', path: '/workers/list', minRole: 'OPERATOR' },
      { title: '文件渠道', path: '/workers/channels', minRole: 'OPERATOR' },
    ],
  },
  {
    key: 'scheduler',
    title: '调度',
    icon: DataAnalysis,
    minRole: 'VIEWER',
    children: [
      { title: '调度快照', path: '/scheduler/snapshot', minRole: 'VIEWER' },
      { title: '租户配额', path: '/governance/quota', minRole: 'OPERATOR' },
      { title: '队列 & 窗口', path: '/governance/queues', minRole: 'ADMIN' },
    ],
  },
  {
    key: 'system',
    title: '系统',
    icon: Tools,
    minRole: 'ADMIN',
    children: [
      { title: '租户管理', path: '/system/tenants', minRole: 'ADMIN' },
      { title: '用户 & 角色', path: '/system/users', minRole: 'ADMIN' },
      { title: 'AI 助手', path: '/system/ai-chat', minRole: 'ADMIN' },
    ],
  },
]
