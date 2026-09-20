export const CONFIG_SYNC_TYPE_DEFINITIONS = [
  { value: 'JOB', labelKey: 'configSyncTab.typeJob' },
  { value: 'WORKFLOW', labelKey: 'configSyncTab.typeWorkflow' },
  { value: 'PIPELINE', labelKey: 'configSyncTab.typePipeline' },
  { value: 'FILE_CHANNEL', labelKey: 'configSyncTab.typeFileChannel' },
  { value: 'FILE_TEMPLATE', labelKey: 'configSyncTab.typeFileTemplate' },
  { value: 'RESOURCE_QUEUE', labelKey: 'configSyncTab.typeResourceQueue' },
  { value: 'BATCH_WINDOW', labelKey: 'configSyncTab.typeBatchWindow' },
  { value: 'BUSINESS_CALENDAR', labelKey: 'configSyncTab.typeBusinessCalendar' },
  { value: 'QUOTA_POLICY', labelKey: 'configSyncTab.typeQuotaPolicy' },
  { value: 'ALERT_ROUTING', labelKey: 'configSyncTab.typeAlertRouting' },
] as const

export type ConfigSyncType = (typeof CONFIG_SYNC_TYPE_DEFINITIONS)[number]['value']

export function localizeConfigSyncTypeOptions(translate: (key: string) => string) {
  return CONFIG_SYNC_TYPE_DEFINITIONS.map(({ value, labelKey }) => ({
    value,
    label: translate(labelKey),
  }))
}
