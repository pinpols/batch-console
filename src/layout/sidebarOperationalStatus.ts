export type SidebarOperationalTone =
  'normal' | 'scheduled' | 'read-only' | 'maintenance' | 'admin-bypass' | 'degraded' | 'unknown'

export interface SidebarMaintenanceState {
  enabled: boolean
  active: boolean
  readOnly: boolean
  adminBypass: boolean
  lastSyncedAt: string | null
  syncError: string | null
  isStale: boolean
}

export interface SidebarOperationalStatus {
  tone: SidebarOperationalTone
  labelKey: string
  descriptionKey: string
}

const STATUS_KEYS: Record<SidebarOperationalTone, string> = {
  normal: 'normal',
  scheduled: 'scheduled',
  'read-only': 'readOnly',
  maintenance: 'maintenance',
  'admin-bypass': 'adminBypass',
  degraded: 'degraded',
  unknown: 'unknown',
}

export function resolveSidebarOperationalStatus(
  maintenance: SidebarMaintenanceState,
  isDegraded: boolean,
): SidebarOperationalStatus {
  let tone: SidebarOperationalTone

  const maintenanceStateIsUnknown = Boolean(
    !maintenance.lastSyncedAt || maintenance.syncError || maintenance.isStale,
  )
  if (maintenanceStateIsUnknown) {
    tone = 'unknown'
  } else if (maintenance.active && maintenance.adminBypass) {
    tone = 'admin-bypass'
  } else if (maintenance.active && maintenance.readOnly) {
    tone = 'read-only'
  } else if (maintenance.active) {
    tone = 'maintenance'
  } else if (isDegraded) {
    tone = 'degraded'
  } else if (maintenance.enabled) {
    tone = 'scheduled'
  } else {
    tone = 'normal'
  }

  const key = STATUS_KEYS[tone]
  return {
    tone,
    labelKey: `nav.operationalStatus.${key}`,
    descriptionKey: `nav.operationalStatusDescription.${key}`,
  }
}
