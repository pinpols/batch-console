import { nextTick, ref, watch, type Ref } from 'vue'

export function useAiAutoScroll(content: Ref<unknown>) {
  const element = ref<HTMLElement | null>(null)
  const following = ref(true)
  let frame = 0

  function onScroll() {
    const target = element.value
    if (!target) return
    following.value = target.scrollHeight - target.scrollTop - target.clientHeight < 80
  }

  function follow() {
    following.value = true
    void nextTick(() => {
      if (element.value) element.value.scrollTop = element.value.scrollHeight
    })
  }

  watch(
    content,
    () => {
      if (!following.value || frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        if (following.value && element.value) element.value.scrollTop = element.value.scrollHeight
      })
    },
    { flush: 'post' },
  )

  return { element, onScroll, follow }
}
