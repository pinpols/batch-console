import type { TerminalDelivery } from '@/api/terminalNotifications'

const pushStatusKeys: Record<string, string> = {
  ACCEPTED: 'providerAccepted',
  GONE: 'deviceGone',
  IN_FLIGHT: 'inFlight',
  DISABLED: 'intakeDisabled',
  DRY_RUN: 'intakeDryRun',
  NO_OPERATOR: 'noOperator',
  NO_SUBSCRIPTIONS: 'noDevices',
  QUEUED: 'intakeQueued',
}

export function terminalDeliveryStatusKey(row: TerminalDelivery) {
  const key = row.source === 'PUSH' ? pushStatusKeys[row.deliveryStatus] : undefined
  return key ? `terminalNotifications.${key}` : undefined
}

/**
 * 状态标签颜色：送达/已受理为成功，失败/放弃/设备失效为危险，排队与发送中为进行中，
 * 其余（未开启推送、演练、无值班人、无设备）为中性提示。
 */
export function terminalDeliveryTone(
  row: TerminalDelivery,
): 'success' | 'danger' | 'primary' | 'info' {
  switch (row.deliveryStatus) {
    case 'SUCCESS':
    case 'ACCEPTED':
      return 'success'
    case 'FAILED':
    case 'EXHAUSTED':
    case 'GONE':
      return 'danger'
    case 'QUEUED':
    case 'IN_FLIGHT':
    case 'PENDING':
      return 'primary'
    default:
      return 'info'
  }
}

/** 只有已停止自动投递的失败记录可以进入人工核对。 */
export function canRetryTerminalDelivery(row: TerminalDelivery, now = Date.now()) {
  return (
    row.deliveryStatus === 'EXHAUSTED' &&
    row.attempt > 0 &&
    !row.nextRetryAt &&
    (!row.claimUntil || Date.parse(row.claimUntil) <= now)
  )
}
