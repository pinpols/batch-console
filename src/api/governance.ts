import { del, get, post, put } from '@/api/client'
import { fetchAllPageItems } from '@/api/adapters'

/**
 * 治理列表（queues / batch-windows / calendars / quota-policies）：OpenAPI 多为分页 JSON，
 * 此处用 `fetchAllPageItems` 在客户端聚合成全量数组；节假日 `listCalendarHolidays` 为单次全量列表。
 * 上述 list 方法不向服务端传 UI 的 pageNo；表格分页在页面内用 `toPageResult` 完成。
 */
type RawRow = Record<string, unknown>

export interface GovernanceQueueRow {
  id: number
  tenantId: string
  queueCode: string
  queueName: string
  queueType: string
  fairShareGroup: string
  concurrentCap: number | null
  burstLimit: number | null
  enabled: boolean
  updatedAt: string
}

export interface GovernanceQueueSavePayload {
  tenantId: string
  queueCode?: string
  queueName?: string
  queueType?: string
  maxRunningJobs?: number
  maxRunningPartitions?: number
  maxQps?: number
  workerGroup?: string
  resourceTag?: string
  priorityPolicy?: string
  fairShareWeight?: number
  enabled?: boolean
  description?: string
}

export interface GovernanceBatchWindowRow {
  id: number
  tenantId: string
  windowCode: string
  windowName: string
  timezone: string
  startTime: string
  endTime: string
  endStrategy: string
  crossDayPolicy: string
  outOfWindowAction: string
  allowCrossDay: boolean
  enabled: boolean
  description: string
  updatedAt: string
}

export interface GovernanceBatchWindowSavePayload {
  tenantId: string
  windowCode?: string
  windowName?: string
  timezone?: string
  startTime?: string
  endTime?: string
  endStrategy?: string
  outOfWindowAction?: string
  allowCrossDay?: boolean
  enabled?: boolean
  description?: string
}

export interface GovernanceCalendarRow {
  id: number
  tenantId: string
  calendarCode: string
  calendarName: string
  timezone: string
  enabled: boolean
  updatedAt: string
}

export interface GovernanceCalendarSavePayload {
  tenantId: string
  calendarCode?: string
  calendarName: string
  timezone: string
  holidayRollRule?: string
  catchUpPolicy?: string
  catchUpMaxDays?: number
  enabled?: boolean
}

export interface GovernanceCalendarHolidayRow {
  id: number
  holidayDate: string
  holidayName: string
  holidayType: string
  enabled: boolean
  description: string
}

export interface GovernanceCalendarHolidaySavePayload {
  tenantId: string
  bizDate: string
  dayType: string
  holidayName?: string
  description?: string
}

export interface GovernanceQuotaPolicyRow {
  id: number
  tenantId: string
  policyCode: string
  fairShareWeight: number | null
  maxRunningJobsPerTenant: number | null
  maxPartitionsPerTenant: number | null
  maxQpsPerTenant: number | null
  enabled: boolean
  description: string
  updatedAt: string
}

export interface GovernanceQuotaPolicySavePayload {
  tenantId: string
  policyCode: string
  maxRunningJobsPerTenant?: number
  maxPartitionsPerTenant?: number
  maxQpsPerTenant?: number
  fairShareWeight?: number
  enabled?: boolean
  description?: string
}

export interface GovernanceAlertRoutingRow {
  id: number
  tenantId: string
  routeCode: string
  routeName: string
  team: string
  alertGroup: string
  severity: string
  receiver: string
  groupBy: string
  groupWaitSeconds: number | null
  groupIntervalSeconds: number | null
  repeatIntervalSeconds: number | null
  enabled: boolean
  description: string
  updatedAt: string
}

export interface GovernanceAlertRoutingSavePayload {
  tenantId: string
  routeCode: string
  routeName?: string
  team: string
  alertGroup?: string
  severity: string
  receiver: string
  groupBy?: string
  groupWaitSeconds?: number
  groupIntervalSeconds?: number
  repeatIntervalSeconds?: number
  enabled?: boolean
  description?: string
}

