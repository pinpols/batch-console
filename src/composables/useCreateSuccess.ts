import { ElMessageBox } from 'element-plus'
import { i18n } from '@/locales'

/**
 * 创建/触发后引导卡片。解决体检报告"病根 2:做完就完事,没下一步引导"——
 * 操作员填完表单 toast"已创建"就关掉,接下来该去哪要靠记忆。
 *
 * 用法:
 *   showCreateSuccess({
 *     message: '已创建租户「acme-prod」,推荐立即初始化配置(队列/参数/告警)',
 *     primary: { label: '去初始化', onClick: () => openInitConfig(row) },
 *     secondary: { label: '查看列表' },  // 可选;不传则只有"关闭"
 *   })
 *
 * 实现选 ElMessageBox.confirm 而非自造 modal:Element Plus 已统一了焦点管理 / aria /
 * 暗色 / 移动端布局;再造一份只是噪音。confirm 按钮 = primary CTA,cancel 按钮 = secondary,
 * X 关闭按钮 = 什么都不做(distinguishCancelAndClose 区分 cancel 和 close)。
 */

export interface SuccessAction {
  label: string
  /** 点击回调;不传则仅关闭对话框 */
  onClick?: () => void | Promise<void>
}

export interface CreateSuccessOptions {
  title?: string
  message: string
  primary: SuccessAction
  secondary?: SuccessAction
}

export function showCreateSuccess(opts: CreateSuccessOptions): void {
  ElMessageBox({
    title: opts.title ?? i18n.global.t('commonAction.operationSuccess'),
    message: opts.message,
    type: 'success',
    confirmButtonText: opts.primary.label,
    cancelButtonText: opts.secondary?.label ?? i18n.global.t('commonAction.close'),
    showCancelButton: true,
    distinguishCancelAndClose: true,
    closeOnClickModal: false,
    callback: (action: string) => {
      if (action === 'confirm') {
        void opts.primary.onClick?.()
      } else if (action === 'cancel') {
        void opts.secondary?.onClick?.()
      }
      // 'close' (X / Escape) → 不触发任何 action,等同"取消"语义但不调 secondary
    },
  })
}
