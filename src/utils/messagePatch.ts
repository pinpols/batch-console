/**
 * 给 ElMessage 全局打补丁:默认开启 grouping,避免相同内容连续触发时出现两个堆叠 toast。
 *
 * 触发场景:
 *  - 同一个 watcher / 双 click handler 误触 ElMessage.warning(同一文案)
 *  - 表单校验失败,字段 1 + 字段 2 共享同一 message
 *
 * grouping=true 时,EP 会把相同 message+type 的 toast 合并并显示 ×N 计数,而不是新增。
 */
import { ElMessage } from 'element-plus'

type MessageType = 'success' | 'warning' | 'info' | 'error'

const types: MessageType[] = ['success', 'warning', 'info', 'error']

export function installMessagePatch() {
  for (const t of types) {
    const original = ElMessage[t].bind(ElMessage)
    ElMessage[t] = ((opts: unknown) => {
      const norm =
        typeof opts === 'string'
          ? { message: opts, grouping: true }
          : { ...(opts as object), grouping: true }
      return original(norm as never)
    }) as (typeof ElMessage)[typeof t]
  }
}
