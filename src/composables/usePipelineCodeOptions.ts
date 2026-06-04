/**
 * Workflow 设计器 inspector — FILE_STEP 节点 pipelineCode 下拉选项。
 *
 * 调 BE PR #366 真路径 `GET /api/console/queries/pipeline-definitions/codes?tenantId=`,
 * 仅返回 code 列表,模块级 ref 缓存 5min staleTime(同一 tenant 多个表单复用)。
 *
 * 失败降级:返回空 list,allow inspector 继续渲染(用户可手动输 code)。
 */

import { ref } from 'vue'
import { get } from '@/api/client'

const STALE_MS = 5 * 60 * 1000

interface CacheEntry {
  tenantId: string
  ts: number
  codes: string[]
}

let cache: CacheEntry | null = null
let inflight: Promise<string[]> | null = null

export function usePipelineCodeOptions() {
  const loading = ref(false)
  const options = ref<string[]>([])

  async function load(tenantId: string): Promise<string[]> {
    if (cache && cache.tenantId === tenantId && Date.now() - cache.ts < STALE_MS) {
      options.value = cache.codes
      return cache.codes
    }
    if (inflight) return inflight
    loading.value = true
    inflight = (async () => {
      try {
        const res = await get<string[]>('/api/console/queries/pipeline-definitions/codes', {
          tenantId,
        })
        const codes = Array.isArray(res) ? res.filter((s): s is string => typeof s === 'string') : []
        cache = { tenantId, ts: Date.now(), codes }
        options.value = codes
        return codes
      } catch {
        options.value = []
        return []
      } finally {
        loading.value = false
        inflight = null
      }
    })()
    return inflight
  }

  function clear() {
    cache = null
    options.value = []
  }

  return { loading, options, load, clear }
}

/** 仅供单测重置模块级缓存 */
export function __resetPipelineCodeCacheForTest() {
  cache = null
  inflight = null
}
