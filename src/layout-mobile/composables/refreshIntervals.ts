/**
 * 移动端各页轮询间隔统一定义,避免各页随意填写造成"告警 20s、Outbox 30s、概览 30s"的不齐心智。
 *
 * 三档:
 *   - **HOT**(10s):oncall 必须实时盯的页 — 详情运行中、workflow run overlay
 *   - **WARM**(20s):次实时 — 告警列表、待审批列表
 *   - **COLD**(30s):一般概览 — 概览、worker、文件列表、outbox、历史日志
 *
 * 改这里 = 全站统一改;按"哪些 oncall 必须实时"的产品判断而非随机时长。
 */
export const REFRESH_INTERVAL_HOT_MS = 10_000
export const REFRESH_INTERVAL_WARM_MS = 20_000
export const REFRESH_INTERVAL_COLD_MS = 30_000
