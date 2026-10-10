import { describe, expect, it } from 'vitest'
import { STORAGE_KEYS } from './storageKeys'

describe('STORAGE_KEYS', () => {
  it('preserves persisted keys used by previously released versions', () => {
    expect(STORAGE_KEYS).toEqual({
      tenantId: 'batch-console-tenant-id',
      operationLog: 'batch-console-oplog',
      session: 'batch-console-session',
      passwordNotice: 'batch-console-password-notice',
      telemetry: 'batch-console-telemetry',
      onboardingDone: 'batch-console-onboarding-done',
      locale: 'batch-console:locale',
      theme: 'batch-console:theme',
      themeRedesignDefault: 'batch-console:theme-redesign-default-v1',
      contentDensity: 'batch-console:content-density',
      displayTimezone: 'batch-console:display-timezone',
      sidebarCollapsed: 'batch-console:sidebar-collapsed',
      focusMode: 'batch-console:focus-mode',
      mobileInstallHintDismissedAt: 'batch-console:m-install-hint-dismissed-at',
    })
  })
})
