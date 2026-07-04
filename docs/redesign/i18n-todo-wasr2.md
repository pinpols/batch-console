> ✅ 已全部落库(2026-07-04):本清单键值已补进 src/locales zh/en,check:i18n 绿。留档仅作追溯。
# i18n TODO — Workers / Approvals / Reports / SelfService redesign 第二轮(wasr2)

> 本轮 redesign 禁改 `src/locales/`,以下新 key 已在模板中以 `t()` 正常引用,
> 待统一补进 `src/locales/zh-CN.ts` / `src/locales/en-US.ts`(1:1 对齐,`npm run check:i18n` 验证)。

## 新增 key

| Key | zh-CN 建议 | en-US 建议 | 用在哪 |
|---|---|---|---|
| `workerManagement.loadBarTitle` | `负载为当前执行中任务数;条形长度为相对本页 Worker 峰值的比例(后端未提供容量上限)` | `Load is the current in-flight task count; bar length is relative to the peak among listed workers (backend provides no capacity denominator)` | `src/views/worker/WorkerManagement.vue` 负载 mini bar 的 title(口径说明,替代 dump 的假 `6/16` 分母) |
| `reportExportHub.tabTrend` | `趋势分析` | `Trends` | `src/views/reports/ReportExportHub.vue` pill tab |
| `reportExportHub.tabExports` | `导出中心` | `Export Center` | 同上 pill tab |
| `reportExportHub.kpiTotalRuns` | `总执行次数` | `Total Runs` | 趋势 tab KPI 卡(近 7 日 job dailyTrend 全状态求和) |
| `reportExportHub.kpiSuccessRate` | `成功率` | `Success Rate` | 趋势 tab KPI 卡 |
| `reportExportHub.kpiAvgDuration` | `平均耗时` | `Avg Duration` | 趋势 tab KPI 卡(sla-compliance.avgDurationSeconds) |
| `reportExportHub.kpiSlaRate` | `SLA 达标率` | `SLA Compliance` | 趋势 tab KPI 卡(onTime/totalWithSla) |
| `reportExportHub.trendTitle` | `近 7 日执行量` | `Runs (last 7 days)` | 趋势 tab 图表标题 |
| `reportExportHub.legendSuccess` | `成功` | `Success` | 图表图例 + 柱 hover title |
| `reportExportHub.legendFailed` | `失败` | `Failed` | 图表图例 + 柱 hover title |
| `reportExportHub.trendEmpty` | `暂无近 7 日执行数据` | `No run data in the last 7 days` | 趋势 tab 空态 |

注意:`opsSummary.tabTrend` / `opsSummary.legendFailed` 已存在但属于 opsSummary 命名空间,本页按「页面级 namespace」规范新增 `reportExportHub.*`,勿混用。

## 复用的既有 key(无需新增)

- `approvals.tabGeneral` / `approvals.tabCatchUp` — ApprovalList pill tab(替代 el-tabs,文案不变)。
- `workerManagement.statOnline` / `statOffline` / `hbSecondsAgo` / `hbMinutesAgo` / `hbHoursAgo` — 统计卡与心跳相对时间沿用。`Draining` 为状态英文原词(dump 同款),不进 i18n。
- `selfServicePanel.cardCta*`(`cardCtaView` / `cardCtaRequest` / `cardCtaApiKey` / `cardCtaFailedJobs` / `cardCtaNotifSubs` / `cardCtaMyAudits` / `cardCtaTriggerPause` / `cardCtaCollapse`)— dump 的「发起 →」语言落地为 `{{ ctaLabel(card) }} →` accent 文本链接,动词沿用既有更精确的 CTA 词条,不新增。
- `reportExportHub.*` 导出中心原有全部 key 原样保留。
