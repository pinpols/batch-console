import { onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { CircleCloseFilled, CircleCheckFilled } from '@element-plus/icons-vue'
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
      message: '网络已断开,请检查连接',
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
      message: '网络已恢复',
      type: 'success',
      duration: 2000,
      icon: CircleCheckFilled,
      grouping: true,
    })
  }

  onMounted(() => {
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    if (!online.value) onOffline()
  })

  onUnmounted(() => {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
    if (offlineToast) offlineToast.close()
  })

  return { online }
}
