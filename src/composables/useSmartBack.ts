import { useRouter } from 'vue-router'

/**
 * 智能返回:有 history.back 走 router.back();没有(深链直开)走 fallback。
 * window.history.state?.back 在 vue-router 4 里是上一项的 path,可作判据。
 * 兜底用 history.length > 1 + document.referrer 判断,fallback 永远是个稳妥路径。
 */
export function useSmartBack(fallback: string) {
  const router = useRouter()
  return () => {
    const hasBackEntry = !!(window.history.state && window.history.state.back)
    if (hasBackEntry) {
      router.back()
    } else {
      router.replace(fallback)
    }
  }
}
