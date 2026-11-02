import type { Router } from 'vue-router'
import { useRouteProgressStore } from '@/stores/routeProgress'
import { logError } from '@/utils/logger'

export function installRouterErrorHandler(router: Router) {
  router.onError((err, to) => {
    useRouteProgressStore().finish()

    const message = err instanceof Error ? err.message : String(err)
    logError(`路由错误:${message}`, {
      kind: 'router',
      message,
      path: to?.fullPath,
    })

    // 典型线上场景：发布后用户缓存了旧 chunk，点击菜单会报 “Loading chunk failed”
    // 这里做一次性自动恢复（避免卡在空白页/进度条不消失）。
    const isChunkLoadError =
      /Loading chunk \d+ failed/i.test(message) ||
      /Loading CSS chunk \d+ failed/i.test(message) ||
      /Failed to fetch dynamically imported module/i.test(message) ||
      /Importing a module script failed/i.test(message)

    if (isChunkLoadError) {
      const key = '__router_chunk_reload_once__'
      const alreadyReloaded = sessionStorage.getItem(key) === '1'
      if (!alreadyReloaded) {
        sessionStorage.setItem(key, '1')
        // 保留当前路径（含 query/hash），避免刷新后回到首页。
        window.location.replace(to?.fullPath || window.location.href)
      }
    }
  })
}
