import { computed, ref, onScopeDispose, getCurrentScope } from 'vue'
import type { ComputedRef, Ref } from 'vue'

/**
 * 异步动作防抖 — 把"保存 / 提交 / 创建 / 触发"类按钮收敛成统一模式。
 *
 * 解决两类常见 UX bug:
 *  1. 用户连点 N 次提交 → N 个请求出门(BE 幂等拦截器虽能去重,但会回 N-1 个 409
 *     错误 toast,看上去像系统出错)。
 *  2. 每个页面手写 `const saving = ref(false); try { ... } finally { saving = false }`
 *     的样板,极易漏掉一处导致按钮在请求中仍可重复点。
 *
 * 用法:
 *
 *   const save = useAsyncAction(async (row: Row) => {
 *     await api.upsertResource(row)
 *     await refresh()
 *   })
 *
 *   <el-button :loading="save.loading.value" @click="save.run(row)">保存</el-button>
 *
 * EP el-button 收到 :loading=true 会自动 disabled + 显 spinner,
 * 用户根本点不到第二次,L2 拦截器和 L3 BE 幂等拦截器都成了纯兜底。
 *
 * 行为约定:
 *  - 调用 run() 时若已 busy 或冷却中,直接 resolve undefined(不重复执行,不抛错);
 *  - fn 抛错 → 重抛给调用方(走原有的 toast / 业务错误处理),onError 钩子可选;
 *  - cooldownMs > 0 时,完成后这段时间内 loading 仍为 true,防误触/手抖(双击);
 *  - 组件 unmount 时自动清掉残留 cooldown timer,避免内存悬挂。
 */

export interface AsyncActionOptions {
  /**
   * 完成后多少毫秒内 loading 仍维持为 true,防止用户在 200ms 内的双击抖动。
   * 默认 0(完成即解锁);典型业务按钮建议 300~500ms。
   */
  cooldownMs?: number
  /** 失败回调(不影响错误重抛) */
  onError?: (error: unknown) => void
  /** 成功回调,拿到 result 后立即触发(在 loading 解锁前) */
  onSuccess?: (result: unknown) => void
}

export interface AsyncAction<TArgs extends readonly unknown[], TResult> {
  /** 正在执行中(不含 cooldown) */
  busy: Readonly<Ref<boolean>>
  /** busy 或处于 cooldown 窗口 — 这是绑到 el-button :loading 的标准 prop */
  loading: ComputedRef<boolean>
  /**
   * 触发动作;若 loading 为 true,直接返回 undefined 不重复执行也不抛错。
   * 业务抛错时,本函数仍会把错误重抛出去,调用方可正常 try/catch 或链式 catch。
   */
  run: (...args: TArgs) => Promise<TResult | undefined>
}

export function useAsyncAction<TArgs extends readonly unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult> | TResult,
  options: AsyncActionOptions = {},
): AsyncAction<TArgs, TResult> {
  const busy = ref(false)
  const cooling = ref(false)
  let cooldownTimer: ReturnType<typeof setTimeout> | null = null

  const loading = computed(() => busy.value || cooling.value)

  function clearCooldownTimer() {
    if (cooldownTimer != null) {
      clearTimeout(cooldownTimer)
      cooldownTimer = null
    }
  }

  // setup() 上下文里挂自动清理,非 setup() 调用时 getCurrentScope 为 undefined,
  // 此时不挂(测试 / 模块顶层 / nonReactive util 场景),由 GC 清理。
  if (getCurrentScope()) {
    onScopeDispose(() => {
      clearCooldownTimer()
    })
  }

  async function run(...args: TArgs): Promise<TResult | undefined> {
    if (busy.value || cooling.value) return undefined
    busy.value = true
    try {
      const result = await Promise.resolve(fn(...args))
      options.onSuccess?.(result)
      return result
    } catch (error) {
      options.onError?.(error)
      throw error
    } finally {
      busy.value = false
      const cd = options.cooldownMs
      if (cd && cd > 0) {
        clearCooldownTimer()
        cooling.value = true
        cooldownTimer = setTimeout(() => {
          cooling.value = false
          cooldownTimer = null
        }, cd)
      }
    }
  }

  return { busy, loading, run }
}
