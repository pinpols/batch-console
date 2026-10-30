export interface NotificationChannelRequestScope {
  tenantId: string
  generation: number
}

export function createNotificationChannelRequestFence() {
  let generation = 0

  return {
    begin(tenantId: string): NotificationChannelRequestScope {
      generation += 1
      return { tenantId, generation }
    },
    isCurrent(scope: NotificationChannelRequestScope, activeTenantId: string): boolean {
      return scope.generation === generation && scope.tenantId === activeTenantId
    },
    invalidate() {
      generation += 1
    },
  }
}
