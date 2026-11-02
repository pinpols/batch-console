import type { FormRules } from 'element-plus'
import type { JobEditFormState } from './jobEditFormTypes'

export function createJobDefinitionWizardRules(
  form: Pick<JobEditFormState, 'executionMode' | 'scheduleType'>,
  t: (key: string) => string,
): FormRules {
  // 表单校验:与编辑 drawer (JobDefinitionList) 一致的口径,避免向导提交后 BE 才报错
  const jobCodePattern = /^[a-zA-Z][a-zA-Z0-9_-]{0,127}$/
  const jobCodeRefPattern = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/
  const watermarkPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/
  const jsonValidator = (
    _rule: unknown,
    value: string | undefined,
    callback: (err?: Error) => void,
  ) => {
    if (!value || !value.trim()) return callback()
    try {
      JSON.parse(value)
      callback()
    } catch {
      const errorMessage = t('jobDefinitionWizard.errJsonInvalid')
      const validationError = new Error(errorMessage)
      callback(validationError)
    }
  }
  const watermarkValidator = (_rule: unknown, value: unknown, callback: (err?: Error) => void) => {
    if (form.executionMode !== 'INCREMENTAL') return callback()
    const v = typeof value === 'string' ? value.trim() : ''
    if (!v) {
      const errorMessage = t('jobDefinitionWizard.errWatermarkRequired')
      const validationError = new Error(errorMessage)
      return callback(validationError)
    }
    if (!watermarkPattern.test(v)) {
      const errorMessage = t('jobDefinitionWizard.errWatermarkPattern')
      const validationError = new Error(errorMessage)
      return callback(validationError)
    }
    return callback()
  }
  const jobCodeRefValidator = (_rule: unknown, value: unknown, callback: (err?: Error) => void) => {
    const v = typeof value === 'string' ? value.trim() : ''
    if (!v) return callback()
    if (jobCodeRefPattern.test(v)) return callback()
    const errorMessage = t('jobDefinitionWizard.errJobCodeRefPattern')
    const validationError = new Error(errorMessage)
    return callback(validationError)
  }
  const scheduleExprValidator = (
    _rule: unknown,
    value: unknown,
    callback: (err?: Error) => void,
  ) => {
    if (form.scheduleType === 'MANUAL') return callback()
    const v = typeof value === 'string' ? value.trim() : ''
    if (!v) {
      const errorMessage = t('jobDefinitionWizard.errScheduleExprRequired')
      const validationError = new Error(errorMessage)
      return callback(validationError)
    }
    return callback()
  }
  return {
    jobCode: [
      { required: true, message: t('jobDefinitionWizard.errJobCodeRequired'), trigger: 'blur' },
      {
        validator: (_r, v, cb) => {
          if (!v) return cb()
          const candidateJobCode = String(v)
          if (jobCodePattern.test(candidateJobCode)) return cb()
          const errorMessage = t('jobDefinitionWizard.errJobCodePattern')
          const validationError = new Error(errorMessage)
          return cb(validationError)
        },
        trigger: 'blur',
      },
    ],
    jobName: [
      { required: true, message: t('jobDefinitionWizard.errJobNameRequired'), trigger: 'blur' },
    ],
    jobType: [
      { required: true, message: t('jobDefinitionWizard.errJobTypeRequired'), trigger: 'change' },
    ],
    scheduleType: [
      {
        required: true,
        message: t('jobDefinitionWizard.errScheduleTypeRequired'),
        trigger: 'change',
      },
    ],
    executionMode: [
      {
        required: true,
        message: t('jobDefinitionWizard.errExecutionModeRequired'),
        trigger: 'change',
      },
    ],
    watermarkField: [{ validator: watermarkValidator, trigger: 'blur' }],
    dependsOnJobCode: [{ validator: jobCodeRefValidator, trigger: 'blur' }],
    scheduleExpr: [{ validator: scheduleExprValidator, trigger: 'blur' }],
    paramSchema: [{ validator: jsonValidator, trigger: 'blur' }],
    defaultParams: [{ validator: jsonValidator, trigger: 'blur' }],
  }
}
