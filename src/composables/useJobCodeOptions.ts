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

  async function load(tenantId: string): Promise<string[]> {
    if (cache && cache.tenantId === tenantId && Date.now() - cache.ts < STALE_MS) {
      options.value = cache.codes
      return cache.codes
    }
    const pending = inflight.get(tenantId)
    if (pending) {
      loading.value = true
      try {
        options.value = await pending
        return options.value
      } finally {
        loading.value = false
      }
    }
    loading.value = true
    const request = (async () => {
      try {
        const res = await jobApi.listCodes(tenantId)
        const codes = Array.isArray(res)
          ? Array.from(
              new Set(
                res
                  .map((item) => item?.code)
                  .filter((code): code is string => typeof code === 'string' && code.length > 0),
              ),
            )
          : []
        cache = { tenantId, ts: Date.now(), codes }
        options.value = codes
        return codes
      } catch {
        options.value = []
        return []
      } finally {
        loading.value = false
        inflight.delete(tenantId)
      }
    })()
    inflight.set(tenantId, request)
    return request
  }

  function clear() {
    cache = null
    options.value = []
  }

  return { loading, options, load, clear }
}

/** 仅供单测重置模块级缓存 */
export function __resetJobCodeCacheForTest() {
  cache = null
  inflight.clear()
}
