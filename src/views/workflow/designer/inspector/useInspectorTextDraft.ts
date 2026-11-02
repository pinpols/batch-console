import { onBeforeUnmount, ref, watch } from 'vue'
import { useDesignerStore, type InspectorDraftField } from '../store/useDesignerStore'

/** 将失焦前及输入法组合中的文字保留在当前画布，不触发服务端写入。 */
export function useInspectorTextDraft(
  field: InspectorDraftField,
  elementId: () => string,
  current: () => string,
  readonly: () => boolean,
) {
  const store = useDesignerStore()
  const value = ref('')
  const scope = store.inspectorScope
  const id = elementId()
  let mounted = true
  onBeforeUnmount(() => {
    mounted = false
  })

  function isCurrent() {
    return mounted && store.inspectorScope === scope && elementId() === id
  }

  watch(
    () => [elementId(), current()] as const,
    ([id, original]) => {
      value.value = store.getInspectorDraft(field, id)?.value ?? original
    },
    { immediate: true, flush: 'sync' },
  )
  watch(
    () => store.getInspectorDraft(field, elementId())?.value,
    (draft, previous) => {
      if (draft === undefined && previous !== undefined) value.value = current()
    },
    { flush: 'sync' },
  )

  function update(next: string) {
    if (!isCurrent() || readonly()) return
    value.value = next
    store.setInspectorDraft(field, id, next, scope)
  }

  function captureInput(event: Event) {
    const target = event.target
    if (
      !isCurrent() ||
      readonly() ||
      !(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
    )
      return
    store.setInspectorDraft(field, id, target.value, scope)
  }

  return { value, update, captureInput, isCurrent, scope, id }
}
