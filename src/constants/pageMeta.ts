import type { RouteRecordRaw } from 'vue-router'
import { pathToKey } from '@/constants/pathKey'

export interface PageMetaItem {
  /** 中文兜底 title(单测 / non-vue 上下文 / i18n 缺 key 时用) */
  title: string
  /** 中文兜底 description */
  description: string
}

/**
 * 中文兜底文案表(canonical zh-CN);英文 + 实际渲染走 i18n `page.<pathToKey(path)>`。
 *
 * 添加新页面时,要同时:
 * 1. 在这里加一项中文兜底
 * 2. 在 `src/locales/zh-CN.ts` 和 `en-US.ts` 的 `page.<pathToKey(path)>` 加双语
 *    (zh-CN 跟这里保持一致,en-US 必须同步)
 *
 * pathToKey 转换规则:`/ops/summary` → `opsSummary`、`/system/api-keys` → `systemApiKeys`。
 */
export const pageMetaByPath = {
  '/ops/summary': {
    title: '控制面板',
    description: '查看当前租户的运行概览、SLA 趋势和待处理事项。',
  },
  '/approvals': {
    title: '审批中心',
    description: '集中处理配置发布、重跑和 Catch-up 审批。',
  },
  '/reports': {
    title: '报表中心',
    description: '导出常用运营、调度和审计报表。',
  },
  '/self-service': {
    title: '自助服务',
    description: '查看配额与用量,提交重跑、补偿和配额申请。',
  },
  '/jobs/definitions': {
    title: '作业定义',
    description: '维护作业定义、执行模式和调度规则。',
  },
  '/workflow/definitions': {
    title: '工作流定义',
    description: '维护工作流定义、版本和启停状态。',
  },
  '/jobs/pipelines': {
    title: '流水线定义',
    description: '维护流水线定义和步骤执行顺序。',
  },
  '/workflow/designer': {
    title: '编排设计器',
    description: '选择 Workflow 后编辑节点、条件边和汇聚关系。',
  },
  '/runs': {
    title: '全部运行',
    description: '跨作业 / 工作流的最近运行聚合,oncall 排障的统一入口。',
  },
  '/monitor/job-instances': {
    title: '作业运行',
    description: '查询作业运行记录,执行重跑、取消和终止。',
  },
  '/monitor/job-steps': {
    title: '作业步骤',
    description: '按条件查询作业步骤,定位步骤级执行问题。',
  },
  '/monitor/workflow-runs': {
    title: '工作流运行',
    description: '查询工作流运行历史,并进入节点明细。',
  },
  '/scheduler/snapshot': {
    title: '调度快照',
    description: '查看调度器实时状态、队列负载和 Worker 采样。',
  },
  '/files/list': {
    title: '文件列表',
    description: '查询文件记录,按状态和业务类型筛选。',
  },
  '/files/templates': {
    title: '文件模板',
    description: '维护文件模板、格式和业务分类。',
  },
  '/files/arrival-groups': {
    title: '到达组治理',
    description: '维护文件组到达策略,处理缺失和异常到达。',
  },
  '/files/pipeline-obs': {
    title: '流水线观测',
    description: '查看文件流水线、步骤、投递和错误记录。',
  },
  '/config/releases': {
    title: '发布管理',
    description: '跟踪配置发布单状态,处理发布、审批和回滚。',
  },
  '/config/management': {
    title: '变更与同步',
    description: '查看配置变更记录,处理 Secret 与跨环境同步。',
  },
  '/system/tags': {
    title: '标签管理',
    description: '维护资源标签,并按标签检索关联对象。',
  },
  '/config/tenant-package': {
    title: '配置批量导入',
    description: '导入租户配置包,预览校验结果后一次性应用。',
  },
  '/observability/alerts': {
    title: '告警',
    description: '查看告警事件,并执行确认、静默和关闭。',
  },
  '/observability/alert-routings': {
    title: '告警路由',
    description: '维护告警路由、接收人、聚合和重复通知规则。',
  },
  '/observability/trace': {
    title: 'Trace 诊断',
    description:
      '按 traceId 跨域聚合查询(作业实例/工作流运行/文件/审计/执行日志/告警/Outbox/死信),0 命中时引导去日志/链路平台。',
  },
  '/observability/audits': {
    title: '审计日志',
    description: '查询平台关键操作,追踪用户和接口行为。',
  },
  '/observability/outbox': {
    title: 'Outbox',
    description: '查看 Outbox 投递状态和重试记录。',
  },
  '/system/notifications': {
    title: '通知与投递',
    description: '配置通知渠道和订阅规则,追踪投递结果。',
  },
  '/observability/queries': {
    title: '综合查询',
    description: '集中查询死信、重试、执行日志和渠道回执。',
  },
  '/system/event-catalog': {
    title: '事件目录',
    description: '查看系统事件类型、Topic 和投递约定。',
  },
  '/workers/management': {
    title: 'Worker',
    description: '查看 Worker 在线状态,维护文件处理渠道。',
  },
  '/system/triggers': {
    title: '触发器',
    description: '管理作业触发器的注册、暂停和恢复。',
  },
  '/scheduler/batch-days': {
    title: '批次日与窗口',
    description: '按日历和日期查看批次日运行状态。',
  },
  '/governance/queues': {
    title: '队列与窗口',
    description: '维护调度队列、批次窗口和业务日历。',
  },
  '/governance/quota': {
    title: '租户配额',
    description: '维护租户配额策略,控制并发和突发容量。',
  },
  '/system/tenants': {
    title: '租户实例',
    description: 'SaaS 维度的隔离单位:tenantId、租户名、状态、批量新建、复制配置等。',
  },
  '/system/user-accounts': {
    title: '登录账户',
    description: '控制台登录账号:username、显示名、角色、启停、密码重置等。',
  },
  '/system/parameters': {
    title: '系统参数',
    description: '维护系统级参数键值,控制平台运行开关。',
  },
  '/system/api-keys': {
    title: 'API Key',
    description: '创建、查看和吊销控制台 API Key。',
  },
  '/system/ai-chat': {
    title: 'AI 助手',
    description: '与 AI 助手对话,并追踪历史调用记录。',
  },
  '/ops/diagnostic': {
    title: '运维诊断',
    description: '排查 Kafka、Outbox 和集群健康问题。',
  },
  '/system/users': {
    title: '权限自查',
    description: '查看当前账号的角色、权限和可访问菜单。',
  },
  '/logs': {
    title: '执行日志',
    description: '查询执行操作日志,辅助审计和问题定位。',
  },
} satisfies Record<string, PageMetaItem>