function readString(row: RawRow, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key]
    if (value == null) continue
    return String(value)
  }
  return ''
}

function readNumber(row: RawRow, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = row[key]
    if (value == null || value === '') continue
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

function readBoolean(row: RawRow, ...keys: string[]): boolean {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
      const text = value.trim().toLowerCase()
      if (['true', '1', 'yes', 'y', 'enabled', 'on'].includes(text)) return true
      if (['false', '0', 'no', 'n', 'disabled', 'off'].includes(text)) return false
    }
    if (typeof value === 'number') return value !== 0
  }
  return false
}

function normalizeQueue(row: RawRow): GovernanceQueueRow {
  return {
    id: readNumber(row, 'id') ?? 0,
    tenantId: readString(row, 'tenantId', 'tenant_id'),
    queueCode: readString(row, 'queueCode', 'queue_code'),
    queueName: readString(row, 'queueName', 'queue_name', 'name'),
    queueType: readString(row, 'queueType', 'queue_type'),
    fairShareGroup: readString(row, 'fairShareGroup', 'fair_share_group'),
    concurrentCap: readNumber(
      row,
      'concurrentCap',
      'concurrent_cap',
      'maxRunningJobs',
      'maxConcurrentJobs',
    ),
    burstLimit: readNumber(row, 'burstLimit', 'burst_limit'),
    enabled: readBoolean(row, 'enabled'),
    updatedAt: readString(row, 'updatedAt', 'updated_at'),
  }
}

function normalizeBatchWindow(row: RawRow): GovernanceBatchWindowRow {
  return {
    id: readNumber(row, 'id') ?? 0,
    tenantId: readString(row, 'tenantId', 'tenant_id'),
    windowCode: readString(row, 'windowCode', 'window_code'),
    windowName: readString(row, 'windowName', 'window_name', 'name'),
    timezone: readString(row, 'timezone', 'timeZone'),
    startTime: readString(row, 'startTime', 'start_time', 'windowStartTime'),
    endTime: readString(row, 'endTime', 'end_time', 'windowEndTime'),
    endStrategy: readString(row, 'endStrategy', 'end_strategy'),
    crossDayPolicy: readString(
      row,
      'crossDayPolicy',
      'cross_day_policy',
      'endStrategy',
      'end_strategy',
    ),
    outOfWindowAction: readString(row, 'outOfWindowAction', 'out_of_window_action'),
    allowCrossDay: readBoolean(row, 'allowCrossDay', 'allow_cross_day'),
    enabled: readBoolean(row, 'enabled'),
    description: readString(row, 'description'),
    updatedAt: readString(row, 'updatedAt', 'updated_at'),
  }
}

function normalizeCalendar(row: RawRow): GovernanceCalendarRow {
  return {
    id: readNumber(row, 'id') ?? 0,
    tenantId: readString(row, 'tenantId', 'tenant_id'),
    calendarCode: readString(row, 'calendarCode', 'calendar_code'),
    calendarName: readString(row, 'calendarName', 'calendar_name', 'name'),
    timezone: readString(row, 'timezone', 'timeZone'),
    enabled: readBoolean(row, 'enabled'),
    updatedAt: readString(row, 'updatedAt', 'updated_at'),
  }
}

function normalizeHoliday(row: RawRow): GovernanceCalendarHolidayRow {
  return {
    id: readNumber(row, 'id', 'holidayId') ?? 0,
    holidayDate: readString(row, 'holidayDate', 'bizDate', 'biz_date'),
    holidayName: readString(row, 'holidayName', 'holiday_name', 'name'),
    holidayType: readString(row, 'holidayType', 'dayType', 'day_type'),
    enabled: readBoolean(row, 'enabled'),
    description: readString(row, 'description'),
  }
}

