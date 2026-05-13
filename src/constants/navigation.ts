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
  Monitor,
  Notebook,
  OfficeBuilding,
  Operation,
  PieChart,
  PriceTag,
  Promotion,
  Reading,
  Search,
  Service,
  SetUp,
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
        // 自助服务 → Service(客服/受理),比 Tickets(票据)更贴"自助办理"
        title: pageTitle('/self-service'),
        path: '/self-service',
        minRole: 'OPERATOR',
        icon: Service,
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
        // 流水线 → Connection(管道/连接),比 Share(分享分叉)更贴"链式步骤"
        title: pageTitle('/jobs/pipelines'),
        path: '/jobs/pipelines',
        minRole: 'VIEWER',
        icon: Connection,
      },
      {
        // 工作流编辑器 → EditPen(画图编辑),比 Guide(指南)更贴"DAG 编辑"
        title: pageTitle('/workflow/designer'),
        path: '/workflow/designer',
        minRole: 'OPERATOR',
        icon: EditPen,
      },
    ],
  },
  {
    key: 'monitor',
    title: '执行与监控',
    icon: Monitor,
    children: [
      {
        // Job 实例 → VideoPlay(运行中),避开跟父分组 Monitor 同 icon
        title: pageTitle('/monitor/job-instances'),
        path: '/monitor/job-instances',
        minRole: 'VIEWER',
        icon: VideoPlay,
      },
      {
        // 步骤实例 → Operation(操作步骤),Timer 留给真定时类(触发器)
        title: pageTitle('/monitor/job-steps'),
        path: '/monitor/job-steps',
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
        // 调度器快照 → Aim(快照/瞄准当下),避开跟控制面板 TrendCharts 同 icon
        title: pageTitle('/scheduler/snapshot'),
        path: '/scheduler/snapshot',
        minRole: 'VIEWER',
        icon: Aim,
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
      {
        title: pageTitle('/config/tenant-package'),
        path: '/config/tenant-package',
        minRole: 'OPERATOR',
        icon: Box,
      },
    ],
  },
  {
    // 观测与查询(分组)→ View(综合观测),避开跟"告警事件" WarningFilled 同 icon
    key: 'observability',
    title: '观测与查询',
    icon: View,
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
        // 操作审计 → Notebook(审计日志本),避开跟"配置管理" Memo 同 icon
        title: pageTitle('/observability/audits'),
        path: '/observability/audits',
        minRole: 'VIEWER',
        icon: Notebook,
      },
      {
        // Outbox → MessageBox(消息发件箱),避开跟"租户包" Box 同 icon
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
        // Trace 诊断:跨域聚合的"先来这里查"主入口
        title: pageTitle('/observability/trace'),
        path: '/observability/trace',
        minRole: 'VIEWER',
        icon: Aim,
      },
      {
        title: pageTitle('/observability/queries'),
        path: '/observability/queries',
        minRole: 'VIEWER',
        icon: Search,
      },
      {
        // 事件目录 → Reading(目录/手册),避开跟"工作流定义" Collection 同 icon
        title: pageTitle('/system/event-catalog'),
        path: '/system/event-catalog',
        minRole: 'VIEWER',
        icon: Reading,
      },
    ],
  },
  {
    // 运行配置(分组)→ SetUp(运行参数设定),避开跟"Worker" Cpu 同 icon
    key: 'runtime',
    title: '运行配置',
    icon: SetUp,
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
        // 队列 → Connection(链接/管道) — Connection 已被流水线用,这里换 Management 也合适
        title: pageTitle('/governance/queues'),
        path: '/governance/queues',
        minRole: 'ADMIN',
        icon: Management,
      },
      {
        // 配额 → PieChart(饼图配额),比 Briefcase(公文包)更贴"分配占比"
        title: pageTitle('/governance/quota'),
        path: '/governance/quota',
        minRole: 'OPERATOR',
        icon: PieChart,
      },
    ],
  },
  {
    // 系统管理(分组)→ Tools(管理工具集),避开跟"系统参数" Setting 同 icon
    key: 'system',
    title: '系统管理',
    icon: Tools,
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
        // 系统参数 → Setting(齿轮),group icon 已改 Tools 不冲突
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
        // AI 助手 → ChatLineRound(对话气泡),Document 是文档不是对话
        title: pageTitle('/system/ai-chat'),
        path: '/system/ai-chat',
        minRole: 'ADMIN',
        icon: ChatLineRound,
      },
      {
        // 运维诊断 → DataAnalysis(诊断分析),Tools 已被父分组占
        title: pageTitle('/ops/diagnostic'),
        path: '/ops/diagnostic',
        minRole: 'ADMIN',
        icon: DataAnalysis,
      },
    ],
  },
]
