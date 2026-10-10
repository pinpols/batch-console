import { describe, expect, it } from 'vitest'
import { createEmptyJobDefinitionCreateForm, createEmptyJobEditForm } from './jobEditFormTypes'

describe('jobEditFormTypes', () => {
  it('keeps monitoring policy out of the regular job creation form', () => {
    const form = createEmptyJobDefinitionCreateForm()

    expect(form).toMatchObject({ jobType: 'GENERAL', scheduleType: 'MANUAL' })
    expect(form).not.toHaveProperty('softRuntimeSeconds')
    expect(form).not.toHaveProperty('startGraceSeconds')
    expect(form).not.toHaveProperty('completionDeadlineSeconds')

    const editForm = createEmptyJobEditForm()
    expect(editForm).not.toHaveProperty('softRuntimeSeconds')
    expect(editForm).not.toHaveProperty('startGraceSeconds')
    expect(editForm).not.toHaveProperty('completionDeadlineSeconds')
  })
})
