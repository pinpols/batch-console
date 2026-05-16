# 页面命名约定:URL / 代码目录 / 侧边栏分组三者一致

**状态**:Accepted
**日期**:2026-05-14
**适用范围**:**新页面**(本约定不强制重构存量旧页;旧页通过路由 alias 维持兼容)

---

## 1. 问题背景

现状(2026-05-14 全量审计发现)的不一致样本:

| URL                     | 代码目录               | 侧边栏分组 |
| ----------------------- | ---------------------- | ---------- |
| `/system/triggers`      | `views/system/`        | **调度**   |
| `/system/event-catalog` | `views/observability/` | **配置**   |
| `/config/management`    | `views/system/`        | **配置**   |
| `/observability/audits` | `views/observability/` | **系统**   |
| `/self-service`         | `views/system/`        | **工作台** |

**症状**:加新页面时,开发者不知该跟"URL 路径"、"代码目录"、还是"产品分组"。每选一种都对其它两种破坏,造成维护熵增。

**对用户:无感**(URL 是后台导航跳转目标,用户不背它)。
**对开发:每次开新页要决策一次"放哪",且容易和现有页相左。**

---

## 2. 决策

**新页面**必须满足:**`URL 路径`、`代码目录`、`侧边栏分组` 三者用同一个一级域(domain)前缀**。

### 一级域(canonical)

按产品心智收敛到 7 个一级域。现有代码中仍有 `ops`、`job`、`workflow`、`system`
等历史目录或路由前缀;本节只约束新页面,不要求回溯迁移存量页面。

| 一级域 (slug) | 中文名       | 心智                                                     | 例子页面                                               |
| ------------- | ------------ | -------------------------------------------------------- | ------------------------------------------------------ |
| `workspace`   | 工作台       | dashboard / 概览 / 审批 / 报表 / 自助服务                | OpsSummary, Approvals, Reports                         |
| `runs`        | 运行         | 实时运行态 / 排障 / Trace / 运维诊断                     | RunsOverview, JobInstance, WorkflowRun, Trace          |
| `jobs`        | 作业与工作流 | 定义层 / 编辑器                                          | JobDefinition, Pipeline, WorkflowDef, WorkflowDesigner |
| `files`       | 文件         | 模板 / 渠道 / 实时文件 / 到达组 / 管道观测               | FileList, FileTemplate, FileChannel, ArrivalGroup      |
| `scheduling`  | 调度         | Worker / 触发器 / 调度快照 / 批次日 / 配额               | WorkerManagement, TriggerList, SchedulerSnapshot       |
| `admin`       | 配置与系统   | 租户 / 账户 / API Key / 参数 / 发布 / 变更 / 标签 / 审计 | TenantList, UserAccountList, ConfigReleaseList         |
| `alerting`    | 告警与投递   | 告警 / 告警路由 / 通知 / Outbox                          | AlertList, AlertRouting, NotificationManagement        |

### 命名规则

| 维度       | 规则                                   | 例子                               |
| ---------- | -------------------------------------- | ---------------------------------- |
| URL        | `/{一级域}/{二级 slug}` 或 `/{一级域}` | `/alerting/alerts`、`/runs`        |
| 代码目录   | `src/views/{一级域}/`                  | `src/views/alerting/AlertList.vue` |
| 侧边栏分组 | `nav.group.{一级域}` 的 i18n key       | `nav.group.alerting: '告警与投递'` |

**三者用同一个 slug,不要在 URL 用 `alerting` 但代码放 `system/` 又把入口放"配置与系统"组。**

---

## 3. 存量(旧页)处理

**不重构**。维护成本 > 改动收益。

如果要把某个存量页"修正"到新约定:**只用路由 alias**,不改代码目录,不改组件名,**只新增一个 i18n 用的导航分组归属**。

```ts
// router/index.ts —— 例子:把 /self-service 从 system/ 视觉上挪到 self-service 域
{
  path: 'self-service',
  alias: ['/self-service-panel'],  // 老 URL 保留
  component: () => import('@/views/system/SelfServicePanel.vue'),  // 文件不动
  meta: {
    activeMenu: '/self-service',
    pathKey: 'selfService',  // i18n key 跟新分组走
  },
}
```

---

## 4. PR 自检 Checklist

新建页面前,作者在 PR 描述里勾:

- [ ] 选择了 7 个一级域之一,理由是 **\_**
- [ ] URL `/<一级域>/<...>` 与 `src/views/<一级域>/` 目录一致
- [ ] `navigation.ts` 把入口挂在同名分组下
- [ ] `pageMeta.ts` 加了 title/description 中文兜底
- [ ] `locales/zh-CN.ts` + `en-US.ts` 加了双语 `page.<pathKey>.title/description`
- [ ] 路由 `meta.pathKey` 由 `applyPageMetaToRoutes` 自动派生(无需手填)

---

## 5. 一级域分配争议处理

新页面如果"不知道挂哪一域",**默认按这棵决策树**:

```
新页面在做什么?
├─ 用户实时看的运行态、排障、Trace          → runs
├─ 用户编辑定义、流程、模板                  → jobs
├─ 用户处理文件流(模板、到达、追踪)         → files
├─ 用户调度资源(Worker/触发器/批次/配额)     → scheduling
├─ 用户管理账号、租户、Key、系统参数、发布    → admin
├─ 用户响应告警、通知、Outbox                → alerting
└─ 上面都不像、是大盘 / 审批 / 报表           → workspace
```

实在还判不出来:**提到产品评审、不要自己开新一级域**。一级域必须保持 ≤7。

---

## 6. 不约定的事

- **是否需要中间页**(group landing) — 由产品决定
- **图标 / 排序** — `navigation.ts` 内部决定,不影响本约定
- **mobile /m/ 路由** — 移动端独立做,参考 `src/layout-mobile/MobileTabBar.vue` 顶部注释(5 主 Tab + 5 应急深链)

---

## 7. 实施时点

**自本 ADR 落库之日起**(2026-05-14)新建的页面强制约束。Code review 时按 §4 checklist 逐项核对。

存量旧页不回溯重构,但欢迎在做"领域级重构"(例如把整个 `views/system/` 拆分)时整理一波。
