import { ref } from 'vue'
import type { FormInstance, FormItemRule } from 'element-plus'
import { ElMessage } from 'element-plus'
import { i18n } from '@/locales'

/**
 * 标准化 el-form 客户端校验流程,消除每页手写
 * `await formRef.value?.validate().catch(() => false)` 的样板。
 *
 * 用法:
 *   const { formRef, validate, resetFields, scrollToError } = useFormValidate()
 *   ...
 *   <el-form :ref="formRef" :model="form" :rules="rules" ...>
 *
 *   async function onSave() {
 *     if (!(await validate())) return // 校验失败已自动 toast + 滚到错误项
 *     await api.save(form.value)
 *   }
 *
 * 行为:
 *  - validate():通过返回 true,失败 false(并 toast 提示 + scrollToError)
 *  - 不需要业务方再 try/catch / 自己提示
 */
export function useFormValidate() {
  const formRef = ref<FormInstance>()

  async function validate(opts?: { silent?: boolean }): Promise<boolean> {
    const inst = formRef.value
    if (!inst) return false
    try {
      await inst.validate()
      return true
    } catch (errors) {
      // EP 抛 errors 是 { fieldName: [{ message }, ...] } 形态
      if (!opts?.silent) {
        const firstMsg = pickFirstErrorMessage(errors)
        ElMessage.warning(firstMsg || i18n.global.t('form.checkRequired'))
      }
      // 自动滚动到第一个 invalid field(EP form-item.scrollToField 内置)
      const firstField = pickFirstErrorField(errors)
      if (firstField) inst.scrollToField(firstField)
      // 同时把焦点放到第一个 error 控件,避免用户还要鼠标找
      try {
        const root = (inst as unknown as { $el?: HTMLElement }).$el
        const errItem = root?.querySelector<HTMLElement>('.el-form-item.is-error')
        const focusable = errItem?.querySelector<HTMLElement>(
          'input:not([type="hidden"]):not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly]), .el-input__inner:not([disabled]):not([readonly])',
        )
        focusable?.focus()
      } catch {
        // focus 失败不影响校验结果
      }
      return false
    }
  }

  function resetFields() {
    formRef.value?.resetFields()
  }

  function clearValidate() {
    formRef.value?.clearValidate()
  }

  return { formRef, validate, resetFields, clearValidate }
}

function pickFirstErrorMessage(errors: unknown): string {
  if (!errors || typeof errors !== 'object') return ''
  for (const k of Object.keys(errors)) {
    const arr = (errors as Record<string, unknown>)[k]
    if (Array.isArray(arr) && arr.length > 0) {
      const first = arr[0] as { message?: string }
      if (first?.message) return first.message
    }
  }
  return ''
}

function pickFirstErrorField(errors: unknown): string | null {
  if (!errors || typeof errors !== 'object') return null
  const keys = Object.keys(errors)
  return keys[0] ?? null
}

/**
 * 把入参当作 i18n key 试取,取到就用翻译,取不到回落到原文。
 *
 * 这样老调用 `rules.required('名称必填')` 仍然显示中文(EN 用户看到中文,可接受过渡),
 * 新调用 `rules.required('tenantList.fieldTenantName')` 会按当前 locale 渲染。
 */
function tr(messageOrKey: string | undefined, fallback?: string): string {
  if (!messageOrKey) return fallback ?? ''
  if (i18n.global.te(messageOrKey)) {
    return i18n.global.t(messageOrKey)
  }
  return messageOrKey
}

/**
 * 常用 rule 工厂,避免每页重复写 trigger/message。
 *
 * 所有 message 入参都过一遍 `tr()`:
 *  - 传 i18n key(如 `'tenantList.fieldTenantName'`)→ 翻译为当前 locale
 *  - 传字面量(如 `'名称必填'`)→ 直接用,实现增量迁移不破坏现网
 *
 * 默认 message 走 `form.*` 命名空间,自动跟随语言切换。
 */
export const rules = {
  required: (message?: string, trigger: 'blur' | 'change' = 'blur'): FormItemRule => ({
    required: true,
    message: tr(message, i18n.global.t('form.checkRequired')),
    trigger,
  }),

  minLength: (n: number, trigger: 'blur' | 'change' = 'blur'): FormItemRule => ({
    min: n,
    message: i18n.global.t('form.minLength', { min: n }),
    trigger,
  }),

  maxLength: (n: number, trigger: 'blur' | 'change' = 'blur'): FormItemRule => ({
    max: n,
    message: i18n.global.t('form.maxLength', { max: n }),
    trigger,
  }),

  pattern: (re: RegExp, message: string, trigger: 'blur' | 'change' = 'blur'): FormItemRule => ({
    pattern: re,
    message: tr(message),
    trigger,
  }),

  /** code 类字段:大小写字母 + 数字 + 下划线 + 连字符,字母开头 */
  code: (message?: string): FormItemRule => ({
    pattern: /^[a-zA-Z][\w-]*$/,
    message: tr(message, i18n.global.t('form.codePattern')),
    trigger: 'blur',
  }),

  /** tenantId 风格:大小写字母 / 数字 / 连字符,3-64 长度 */
  tenantId: (): FormItemRule => ({
    pattern: /^[a-z0-9][a-z0-9-]{2,63}$/i,
    message: i18n.global.t('form.tenantIdPattern'),
    trigger: 'blur',
  }),
}