export type PageMetaPath = keyof typeof pageMetaByPath

/**
 * 取页面 i18n key(只取 pathKey 部分,完整 key = `page.<pathKey>.title`)。
 */
export function pageKey(path: PageMetaPath): string {
  return pathToKey(path)
}

/**
 * 取页面标题(中文兜底)。
 *
 * 注:此函数总是返回中文,**不走 i18n**。原因是 `navigation.ts` 顶层一次性
 * 调用此函数填充 `navigationGroups[].children[].title`,模块求值时 i18n locale
 * 是冻结的,放在这里做 i18n 反而无法响应语言切换。
 *
 * 想随语言切换实时更新的 UI(Sidebar / LayoutTabs / CommandPalette / breadcrumb)
 * 在模板里直接 `t('page.' + pathToKey(path) + '.title')`,缺 key 时回退本函数。
 */
export function pageTitle(path: PageMetaPath): string {
  return pageMetaByPath[path].title
}

export function pageDescription(path: PageMetaPath): string {
  return pageMetaByPath[path].description
}

function normalizeRoutePath(path: string, parentPath = '') {
  const raw = path.startsWith('/') ? path : `${parentPath}/${path}`
  return (
    raw
      .replace(/\/+/g, '/')
      .replace(/\/:\w+\?/g, '')
      .replace(/\/:\w+/g, '')
      .replace(/\/$/, '') || '/'
  )
}

export function applyPageMetaToRoutes(routes: RouteRecordRaw[], parentPath = '') {
  for (const route of routes) {
    const fullPath = normalizeRoutePath(String(route.path), parentPath)
    const meta = pageMetaByPath[fullPath as PageMetaPath]
    if (meta) {
      route.meta = {
        ...route.meta,
        title: meta.title,
        description: meta.description,
        // 存路径键供面板/标签栏在切语言时实时解析(meta.title 是冻结的中文兜底)
        pathKey: pathToKey(fullPath),
      }
    }
    if (route.children) {
      applyPageMetaToRoutes(route.children, fullPath)
    }
  }
}
