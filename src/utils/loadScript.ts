/**
 * 动态加载外部 <script>(第三方验证码 SDK 用)。同一 src 只插入一次,
 * 并发调用共享同一个 Promise;加载成功 resolve,失败 reject(供调用方降级提示)。
 */

const loaded = new Map<string, Promise<void>>()

export interface LoadScriptOptions {
  /** 透传到 <script> 的 async 属性,默认 true。 */
  async?: boolean
  /** 透传到 <script> 的 defer 属性。 */
  defer?: boolean
  /** 可选的 data-* 属性(部分 SDK 用 data-callback 等)。 */
  attrs?: Record<string, string>
}

export function loadScript(src: string, options: LoadScriptOptions = {}): Promise<void> {
  if (typeof document === 'undefined') {
    return Promise.reject(new Error('document is not available'))
  }
  const cached = loaded.get(src)
  if (cached) return cached

  const promise = new Promise<void>((resolve, reject) => {
    const el = document.createElement('script')
    el.src = src
    el.async = options.async ?? true
    if (options.defer) el.defer = true
    if (options.attrs) {
      for (const [k, v] of Object.entries(options.attrs)) {
        el.setAttribute(k, v)
      }
    }
    el.addEventListener('load', () => resolve())
    el.addEventListener('error', () => {
      // 失败的脚本从缓存移除,允许下次重试(如重新渲染验证码时)
      loaded.delete(src)
      reject(new Error(`Failed to load script: ${src}`))
    })
    document.head.appendChild(el)
  })

  loaded.set(src, promise)
  return promise
}

/** 仅供测试使用:清空内部缓存。 */
export function __resetLoadScriptCache(): void {
  loaded.clear()
}
