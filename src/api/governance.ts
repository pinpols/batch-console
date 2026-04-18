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

export interface GovernanceBatchWindowRow {
  id: number
  tenantId: string
  windowCode: string
  windowName: string
  startTime: string
  endTime: string
  crossDayPolicy: string
  outOfWindowAction: string
  enabled: boolean
  updatedAt: string
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

export interface GovernanceCalendarHolidayRow {
  id: number
  holidayDate: string
  holidayName: string
  holidayType: string
  enabled: boolean
}

export interface GovernanceQuotaPolicyRow {
  id: number
  tenantId: string
  policyCode: string
  policyName: string
  fairShareGroup: string
  fairShareWeight: number | null
  concurrentCap: number | null
  qpsLimit: number | null
  burstLimit: number | null
  slidingWindowHours: number | null
  enabled: boolean
  updatedAt: string
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
    tenantId: readString(row, 'tenantId'),
    queueCode: readString(row, 'queueCode'),
    queueName: readString(row, 'queueName', 'name'),
    queueType: readString(row, 'queueType'),
    fairShareGroup: readString(row, 'fairShareGroup'),
    concurrentCap: readNumber(row, 'concurrentCap', 'maxRunningJobs', 'maxConcurrentJobs'),
    burstLimit: readNumber(row, 'burstLimit'),
    enabled: readBoolean(row, 'enabled'),
    updatedAt: readString(row, 'updatedAt'),
  }
}

function normalizeBatchWindow(row: RawRow): GovernanceBatchWindowRow {
  return {
    id: readNumber(row, 'id') ?? 0,
    tenantId: readString(row, 'tenantId'),
    windowCode: readString(row, 'windowCode'),
    windowName: readString(row, 'windowName', 'name'),
    startTime: readString(row, 'startTime', 'windowStartTime'),
    endTime: readString(row, 'endTime', 'windowEndTime'),
    crossDayPolicy: readString(row, 'crossDayPolicy'),
    outOfWindowAction: readString(row, 'outOfWindowAction'),
    enabled: readBoolean(row, 'enabled'),
    updatedAt: readString(row, 'updatedAt'),
  }
}

function normalizeCalendar(row: RawRow): GovernanceCalendarRow {
  return {
    id: readNumber(row, 'id') ?? 0,
    tenantId: readString(row, 'tenantId'),
    calendarCode: readString(row, 'calendarCode'),
    calendarName: readString(row, 'calendarName', 'name'),
    timezone: readString(row, 'timezone', 'timeZone'),
    enabled: readBoolean(row, 'enabled'),
    updatedAt: readString(row, 'updatedAt'),
  }
}

function normalizeHoliday(row: RawRow): GovernanceCalendarHolidayRow {
  return {
    id: readNumber(row, 'id', 'holidayId') ?? 0,
    holidayDate: readString(row, 'holidayDate'),
    holidayName: readString(row, 'holidayName', 'name'),
    holidayType: readString(row, 'holidayType'),
    enabled: readBoolean(row, 'enabled'),
  }
}

