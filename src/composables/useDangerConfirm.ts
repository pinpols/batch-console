import { ElMessageBox } from 'element-plus'
import { h, watch } from 'vue'
import { useTenantStore } from '@/stores/tenant'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { i18n } from '@/locales'

/**
 * 危险操作统一展示动作、对象、后果及可恢复性，并将确认绑定到打开时的业务上下文。
 *
 * 调用方在确认后继续执行，取消或上下文变化时收到同一取消拒绝；最终权限、状态与幂等
 * 仍由服务端裁决。不可恢复操作使用错误色，不能点击遮罩关闭。
 */
export interface DangerConfirmOptions {
  /** 动词:"删除" / "吊销" / "强制下线" / "终止" / "归档" 等 */
  verb: string
  /** 操作对象的业务描述,如 `API Key 「acme-prod」` 或 `工作流「订单清算」` */
  target: string
  /** 后果(用户能感知的影响),一句话说清,可省略 */
  consequence?: string
  /** 是否真不可恢复(吊销 / 永久删除 / 强制终止 / 物理删除) */
  irreversible?: boolean
  /** 自定义 confirm 按钮文案;默认由 verb 生成 */
  confirmButtonText?: string
  /** 自定义取消按钮文案;默认 "取消" */
  cancelButtonText?: string
}

/**
 * 弹出危险确认框。用户点取消会 reject(throw),外层用 try/catch 处理。
 * 用户点确认 resolve void,上下文仍有效时继续后续业务逻辑；租户、主体、权限或维护状态变化按取消处理。
 */
export async function confirmDanger(opts: DangerConfirmOptions): Promise<void> {
  const t = i18n.global.t
  const {
    verb,
    target,
    consequence,
    irreversible = false,
    confirmButtonText,
    cancelButtonText = t('dangerConfirm.cancel'),
  } = opts

  const title = irreversible
    ? `${verb}${target}${t('dangerConfirm.irreversibleSuffix')}`
    : `${verb}${target}`
  const reversibility = irreversible
    ? t('dangerConfirm.irreversibleNote')
    : t('dangerConfirm.reversibleNote')

  // 富文本内容:用 h() 而非纯字符串,避免转义;红字突出后果
  const content = h('div', { style: { lineHeight: '1.7' } }, [
    consequence ? h('div', { style: { marginBottom: '8px' } }, consequence) : null,
    h(
      'div',
      {
        style: {
          fontSize: '13px',
          fontWeight: irreversible ? 600 : 400,
          color: irreversible
            ? 'var(--el-color-danger, #f56c6c)'
            : 'var(--color-text-tertiary, #909399)',
        },
      },
      reversibility,
    ),
  ])

  const tenant = useTenantStore()
  const auth = useAuthStore()
  const app = useAppStore()
  let contextChanged = false
  // 确认只对打开时的上下文有效；同步观察可识别 A→B→A 和短暂维护窗口。
  const stop = watch(
    [
      () => tenant.tenantId,
      () => auth.isLoggedIn,
      () => auth.userInfo?.userId,
      () => auth.userInfo?.username,
      () => JSON.stringify([...(auth.userInfo?.permissions ?? [])].sort()),
      () => app.writesFrozen,
    ],
    () => {
      contextChanged = true
    },
    { flush: 'sync' },
  )
  try {
    await ElMessageBox.confirm(content, title, {
      type: irreversible ? 'error' : 'warning',
      confirmButtonText:
        confirmButtonText ??
        (irreversible ? t('dangerConfirm.confirmVerb', { verb }) : t('dangerConfirm.confirm')),
      cancelButtonText,
      confirmButtonClass: irreversible ? 'el-button--danger' : '',
      // 不可恢复操作:不让点 mask 关闭(避免误操作)
      closeOnClickModal: !irreversible,
      closeOnPressEscape: true,
      showClose: true,
      dangerouslyUseHTMLString: false,
    })
    // 与 Element Plus 用户取消保持同一拒绝契约，调用方不能继续执行旧确认。
    if (contextChanged || app.writesFrozen) return Promise.reject('cancel')
  } finally {
    stop()
  }
}
