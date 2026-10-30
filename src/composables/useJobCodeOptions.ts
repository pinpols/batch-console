/**
 * Workflow 设计器 inspector — JOB 节点 jobCode 下拉选项。
 *
 * 调 `GET /api/console/queries/job-definitions/codes?tenantId=`,返回 code/name 选项，
 * 本 composable 对现有调用方仍暴露 code 列表；模块级 ref 缓存 5min staleTime。
 *
 * 失败降级:返回空 list,allow inspector 继续渲染(用户可手动输 code)。
 */

import { ref } from 'vue'
import { jobApi } from '@/api/job'

const STALE_MS = 5 * 60 * 1000

interface CacheEntry {
  tenantId: string
  ts: number
  codes: string[]
}

let cache: CacheEntry | null = null
const inflight = new Map<string, Promise<string[]>>()

export function useJobCodeOptions() {
  const loading = ref(false)
  const options = ref<string[]>([])

  let generation = 0

  async function load(tenantId: string): Promise<string[]> {
    const requestGeneration = ++generation
    const cached = cache
    const cachedCodesAreFreshForTenant =
      cached && cached.tenantId === tenantId && Date.now() - cached.ts < STALE_MS
    if (cachedCodesAreFreshForTenant) {
      options.value = cached.codes
      loading.value = false
      return cached.codes
    }
    loading.value = true
    let pending = inflight.get(tenantId)
    if (!pending) {
      const request = (async () => {
        try {
          const res = await jobApi.listCodes(tenantId)
          const listedCodes = Array.isArray(res) ? res.map((item) => item?.code) : []
          const nonEmptyCodes = listedCodes.filter(
            (code): code is string => typeof code === 'string' && code.length > 0,
          )
          const codes = Array.from(new Set(nonEmptyCodes))
          cache = { tenantId, ts: Date.now(), codes }
          return codes
        } catch {
          return []
        } finally {
          inflight.delete(tenantId)
        }
      })()
      inflight.set(tenantId, request)
      pending = request
    }
    try {
      const codes = await pending
      // 网络请求可被同租户组件共享，每个消费者仍独立核对当前展示目标。
      if (requestGeneration === generation) options.value = codes
      return codes
    } finally {
      if (requestGeneration === generation) loading.value = false
    }
  }

  function clear() {
    generation += 1
    cache = null
    options.value = []
    loading.value = false
  }

  return { loading, options, load, clear }
}

/** 仅供单测重置模块级缓存 */
export function __resetJobCodeCacheForTest() {
  cache = null
  inflight.clear()
}
