import type { DeepReadonly } from 'vue'
import type { JobExecutionProgress } from '@/api/jobProgress'
const ended = new Set(['SUCCESS', 'FAILED', 'CANCELLED', 'TERMINATED'])
/** 分母取完整服务端聚合；已创建任务不能冒充未来全部技术任务。 */
export function jobExecutionCounts(snapshot: DeepReadonly<JobExecutionProgress>) {
  return (['PARTITION', 'TASK'] as const).map((scope) => {
    const rows = snapshot.counts.filter((row) => row.scope === scope)
    const created = rows.reduce((total, row) => total + row.count, 0)
    const closed = rows
      .filter((row) => ended.has(row.status))
      .reduce((total, row) => total + row.count, 0)
    const succeeded = rows
      .filter((row) => row.status === 'SUCCESS')
      .reduce((total, row) => total + row.count, 0)
    const total = scope === 'PARTITION' ? snapshot.expectedPartitions || null : created || null
    return {
      scope,
      created,
      closed,
      succeeded,
      total,
      percentage: total && closed <= total ? Math.round((closed / total) * 100) : null,
      states: rows,
    }
  })
}