function normalizeQuotaPolicy(row: RawRow): GovernanceQuotaPolicyRow {
  return {
    id: readNumber(row, 'id') ?? 0,
    tenantId: readString(row, 'tenantId', 'tenant_id'),
    policyCode: readString(row, 'policyCode', 'policy_code'),
    fairShareWeight: readNumber(row, 'fairShareWeight', 'fair_share_weight'),
    maxRunningJobsPerTenant: readNumber(
      row,
      'maxRunningJobsPerTenant',
      'max_running_jobs_per_tenant',
      'concurrentCap',
    ),
    maxPartitionsPerTenant: readNumber(row, 'maxPartitionsPerTenant', 'max_partitions_per_tenant'),
    maxQpsPerTenant: readNumber(row, 'maxQpsPerTenant', 'max_qps_per_tenant', 'qpsLimit'),
    enabled: readBoolean(row, 'enabled'),
    description: readString(row, 'description'),
    updatedAt: readString(row, 'updatedAt', 'updated_at'),
  }
}

function normalizeAlertRouting(row: RawRow): GovernanceAlertRoutingRow {
  return {
    id: readNumber(row, 'id') ?? 0,
    tenantId: readString(row, 'tenantId', 'tenant_id'),
    routeCode: readString(row, 'routeCode', 'route_code'),
    routeName: readString(row, 'routeName', 'route_name'),
    team: readString(row, 'team'),
    alertGroup: readString(row, 'alertGroup', 'alert_group'),
    severity: readString(row, 'severity'),
    receiver: readString(row, 'receiver'),
    groupBy: readString(row, 'groupBy', 'group_by'),
    groupWaitSeconds: readNumber(row, 'groupWaitSeconds', 'group_wait_seconds'),
    groupIntervalSeconds: readNumber(row, 'groupIntervalSeconds', 'group_interval_seconds'),
    repeatIntervalSeconds: readNumber(row, 'repeatIntervalSeconds', 'repeat_interval_seconds'),
    enabled: readBoolean(row, 'enabled'),
    description: readString(row, 'description'),
    updatedAt: readString(row, 'updatedAt', 'updated_at'),
  }
}

async function listGovernanceRows(
  url: string,
  tenantId: string,
  filters: Record<string, string | number | boolean | undefined>,
): Promise<RawRow[]> {
  return fetchAllPageItems<RawRow>(url, {
    tenantId,
    ...filters,
  })
}

