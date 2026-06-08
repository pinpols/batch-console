import { ref } from 'vue'
import { defineStore } from 'pinia'

/** 路由切换（菜单、标签等）时的顶部过渡条 */
export const useRouteProgressStore = defineStore('routeProgress', () => {
  const loading = ref(false)
  const showSkeleton = ref(false)
  let hideTimer: ReturnType<typeof setTimeout> | null = null
  let skeletonTimer: ReturnType<typeof setTimeout> | null = null
  let safetyTimer: ReturnType<typeof setTimeout> | null = null

  function start() {
    if (hideTimer !== null) {
      clearTimeout(hideTimer)
      hideTimer = null
    }
    if (skeletonTimer !== null) {
      clearTimeout(skeletonTimer)
      skeletonTimer = null
    }
    if (safetyTimer !== null) {
      clearTimeout(safetyTimer)
      safetyTimer = null
    }
    loading.value = true
    showSkeleton.value = false
    skeletonTimer = setTimeout(() => {
      skeletonTimer = null
      if (loading.value) showSkeleton.value = true
    }, 280)
    safetyTimer = setTimeout(() => {
      finish()
    }, 12000)
  }

  /** 略延迟再收起，避免闪一下或异步 chunk 尚未渲染完 */
  function finish() {
    if (safetyTimer !== null) {
      clearTimeout(safetyTimer)
      safetyTimer = null
    }
    if (skeletonTimer !== null) {
      clearTimeout(skeletonTimer)
      skeletonTimer = null
    }
    showSkeleton.value = false
    if (hideTimer !== null) clearTimeout(hideTimer)
    hideTimer = setTimeout(() => {
      loading.value = false
      hideTimer = null
    }, 220)
  }

  return { loading, showSkeleton, start, finish }
})
