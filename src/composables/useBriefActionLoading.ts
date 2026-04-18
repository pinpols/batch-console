import { ref } from 'vue'

/** 纯前端筛选等瞬时操作：保证按钮 / 表格 loading 至少展示一小段时间，避免“毫无反馈” */
export function useBriefActionLoading(minMs = 280) {
  const busy = ref(false)

  async function run<T>(fn: () => T | Promise<T>): Promise<T> {
    busy.value = true
    const started = Date.now()
    try {
      return await Promise.resolve(fn())
    } finally {
      const wait = minMs - (Date.now() - started)
      if (wait > 0) await new Promise((r) => setTimeout(r, wait))
      busy.value = false
    }
  }

  return { busy, run }
}
