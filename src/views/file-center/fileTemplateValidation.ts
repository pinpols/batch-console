type ValidationMessage = (
  key: 'fileTemplateList.validationRequired' | 'fileTemplateList.validationCodeFormat',
  label: string,
) => string

// 与后端 ValidResourceCode 一致：字母开头，最多 128 位。
const RESOURCE_CODE_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]{0,127}$/

export function optionalText(value: string): string | undefined {
  const text = value.trim()
  return text ? text : undefined
}

export function createFileTemplateValidation(message: ValidationMessage) {
  function requireText(value: string, label: string): string {
    const text = value.trim()
    if (!text) throw new Error(message('fileTemplateList.validationRequired', label))
    return text
  }

  function requireCode(value: string, label: string): string {
    const text = requireText(value, label)
    if (!RESOURCE_CODE_PATTERN.test(text)) {
      throw new Error(message('fileTemplateList.validationCodeFormat', label))
    }
    return text
  }

  return { requireText, requireCode }
}