function normalizeQuotaPolicy(row: RawRow): GovernanceQuotaPolicyRow {
  return {
    id: readNumber(row, 'id') ?? 0,
    tenantId: readString(row, 'tenantId'),
    policyCode: readString(row, 'policyCode'),
    policyName: readString(row, 'policyName', 'name'),
    fairShareGroup: readString(row, 'fairShareGroup'),
    fairShareWeight: readNumber(row, 'fairShareWeight'),
    concurrentCap: readNumber(row, 'concurrentCap', 'maxRunningJobsPerTenant'),
    qpsLimit: readNumber(row, 'qpsLimit'),
    burstLimit: readNumber(row, 'burstLimit'),
    slidingWindowHours: readNumber(row, 'slidingWindowHours'),
    enabled: readBoolean(row, 'enabled'),
    updatedAt: readString(row, 'updatedAt'),
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

  /** POST /api/console/queues — create */
  createQueue: (body: object) => post<number>('/api/console/queues', body),

  /** POST /api/console/queues/{id}/toggle — toggle enabled */
  toggleQueue: (id: number, tenantId: string, enabled: boolean) =>
    post<string>(`/api/console/queues/${id}/toggle`, undefined, {
      params: { tenantId, enabled },
    }),

  listBatchWindows: async (
    tenantId: string,
    filters?: { windowCode?: string; enabled?: boolean },
  ) =>
    (await listGovernanceRows('/api/console/batch-windows', tenantId, filters ?? {})).map(
      normalizeBatchWindow,
    ),

  /** POST /api/console/batch-windows — create */
  createBatchWindow: (body: object) => post<number>('/api/console/batch-windows', body),

  /** POST /api/console/batch-windows/{id}/toggle — toggle enabled */
  toggleBatchWindow: (id: number, tenantId: string, enabled: boolean) =>
    post<string>(`/api/console/batch-windows/${id}/toggle`, undefined, {
      params: { tenantId, enabled },
    }),

  listCalendars: async (tenantId: string, filters?: { calendarCode?: string; enabled?: boolean }) =>
    (await listGovernanceRows('/api/console/calendars', tenantId, filters ?? {})).map(
      normalizeCalendar,
    ),

  /** POST /api/console/calendars — create */
  createCalendar: (body: object) => post<number>('/api/console/calendars', body),

  /** POST /api/console/calendars/{id}/toggle — toggle enabled */
  toggleCalendar: (id: number, tenantId: string, enabled: boolean) =>
    post<string>(`/api/console/calendars/${id}/toggle`, undefined, {
      params: { tenantId, enabled },
    }),

  listCalendarHolidays: async (id: number, tenantId: string) =>
    (
      await get<RawRow[] | { items?: RawRow[] }>(`/api/console/calendars/${id}/holidays`, {
        tenantId,
      }).then((data) => (Array.isArray(data) ? data : (data.items ?? [])))
    ).map(normalizeHoliday),

  /** POST /api/console/calendars/{id}/holidays — batch import holidays */
  importCalendarHolidays: (calendarId: number, body: object[]) =>
    post<unknown>(`/api/console/calendars/${calendarId}/holidays`, body),

  listQuotaPolicies: async (
    tenantId: string,
    filters?: { policyCode?: string; enabled?: boolean },
  ) =>
    (await listGovernanceRows('/api/console/quota-policies', tenantId, filters ?? {})).map(
      normalizeQuotaPolicy,
    ),

  /** POST /api/console/quota-policies — create */
  createQuotaPolicy: (body: object) => post<number>('/api/console/quota-policies', body),

  /** POST /api/console/quota-policies/{id}/toggle — toggle enabled */
  toggleQuotaPolicy: (id: number, tenantId: string, enabled: boolean) =>
    post<string>(`/api/console/quota-policies/${id}/toggle`, undefined, {
      params: { tenantId, enabled },
    }),

  /** PUT /api/console/batch-windows/{id} */
  updateBatchWindow: (id: number, body: object) =>
    put<string>(`/api/console/batch-windows/${id}`, body),

  /** PUT /api/console/calendars/{id} */
  updateCalendar: (id: number, body: object) => put<string>(`/api/console/calendars/${id}`, body),

  /** PUT /api/console/calendars/{id}/holidays/{holidayId} */
  updateCalendarHoliday: (calendarId: number, holidayId: number, body: object) =>
    put<string>(`/api/console/calendars/${calendarId}/holidays/${holidayId}`, body),

  /** DELETE /api/console/calendars/{id}/holidays/{holidayId} */
  deleteCalendarHoliday: (calendarId: number, holidayId: number, tenantId: string) =>
    del<void>(`/api/console/calendars/${calendarId}/holidays/${holidayId}`, {
      params: { tenantId },
    }),

  /** PUT /api/console/queues/{id} */
  updateQueue: (id: number, body: object) => put<string>(`/api/console/queues/${id}`, body),

  /** PUT /api/console/quota-policies/{id} */
  updateQuotaPolicy: (id: number, body: object) =>
    put<string>(`/api/console/quota-policies/${id}`, body),
}
