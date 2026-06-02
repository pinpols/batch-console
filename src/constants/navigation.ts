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
 * 侧边栏分组(2026-05-14 IA v3:8 组 → 7 组,38 visible → 35 visible)。
 *
 * 关键变化(对比 v2):
 * - **#3 运行链路收敛**:`ops/diagnostic` 从"系统"挪到"运行"(看运行健康同心智),
 *   `monitor/job-steps` 隐藏(从 job 实例 drill,不占主导航位)
 * - **#1 侧边栏 8→7**:`配置 + 系统` 合并为 `配置与系统`(都是 admin 维护类心智),
 *   `event-catalog` / `tenant-package` 折进 Command Palette
 *
 * 设计原则:
 * - 每组单一心智、组项数 ≤8(运行组现 5、配置与系统 8)
 * - 高频在侧栏可见,低频走 Command Palette(hidden 项 ⌘K 仍可达)
 * - 旧 group key 在 i18n 留兜底,用户停留在旧 URL 不会出现 raw key
 *
 * 参考 ADR docs/design/page-naming-convention.md(新页面三同命名约定)
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
      // 概览 — 唯一主入口
      {
        title: pageTitle('/runs'),
        path: '/runs',
        minRole: 'VIEWER',
        icon: View,
      },
      // Drill-down 明细(job-steps 已从主导航撤,从 job 实例详情进入,见下)
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
      // 统一排障入口:Trace 主入口
      {
        title: pageTitle('/observability/trace'),
        path: '/observability/trace',
        minRole: 'VIEWER',
        icon: Search,
      },
      // 运维诊断:看运行健康(原系统组,2026-05-14 挪到运行组,同心智更顺)
      {
        title: pageTitle('/ops/diagnostic'),
        path: '/ops/diagnostic',
        minRole: 'ADMIN',
        icon: DataAnalysis,
      },
      // ─── 以下 hidden,⌘K / 内嵌跳转 仍可达 ───
      {
        // job-steps 是 job 实例的 drill-down,从实例详情进,不占主导航
        title: pageTitle('/monitor/job-steps'),
        path: '/monitor/job-steps',
        minRole: 'VIEWER',
        icon: Memo,
        hidden: true,
      },
      {
        // queries 与 Trace 心智重叠,Trace 作主入口
        title: pageTitle('/observability/queries'),
        path: '/observability/queries',
        minRole: 'VIEWER',
        icon: Search,
        hidden: true,
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
    // 图标分工:组=广播(Promotion)/ 告警=警告(WarningFilled)/ 路由=连接拓扑(Connection)/
    //          Outbox=收件箱(MessageBox)/ 通知订阅=铃铛(Bell),互不重复
    key: 'alerting',
    title: '告警与投递',
    icon: BellFilled,
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
        icon: Connection,
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
    /**
     * 调度:operator 日常调参的运行时资源 + 治理配置。
     * 2026-05-14 IA 调整:8 项 → 5 项侧栏可见。
     * 治理类 (queues/windows/calendars) 是 admin 低频配置,藏到 Command Palette,
     * 避免和高频运行时(workers/triggers/snapshot)混在同一扫描视窗里增加心智负担。
     */
    key: 'scheduling',
    title: '调度',
    icon: Timer,
    minRole: 'VIEWER',
    children: [
      // 高频运行时(operator 日常)
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
      // 治理 — operator 偶发,但仍是日常配额相关
      {
        title: pageTitle('/governance/quota'),
        path: '/governance/quota',
        minRole: 'OPERATOR',
        icon: PieChart,
      },
      // SDK 自定义 taskType(只读,operator 排查租户 worker 注册情况)
      {
        title: pageTitle('/ops/custom-task-types'),
        path: '/ops/custom-task-types',
        minRole: 'OPERATOR',
        icon: Cpu,
      },
      // Worker fingerprint 看板(SDK Phase 5,灰度切流可视化)
      {
        title: pageTitle('/ops/worker-fingerprints'),
        path: '/ops/worker-fingerprints',
        minRole: 'OPERATOR',
        icon: Cpu,
      },
      // ↓ 以下 admin 治理低频项隐藏到 Command Palette
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
    ],
  },
  {
    /**
     * 配置与系统(2026-05-14 IA v3:合并原 config + system 两组)。
     *
     * 高频 8 项侧栏可见:租户/账户/Key/参数/审计 + 发布单/变更同步/标签。
     * 低频 3 项 hidden,⌘K / 内嵌跳转可达:
     *   - tenant-package(批量导入,半年用一次)
     *   - event-catalog(查阅类只读字典)
     *   - ai-chat(实验入口)
     *
     * ops/diagnostic 已挪到"运行"组(看运行健康同心智)。
     */
    key: 'configSystem',
    title: '配置与系统',
    icon: Tools,
    minRole: 'VIEWER',
    children: [
      // 租户与账号(高频)
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
      // Atomic 节点配置中心(平台四类原子节点 schema + 安全闸只读)
      {
        title: pageTitle('/system/atomic-task-types'),
        path: '/system/atomic-task-types',
        minRole: 'OPERATOR',
        icon: Box,
      },
      // 审计(原"告警与投递"挪入)
      {
        title: pageTitle('/observability/audits'),
        path: '/observability/audits',
        minRole: 'VIEWER',
        icon: Notebook,
      },
      // 通用操作审计 — @AuditAction 切面落库,覆盖 console 写操作
      {
        title: pageTitle('/observability/operation-audits'),
        path: '/observability/operation-audits',
        minRole: 'VIEWER',
        icon: Notebook,
      },
      // 配置(发布单 / 变更同步 / 标签 — 原 config 组保留高频 3 项)
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
      // ─── hidden,⌘K 可达 ───
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
