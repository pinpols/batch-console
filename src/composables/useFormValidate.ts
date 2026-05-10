import { ref } from 'vue'
import type { FormInstance, FormItemRule } from 'element-plus'
import { ElMessage } from 'element-plus'

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
        ElMessage.warning(firstMsg || '请检查表单必填项')
      }
      // 自动滚动到第一个 invalid field(EP form-item.scrollToField 内置)
      const firstField = pickFirstErrorField(errors)
      if (firstField) inst.scrollToField(firstField)
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

/** 常用 rule 工厂,避免每页重复写 trigger/message */
export const rules = {
  required: (message: string, trigger: 'blur' | 'change' = 'blur'): FormItemRule => ({
    required: true,
    message,
    trigger,
  }),

  minLength: (n: number, trigger: 'blur' | 'change' = 'blur'): FormItemRule => ({
    min: n,
    message: `至少 ${n} 个字符`,
    trigger,
  }),

  maxLength: (n: number, trigger: 'blur' | 'change' = 'blur'): FormItemRule => ({
    max: n,
    message: `最多 ${n} 个字符`,
    trigger,
  }),

  pattern: (re: RegExp, message: string, trigger: 'blur' | 'change' = 'blur'): FormItemRule => ({
    pattern: re,
    message,
    trigger,
  }),

  /** code 类字段:大小写字母 + 数字 + 下划线 + 连字符,字母开头 */
  code: (message = '只允许字母 / 数字 / _ / -,字母开头'): FormItemRule => ({
    pattern: /^[a-zA-Z][\w-]*$/,
    message,
    trigger: 'blur',
  }),

  /** tenantId 风格:大小写字母 / 数字 / 连字符,3-64 长度 */
  tenantId: (): FormItemRule => ({
    pattern: /^[a-z0-9][a-z0-9-]{2,63}$/i,
    message: '由 3-64 位字母 / 数字 / 连字符组成,字母或数字开头',
    trigger: 'blur',
  }),
}