export const governanceApi = {
  listQueues: async (
    tenantId: string,
    filters?: { queueCode?: string; queueType?: string; enabled?: boolean },
  ) =>
    (await listGovernanceRows('/api/console/queues', tenantId, filters ?? {})).map(normalizeQueue),

  /** POST /api/console/queues/{id}/toggle — toggle enabled */
  toggleQueue: (id: number, tenantId: string, enabled: boolean) =>
    post<string>(`/api/console/queues/${id}/toggle`, undefined, {
      params: { tenantId, enabled },
    }),

  createQueue: (body: GovernanceQueueSavePayload) =>
    post<RawRow>('/api/console/queues', body).then(normalizeQueue),

  updateQueue: (id: number, body: GovernanceQueueSavePayload) =>
    put<RawRow>(`/api/console/queues/${id}`, body).then(normalizeQueue),

  listBatchWindows: async (
    tenantId: string,
    filters?: { windowCode?: string; enabled?: boolean },
  ) =>
    (await listGovernanceRows('/api/console/batch-windows', tenantId, filters ?? {})).map(
      normalizeBatchWindow,
    ),

  /** POST /api/console/batch-windows/{id}/toggle — toggle enabled */
  toggleBatchWindow: (id: number, tenantId: string, enabled: boolean) =>
    post<string>(`/api/console/batch-windows/${id}/toggle`, undefined, {
      params: { tenantId, enabled },
    }),

  createBatchWindow: (body: GovernanceBatchWindowSavePayload) =>
    post<RawRow>('/api/console/batch-windows', body).then(normalizeBatchWindow),

  updateBatchWindow: (id: number, body: GovernanceBatchWindowSavePayload) =>
    put<RawRow>(`/api/console/batch-windows/${id}`, body).then(normalizeBatchWindow),

  listCalendars: async (tenantId: string, filters?: { calendarCode?: string; enabled?: boolean }) =>
    (await listGovernanceRows('/api/console/calendars', tenantId, filters ?? {})).map(
      normalizeCalendar,
    ),

  /** POST /api/console/calendars/{id}/toggle — toggle enabled */
  toggleCalendar: (id: number, tenantId: string, enabled: boolean) =>
    post<string>(`/api/console/calendars/${id}/toggle`, undefined, {
      params: { tenantId, enabled },
    }),

  createCalendar: (body: GovernanceCalendarSavePayload) =>
    post<RawRow>('/api/console/calendars', body).then(normalizeCalendar),

  updateCalendar: (id: number, body: GovernanceCalendarSavePayload) =>
    put<RawRow>(`/api/console/calendars/${id}`, body).then(normalizeCalendar),

  listCalendarHolidays: async (id: number, tenantId: string) =>
    (
      await get<RawRow[] | { items?: RawRow[] }>(`/api/console/calendars/${id}/holidays`, {
        tenantId,
      }).then((data) => (Array.isArray(data) ? data : (data.items ?? [])))
    ).map(normalizeHoliday),

  createCalendarHoliday: (calendarId: number, body: GovernanceCalendarHolidaySavePayload) =>
    post<void>(`/api/console/calendars/${calendarId}/holidays`, {
      tenantId: body.tenantId,
      items: [
        {
          bizDate: body.bizDate,
          dayType: body.dayType,
          holidayName: body.holidayName,
          description: body.description,
        },
      ],
    }),

  updateCalendarHoliday: (
    calendarId: number,
    holidayId: number,
    body: GovernanceCalendarHolidaySavePayload,
  ) =>
    put<RawRow>(`/api/console/calendars/${calendarId}/holidays/${holidayId}`, body).then(
      normalizeHoliday,
    ),

  listQuotaPolicies: async (
    tenantId: string,
    filters?: { policyCode?: string; enabled?: boolean },
  ) =>
    (await listGovernanceRows('/api/console/quota-policies', tenantId, filters ?? {})).map(
      normalizeQuotaPolicy,
    ),

  /** POST /api/console/quota-policies/{id}/toggle — toggle enabled */
  toggleQuotaPolicy: (id: number, tenantId: string, enabled: boolean) =>
    post<string>(`/api/console/quota-policies/${id}/toggle`, undefined, {
      params: { tenantId, enabled },
    }),

  createQuotaPolicy: (body: GovernanceQuotaPolicySavePayload) =>
    post<RawRow>('/api/console/quota-policies', body).then(normalizeQuotaPolicy),

  updateQuotaPolicy: (id: number, body: GovernanceQuotaPolicySavePayload) =>
    put<RawRow>(`/api/console/quota-policies/${id}`, body).then(normalizeQuotaPolicy),

  listAlertRoutings: async (
    tenantId: string,
    filters?: { routeCode?: string; team?: string; severity?: string; enabled?: boolean },
  ) =>
    (await listGovernanceRows('/api/console/alert-routings', tenantId, filters ?? {})).map(
      normalizeAlertRouting,
    ),

  createAlertRouting: (body: GovernanceAlertRoutingSavePayload) =>
    post<RawRow>('/api/console/alert-routings', body).then(normalizeAlertRouting),

  updateAlertRouting: (id: number, body: GovernanceAlertRoutingSavePayload) =>
    put<RawRow>(`/api/console/alert-routings/${id}`, body).then(normalizeAlertRouting),

  toggleAlertRouting: (id: number, tenantId: string, enabled: boolean) =>
    post<string>(`/api/console/alert-routings/${id}/toggle`, undefined, {
      params: { tenantId, enabled },
    }),

  /** DELETE /api/console/calendars/{id}/holidays/{holidayId} */
  deleteCalendarHoliday: (calendarId: number, holidayId: number, tenantId: string) =>
    del<void>(`/api/console/calendars/${calendarId}/holidays/${holidayId}`, {
      params: { tenantId },
    }),
}
