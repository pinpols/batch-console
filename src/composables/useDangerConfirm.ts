import { ElMessageBox } from 'element-plus'
import { h } from 'vue'

/**
 * 销毁性 / 危险性操作的统一二次确认。
 *
 * 解决 P0 问题:全站 19 处 ElMessageBox.confirm 文案模糊(只说"删除?"不说后果),
 * 用户已经麻木地点确认。这里强制要求"动词 + 对象 + 后果 + 是否可恢复"四段。
 *
 * 用法:
 *   await confirmDanger({
 *     verb: '永久吊销',
 *     target: `API Key 「${row.keyName}」`,
 *     consequence: '该 Key 立即失效,所有正在使用此密钥的请求会被拒绝',
 *     irreversible: true,
 *   })
 *   // 用户点取消会 throw,外层 try/catch 即可
 *
 * 行为:
 *   - irreversible=true:标题加"⚠️ 不可恢复",confirm 按钮红色,需类型确认 token(可选)
 *   - irreversible=false:warning 风格,confirm 按钮主色
 *   - 标题与按钮文案自动从 verb + target 拼出
 */
export interface DangerConfirmOptions {
  /** 动词:"删除" / "吊销" / "强制下线" / "终止" / "归档" 等 */
  verb: string
  /** 操作对象的人话描述,如 `API Key 「acme-prod」` 或 `工作流「订单清算」` */
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
 * 用户点确认 resolve void,继续后续业务逻辑。
 */
export function confirmDanger(opts: DangerConfirmOptions): Promise<void> {
  const {
    verb,
    target,
    consequence,
    irreversible = false,
    confirmButtonText,
    cancelButtonText = '取消',
  } = opts

  const title = irreversible ? `${verb}${target}(不可恢复)` : `${verb}${target}`
  const reversibility = irreversible ? '此操作不可恢复' : '可在列表里恢复或重新启用'

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

  return ElMessageBox.confirm(content, title, {
    type: irreversible ? 'error' : 'warning',
    confirmButtonText: confirmButtonText ?? (irreversible ? `确认${verb}` : '确定'),
    cancelButtonText,
    confirmButtonClass: irreversible ? 'el-button--danger' : '',
    // 不可恢复操作:不让点 mask 关闭(避免误操作)
    closeOnClickModal: !irreversible,
    closeOnPressEscape: true,
    showClose: true,
    dangerouslyUseHTMLString: false,
  }).then(() => undefined)
}
