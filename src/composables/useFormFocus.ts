import { nextTick, watch, type Ref, type WatchSource } from 'vue'
import type { FormInstance } from 'element-plus'

/**
 * Dialog/Drawer 打开后自动 focus 第一个可编辑控件;
 * `el-form validate` 失败时 focus 第一个 error 控件。
 *
 * 接入:
 *   const { formRef, validate } = useFormValidate()
 *   const focus = useFormFocus(formRef, () => createDrawerVisible.value)
 *   // validate fail 自动 focus 由 useFormValidate 调用 focus.focusFirstError() 即可,
 *   // 这里也对外暴露 focusFirst()/focusFirstError() 供业务自己触发
 */
export interface UseFormFocusOptions {
  /** 选择器:决定"第一个可编辑"。默认覆盖 input/textarea/select trigger */
  selector?: string
  /** 自动 focus 的延迟 tick 数(默认 1) */
  tickCount?: number
}

const DEFAULT_SELECTOR = [
  'input:not([type="hidden"]):not([disabled]):not([readonly])',
  'textarea:not([disabled]):not([readonly])',
  '[contenteditable="true"]',
  // EP el-select / el-date-picker 内部把焦点放在 .el-input__inner 上
  '.el-input__inner:not([disabled]):not([readonly])',
].join(', ')

function getFormEl(formRef: Ref<FormInstance | undefined>): HTMLElement | null {
  const inst = formRef.value as unknown as { $el?: HTMLElement } | undefined
  return inst?.$el ?? null
}

export function useFormFocus(
  formRef: Ref<FormInstance | undefined>,
  visibleSource?: WatchSource<boolean>,
  options: UseFormFocusOptions = {},
) {
  const selector = options.selector ?? DEFAULT_SELECTOR
  const tickCount = options.tickCount ?? 1

  async function waitTicks(n: number) {
    for (let i = 0; i < n; i++) await nextTick()
  }

  function focusFirst() {
    const root = getFormEl(formRef)
    if (!root) return
    const el = root.querySelector<HTMLElement>(selector)
    if (el) {
      try {
        el.focus({ preventScroll: false })
      } catch {
        el.focus()
      }
    }
  }

  function focusFirstError() {
    const root = getFormEl(formRef)
    if (!root) return
    // EP form-item 校验失败时挂 .is-error class
    const errItem = root.querySelector<HTMLElement>('.el-form-item.is-error')
    if (!errItem) return
    const el = errItem.querySelector<HTMLElement>(selector)
    if (el) {
      try {
        el.focus({ preventScroll: false })
      } catch {
        el.focus()
      }
    }
  }

  if (visibleSource) {
    watch(
      visibleSource,
      async (v) => {
        if (v) {
          await waitTicks(tickCount)
          focusFirst()
        }
      },
      { immediate: false },
    )
  }

  return { focusFirst, focusFirstError }
}
