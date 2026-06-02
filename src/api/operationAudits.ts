import { get } from '@/api/client'
import type { components, operations } from '@/types/api.generated'
import type { ConsoleOperationAuditResponse } from '@/types/console-api'

/**
 * 通用控制台用户操作审计 API client。
 *
 * 后端 `/api/console/queries/operation-audits` 是**服务端分页**(不像 /audits 是
 * client-side paginated all-items),所以这里**不**复用 fetchAllPageItems,直接传
 * pageNo/pageSize 给后端。
 *
 * R3-7 PoC:Response item 类型从 OpenAPI 生成 schema 派生
 * (`ConsoleOperationAuditResponse`),Query 参数从 operations 派生,
 * Page envelope 直接展开 `CommonResponseConsoleOperationAuditList.data`。
 *
 * 字段一致性差异(BE 生成 → FE 旧手写):
 *  - `operatorId / operatorRole / errorCode / errorMessage / params / traceId /
 *    requestId / ipHash / uaHash`:BE 标 `?: string | null`,旧 FE 是 `string | null`
 *    (非 optional)。语义等价,读取兼容,不再单独维护。
 *  - Page envelope 的 `total / pageNo / pageSize / items`:BE 标 optional,旧 FE
 *    required。下游 Vue 默认 `?? 0 / ?? []` 兜底,改 optional 更贴近实际响应。
 *  - Query 的 `result`:旧 FE 允许 `''` 空串(表单未选),BE generated 是
 *    `'SUCCESS' | 'FAILED'`。本地 Omit 后重定义,保留空串兼容。
 */
export type OperationAuditResponse = ConsoleOperationAuditResponse

type OperationAuditOperationQuery = NonNullable<
  operations['queryOperationAudits']['parameters']['query']
>

/**
 * Query 类型直接复用 generated operations 的 query 段。
 * 注意 generated 把 pageNo/pageSize 标为 optional,前端调用方仍传两个字段,
 * 这里保持 generated 形状(后续可以加个 Required<> wrapper)。
 *
 * `result` 字段 BE 是 `'SUCCESS' | 'FAILED'`,前端表单未选时传 `''`,
 * 因此在 Omit 基础上扩出空串字面量。
 */
export type OperationAuditQuery = Omit<OperationAuditOperationQuery, 'result'> & {
  result?: 'SUCCESS' | 'FAILED' | ''
}

type OperationAuditEnvelope = components['schemas']['CommonResponseConsoleOperationAuditList']

/**
 * Page envelope `data` 字段在 BE 生成 schema 里是 optional,
 * 这里在 client interceptor unwrap 之后,直接以 generated 的 data 形状作为返回类型。
 */
export type OperationAuditPage = NonNullable<OperationAuditEnvelope['data']>

export async function queryOperationAudits(q: OperationAuditQuery): Promise<OperationAuditPage> {
  // client.get(url, params) 第二参就是 params 本身;原来 `{ params: q }` 嵌套后会发成
  // ?params[tenantId]=... 后端 @ModelAttribute 收不到 → 过滤/分页/tenant 全失效
  return get<OperationAuditPage>('/api/console/queries/operation-audits', q)
}
