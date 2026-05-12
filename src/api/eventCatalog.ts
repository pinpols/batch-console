import { get } from '@/api/client'

type RawCatalogRow = Record<string, unknown>

export interface EventCatalogTypeRow {
  eventType: string
  description: string
  category: string
  schema: string
  code?: string
}

export interface EventCatalogTopicRow {
  topic: string
  description: string
  partitions: string
  replicationFactor: string
  name?: string
}

function readString(row: RawCatalogRow, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key]
    if (value != null && value !== '') return String(value)
  }
  return ''
}

function normalizeEventType(row: RawCatalogRow): EventCatalogTypeRow {
  const eventType = readString(row, 'eventType', 'code', 'event_type')
  return {
    ...row,
    eventType,
    code: readString(row, 'code') || eventType,
    description: readString(row, 'description'),
    category: readString(row, 'category') || '—',
    schema: readString(row, 'schema') || '—',
  }
}

function normalizeTopic(row: RawCatalogRow): EventCatalogTopicRow {
  const topic = readString(row, 'topic', 'name')
  return {
    ...row,
    topic,
    name: readString(row, 'name') || topic,
    description: readString(row, 'description'),
    partitions: readString(row, 'partitions') || '—',
    replicationFactor: readString(row, 'replicationFactor', 'replication_factor') || '—',
  }
}

/** GET /api/console/event-catalog/event-types */
export async function listEventTypes(): Promise<EventCatalogTypeRow[]> {
  const rows = await get<unknown>('/api/console/event-catalog/event-types')
  return Array.isArray(rows) ? (rows as RawCatalogRow[]).map(normalizeEventType) : []
}

/** GET /api/console/event-catalog/topics */
export async function listKafkaTopics(): Promise<EventCatalogTopicRow[]> {
  const rows = await get<unknown>('/api/console/event-catalog/topics')
  return Array.isArray(rows) ? (rows as RawCatalogRow[]).map(normalizeTopic) : []
}
