import { describe, expect, it } from 'vitest'
import type { AtomicTaskTypeSchema } from '@/api/atomicTaskTypes'
import { prepareAtomicTaskConfig } from './atomicTaskConfigDraft'

const shellSchema: AtomicTaskTypeSchema = {
  taskType: 'shell',
  displayName: 'Shell',
  enabledByDefault: false,
  parameters: [
    { name: 'command', type: 'string', required: true, description: '' },
    { name: 'args', type: 'list', required: false, description: '' },
  ],
  securityGates: [],
}

describe('prepareAtomicTaskConfig', () => {
  it('rejects non-positive, fractional and unsafe timeout numbers for all four executors', () => {
    for (const [taskType, key] of [
      ['shell', 'timeoutSeconds'],
      ['http', 'timeoutSeconds'],
      ['sql', 'statementTimeoutSeconds'],
      ['stored_proc', 'statementTimeoutSeconds'],
    ] as const) {
      const schema: AtomicTaskTypeSchema = {
        ...shellSchema,
        taskType,
        parameters: [{ name: key, type: 'number', required: false, description: '' }],
      }
      for (const value of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
        expect(prepareAtomicTaskConfig(schema, { [key]: value }).invalidFields).toEqual([key])
      }
      expect(prepareAtomicTaskConfig(schema, { [key]: 1 }).invalidFields).toEqual([])
    }
  })

  it('parses list text to a list before saving', () => {
    const prepared = prepareAtomicTaskConfig(shellSchema, {
      command: '/usr/bin/echo',
      args: '["--mode=summary"]',
    })

    expect(prepared.parameters.args).toEqual(['--mode=summary'])
    expect(prepared.invalidFields).toEqual([])
    expect(prepared.inlineCredentialFields).toEqual([])
  })

  it('rejects malformed list text without exposing the input', () => {
    const prepared = prepareAtomicTaskConfig(shellSchema, {
      command: '/usr/bin/echo',
      args: '[--token=probe-secret',
    })

    expect(prepared.invalidFields).toEqual(['args'])
    expect(prepared.invalidFields.join(',')).not.toContain('probe-secret')
  })

  it('detects inline credentials in parsed Shell arguments', () => {
    const prepared = prepareAtomicTaskConfig(shellSchema, {
      command: '/usr/bin/echo',
      args: '["--token=probe-secret"]',
    })

    expect(prepared.inlineCredentialFields).toEqual(['args'])
    expect(prepared.inlineCredentialFields.join(',')).not.toContain('probe-secret')
  })

  it('rejects Shell argument lists containing non-string items', () => {
    const prepared = prepareAtomicTaskConfig(shellSchema, {
      command: '/usr/bin/echo',
      args: '[{"mode":"summary"}]',
    })

    expect(prepared.invalidFields).toEqual(['args'])
  })

  it('parses map text to an object for the HTTP schema', () => {
    const httpSchema: AtomicTaskTypeSchema = {
      ...shellSchema,
      taskType: 'http',
      parameters: [{ name: 'headers', type: 'map', required: false, description: '' }],
    }
    const prepared = prepareAtomicTaskConfig(httpSchema, {
      headers: '{"Accept":"application/json"}',
    })

    expect(prepared.parameters.headers).toEqual({ Accept: 'application/json' })
    expect(prepared.invalidFields).toEqual([])
  })
})
