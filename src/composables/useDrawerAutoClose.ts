import { watch, type Ref } from 'vue'
import { useRoute } from 'vue-router'

/**
 * 路由变化时自动关闭 drawer。
 *
 * 解决问题:drawer 内部点链接 router.push 跳到新路径(或同路径 query 变化)
 * 时,drawer 不会随路由切换自动消失,导致用户跳到目标页还看见旧 drawer 罩着。
 *
 * 用法(在 setup 顶层调用一次):
 *   const detailVisible = ref(false)
 *   useDrawerAutoClose(detailVisible)
 *
 * 多个 drawer 各调一次即可,或传数组一次接管多个:
 *   useDrawerAutoClose([detailVisible, editVisible])
 */
export function useDrawerAutoClose(visible: Ref<boolean> | Ref<boolean>[]) {
  const route = useRoute()
  const refs = Array.isArray(visible) ? visible : [visible]

  watch(
    () => route.fullPath,
    () => {
      for (const r of refs) {
        if (r.value) r.value = false
      }
    },
  )
}
