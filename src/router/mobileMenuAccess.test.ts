import { describe, expect, it } from 'vitest'
import { mobileMenuAccess } from './mobileMenuAccess'

describe('mobile menu access', () => {
  it('maps execution, definition and privileged mobile pages to the correct business menus', () => {
    expect(mobileMenuAccess['m-workflow-run']).toBe('/monitor/workflow-runs')
    expect(mobileMenuAccess['m-workflow-viewer']).toBe('/workflow/definitions')
    expect(mobileMenuAccess['m-approvals']).toBe('/approvals')
    expect(mobileMenuAccess['m-workers']).toBe('/workers/management')
  })
})
