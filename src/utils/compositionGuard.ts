/** 监听原生输入法组合，覆盖组件尚未向 v-model 提交的文本。 */
let attachedDocument: Document | undefined
let revision = 0
const active = new Set<Element>()
const awaitingModel = new Map<Element, number>()

function editableTarget(event: Event): Element | null {
  const target = event.target as
    (Element & { isContentEditable?: boolean; disabled?: boolean; readOnly?: boolean }) | null
  if (!target || target.disabled || target.readOnly) return null
  const tag = target.tagName?.toLowerCase()
  return tag === 'input' || tag === 'textarea' || target.isContentEditable ? target : null
}

function endComposition(target: Element) {
  if (!active.delete(target)) return
  revision += 1
  const sequence = revision
  awaitingModel.set(target, sequence)
  // compositionend 的捕获阶段早于控件的 model 更新；等下一轮事件循环后再解除保护。
  setTimeout(() => {
    if (awaitingModel.get(target) === sequence) awaitingModel.delete(target)
  }, 0)
}

export function readCompositionGuard(): { revision: number; pending: boolean } {
  if (typeof document !== 'undefined' && attachedDocument !== document) {
    attachedDocument = document
    active.clear()
    awaitingModel.clear()
    document.addEventListener(
      'compositionstart',
      (event) => {
        const target = editableTarget(event)
        if (!target) return
        awaitingModel.delete(target)
        active.add(target)
        revision += 1
      },
      true,
    )
    document.addEventListener(
      'input',
      (event) => {
        const target = editableTarget(event)
        if (target && (active.has(target) || awaitingModel.has(target))) revision += 1
      },
      true,
    )
    document.addEventListener(
      'compositionend',
      (event) => {
        const target = event.target as Element | null
        if (target) endComposition(target)
      },
      true,
    )
    document.addEventListener(
      'focusout',
      (event) => {
        const target = event.target as Element | null
        if (target) endComposition(target)
      },
      true,
    )
  }
  for (const target of active) {
    if (!target.isConnected) {
      active.delete(target)
      revision += 1
    }
  }
  return { revision, pending: active.size > 0 || awaitingModel.size > 0 }
}
