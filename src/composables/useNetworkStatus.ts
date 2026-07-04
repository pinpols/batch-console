import { onScopeDispose, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { CircleX as CircleCloseFilled, CircleCheck as CircleCheckFilled } from 'lucide-vue-next'
import { i18n } from '@/locales'
import { logRoute } from '@/utils/logger'

/**
 * 监听浏览器在线/离线状态,断网/恢复时弹消息提示。
 *
 * 使用 navigator.onLine + 'online'/'offline' 事件;
 * 接入 axios 的 retry 后,短抖时用户基本无感(自动恢复),
 * 长断网时这个提示告诉用户"网络断了,不是系统挂了"。
 *
 * 用法:在 DefaultLayout / App.vue 顶层 setup 调一次。
 */
export function useNetworkStatus() {
  const online = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)
  let offlineToast: ReturnType<typeof ElMessage> | null = null

  function onOffline() {
    online.value = false
    logRoute('network:offline', { kind: 'network' })
    // 持久化:不自动消失;恢复时手动关
    offlineToast = ElMessage({
      message: i18n.global.t('network.offline'),
      type: 'error',
      duration: 0,
      showClose: true,
      icon: CircleCloseFilled,
      grouping: true,
    })
  }

  function onOnline() {
    online.value = true
    logRoute('network:online', { kind: 'network' })
    if (offlineToast) {
      offlineToast.close()
      offlineToast = null
    }
    ElMessage({
      message: i18n.global.t('network.online'),
      type: 'success',
      duration: 2000,
      icon: CircleCheckFilled,
      grouping: true,
    })
  }

  // 立即注册 listener(不等 onMounted),配 onScopeDispose 清理。
  // 这样 setup 体内 / 单测里 effectScope 都能直接生效,跟 Vue 组件 mount 解耦。
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  if (!online.value) onOffline()

  onScopeDispose(() => {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
    if (offlineToast) offlineToast.close()
  })

  return { online }
}
