/** 浏览器持久化键；修改时需考虑已发布版本中保留的数据兼容性。 */
export const STORAGE_KEYS = {
  tenantId: 'batch-console-tenant-id',
  operationLog: 'batch-console-oplog',
  session: 'batch-console-session',
  passwordNotice: 'batch-console-password-notice',
  telemetry: 'batch-console-telemetry',
  onboardingDone: 'batch-console-onboarding-done',
} as const
