/**
 * iOS Action Sheet — 从底部滑上来的选项面板,替代 ElMessageBox.confirm 在移动端的居中弹窗。
 *
 * 用法:
 *   import { presentActionSheet } from '@/layout-mobile/MActionSheet'
 *   const ok = await presentActionSheet({
 *     title: '审批通过',
 *     message: '确定通过 #A123?',
 *     confirmText: '通过',
 *     confirmStyle: 'default', // 'destructive' 红字
 *   })
 *   if (!ok) return  // 用户点了取消或背景
 *
 * 实现:命令式生成 DOM,Promise resolve,自动清理。不挂 Vue 组件,
 * 不污染调用方组件树,跟 ElMessageBox.confirm 的调用契约一一对应,
 * 改造现有调用点只需替换函数名。
 */

interface ActionSheetOptions {
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
  confirmStyle?: 'default' | 'destructive'
}

let activeSheet: HTMLElement | null = null

export function presentActionSheet(opts: ActionSheetOptions): Promise<boolean> {
  // 同一时刻只允许一个 sheet,防止快速点按叠多层
  if (activeSheet) {
    activeSheet.remove()
    activeSheet = null
  }

  return new Promise((resolve) => {
    const backdrop = document.createElement('div')
    backdrop.className = 'm-action-sheet-backdrop'

    const sheet = document.createElement('div')
    sheet.className = 'm-action-sheet'
    sheet.setAttribute('role', 'dialog')
    sheet.setAttribute('aria-modal', 'true')

    const card = document.createElement('div')
    card.className = 'm-action-sheet__card'

    if (opts.title || opts.message) {
      const header = document.createElement('div')
      header.className = 'm-action-sheet__header'
      if (opts.title) {
        const titleEl = document.createElement('div')
        titleEl.className = 'm-action-sheet__title'
        titleEl.textContent = opts.title
        header.appendChild(titleEl)
      }
      if (opts.message) {
        const msgEl = document.createElement('div')
        msgEl.className = 'm-action-sheet__message'
        msgEl.textContent = opts.message
        header.appendChild(msgEl)
      }
      card.appendChild(header)
    }

    const confirmBtn = document.createElement('button')
    confirmBtn.type = 'button'
    confirmBtn.className =
      'm-action-sheet__btn ' +
      (opts.confirmStyle === 'destructive'
        ? 'm-action-sheet__btn--destructive'
        : 'm-action-sheet__btn--default')
    confirmBtn.textContent = opts.confirmText || '确定'
    // 给全局 tracker(.m-action-sheet__btn 已在 selectors)更结构化的事件名
    confirmBtn.setAttribute(
      'data-track',
      `actionSheet.confirm:${opts.title || opts.message || 'unknown'}`,
    )
    card.appendChild(confirmBtn)

    const cancelCard = document.createElement('div')
    cancelCard.className = 'm-action-sheet__cancel-card'
    const cancelBtn = document.createElement('button')
    cancelBtn.type = 'button'
    cancelBtn.className = 'm-action-sheet__btn m-action-sheet__btn--cancel'
    cancelBtn.textContent = opts.cancelText || '取消'
    cancelBtn.setAttribute(
      'data-track',
      `actionSheet.cancel:${opts.title || opts.message || 'unknown'}`,
    )
    cancelCard.appendChild(cancelBtn)

    sheet.appendChild(card)
    sheet.appendChild(cancelCard)
    document.body.appendChild(backdrop)
    document.body.appendChild(sheet)
    activeSheet = sheet
    // 强制 reflow → 触发 enter 动画
    void sheet.offsetHeight
    backdrop.classList.add('m-action-sheet-backdrop--open')
    sheet.classList.add('m-action-sheet--open')

    function close(result: boolean) {
      if (activeSheet !== sheet) return
      backdrop.classList.remove('m-action-sheet-backdrop--open')
      sheet.classList.remove('m-action-sheet--open')
      // 等动画结束再 remove,250ms 跟 CSS transition 时长一致
      setTimeout(() => {
        backdrop.remove()
        sheet.remove()
        if (activeSheet === sheet) activeSheet = null
        resolve(result)
      }, 240)
    }

    confirmBtn.addEventListener('click', () => close(true))
    cancelBtn.addEventListener('click', () => close(false))
    backdrop.addEventListener('click', () => close(false))
  })
}

/**
 * ElMessageBox.confirm 的 drop-in 替代:
 *   - 参数顺序 (message, title, opts) 同 ElMessageBox.confirm
 *   - 取消时 reject('cancel'),业务代码现有 try/catch 流程不动
 *   - opts.type='warning'/'error' 自动映射为 destructive 红色按钮
 */
export async function confirmActionSheet(
  message: string,
  title?: string,
  opts: {
    confirmButtonText?: string
    cancelButtonText?: string
    type?: 'info' | 'warning' | 'error' | 'success'
  } = {},
): Promise<'confirm'> {
  const ok = await presentActionSheet({
    title,
    message,
    confirmText: opts.confirmButtonText,
    cancelText: opts.cancelButtonText,
    confirmStyle: opts.type === 'warning' || opts.type === 'error' ? 'destructive' : 'default',
  })
  if (!ok) throw new Error('cancel')
  return 'confirm'
}
