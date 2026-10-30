import type { AtomicTaskTypeSchema } from '@/api/atomicTaskTypes'
import { SENSITIVE_KEYWORDS } from '@/utils/sensitiveKeys'

export interface PreparedAtomicTaskConfig {
  parameters: Record<string, unknown>
  invalidFields: string[]
  inlineCredentialFields: string[]
}

export function prepareAtomicTaskConfig(
  schema: AtomicTaskTypeSchema,
  draft: Record<string, unknown>,
): PreparedAtomicTaskConfig {
  const parameters = { ...draft }
  const invalidFields: string[] = []
  const inlineCredentialFields: string[] = []

  for (const spec of schema.parameters) {
    const raw = parameters[spec.name]
    if (raw === undefined || raw === null) continue
    if ((spec.type === 'list' || spec.type === 'map') && raw === '' && !spec.required) {
      delete parameters[spec.name]
      continue
    }
    if ((spec.type === 'list' || spec.type === 'map') && typeof raw === 'string') {
      try {
        parameters[spec.name] = JSON.parse(raw)
      } catch {
        invalidFields.push(spec.name)
        continue
      }
    }
    if (
      !matchesType(spec.type, parameters[spec.name]) ||
      invalidExecutorTimeout(schema.taskType, spec.name, parameters[spec.name])
    ) {
      invalidFields.push(spec.name)
    }
  }

  if (schema.taskType === 'shell') {
    if (typeof parameters.command === 'string' && containsInlineCredential(parameters.command)) {
      inlineCredentialFields.push('command')
    }
    const args = parameters.args
    if (Array.isArray(args)) {
      if (!args.every((arg) => typeof arg === 'string')) invalidFields.push('args')
      if (args.some((arg) => typeof arg === 'string' && containsInlineCredential(arg))) {
        inlineCredentialFields.push('args')
      }
    }
  }

  return {
    parameters,
    invalidFields: [...new Set(invalidFields)],
    inlineCredentialFields,
  }
}

function invalidExecutorTimeout(taskType: string, name: string, value: unknown): boolean {
  const isTimeout =
    (['shell', 'http'].includes(taskType) && name === 'timeoutSeconds') ||
    (['sql', 'stored_proc'].includes(taskType) && name === 'statementTimeoutSeconds')
  return isTimeout && (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0)
}

function matchesType(type: string, value: unknown): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string'
    case 'number':
    case 'integer':
      return typeof value === 'number' && Number.isFinite(value)
    case 'boolean':
      return typeof value === 'boolean'
    case 'list':
      return Array.isArray(value)
    case 'map':
      return value !== null && typeof value === 'object' && !Array.isArray(value)
    default:
      return false
  }
}

function isSensitiveName(name: string): boolean {
  const normalized = name.toLowerCase().replace(/[_-]/g, '')
  return SENSITIVE_KEYWORDS.some((keyword) => normalized.includes(keyword))
}

function containsInlineCredential(value: string): boolean {
  const option = /^\s*--?([^=:\s]+)/.exec(value)
  if (option?.[1] && isSensitiveName(option[1])) return true
  if (/\bBearer\s+[-\w.~+/=]+/i.test(value)) return true
  if (/[a-z][a-z0-9+.-]*:\/\/[^/@\s:]+:[^/@\s]+@/i.test(value)) return true
  if (/[?&]key=/i.test(value)) return true

  const assignments = value.matchAll(/(?:^|[\s?&"'])\s*([\w-]+)\s*[:=]\s*[^\s,;}&]+/g)
  for (const assignment of assignments) {
    if (assignment[1] && isSensitiveName(assignment[1])) return true
  }
  return false
}
