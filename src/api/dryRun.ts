/**
 * ADR-026 演练(dry-run)API。3 档:L1 CONFIG_VALIDATE / L2 SCHEDULE_PLAN / L3 EXECUTION_PLAN。
 * BE 端点 `POST /api/console/ops/dry-run/plan` 转发到 orchestrator,**不写 instance、不调外部投递**。
 *
 * 2026-05-21 联调发现:console-api 透传 orchestrator 响应时是「双层 CommonResponse 嵌套」。
 * client.ts 的 axios 拦截器只解一层外壳;内层仍是 `{code, message, data, meta}`。
 * 本 API 显式再解一层,FE 拿到 BE 真正的 `DryRunPlanResult`。
 */
import { post } from './client'
import type { components } from '@/types/api.generated'

export type DryRunPlanRequest = components['schemas']['DryRunPlanRequest']
export type DryRunLevel = NonNullable<DryRunPlanRequest['level']>

// #801-804 Map 收敛后 BE 暴露真 schema(对照 orchestrator DryRunPlanResult / DefaultDryRunPlanService):
// wire 就是 {level, success, findings, summary} 四字段。L3 探测结果(EXPLAIN / headBucket /
// HTTP HEAD)以 EXEC_* code 并入 findings;分区计划细节(queueCode/workerGroup/partitionCount 等)
// 与探测计数(l3SqlProbed/l3S3Probed/l3EndpointProbed)在 summary(动态 Map)里。
// 此前手写 shape 猜的顶层 probes / schedulePlan 在 wire 上从不存在,统一切生成类型。
export type DryRunFinding = components['schemas']['DryRunFinding']

/** dry-run 计划响应。 */
export type DryRunPlanResult = components['schemas']['DryRunPlan']

export const dryRunApi = {
  async plan(req: DryRunPlanRequest): Promise<DryRunPlanResult> {
    // console-api 已修正为单层 envelope:axios 拦截器解外层后,直接得到 DryRunPlanResult。
    // (此前 BE 双层嵌套是 bug,FE 这里多解一层;BE 修复后改回单层,否则 inner.code=undefined 必抛错。)
    const result = await post<DryRunPlanResult>('/api/console/ops/dry-run/plan', req)
    if (!result) {
      throw new Error('empty dry-run response')
    }
    return result
  },
}
