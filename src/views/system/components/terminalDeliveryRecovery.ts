import type { TerminalDelivery } from '@/api/terminalNotifications'

const pushStatusKeys: Record<string, string> = {
  ACCEPTED: 'providerAccepted', GONE: 'deviceGone', IN_FLIGHT: 'inFlight',
  DISABLED: 'intakeDisabled', DRY_RUN: 'intakeDryRun', NO_OPERATOR: 'noOperator',
  NO_SUBSCRIPTIONS: 'noDevices', QUEUED: 'intakeQueued',
}

export function terminalDeliveryStatusKey(row: TerminalDelivery) {
  const key = row.source === 'PUSH' ? pushStatusKeys[row.deliveryStatus] : undefined
  return key ? `terminalNotifications.${key}` : undefined
}

/** 只有已停止自动投递的失败记录可以进入人工核对。 */
export function canRetryTerminalDelivery(row: TerminalDelivery, now = Date.now()) {
  return row.deliveryStatus === 'EXHAUSTED' && row.attempt > 0 && !row.nextRetryAt &&
    (!row.claimUntil || Date.parse(row.claimUntil) <= now)
}
