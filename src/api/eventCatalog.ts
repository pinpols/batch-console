import { get } from '@/api/client'

/** GET /api/console/event-catalog/event-types */
export function listEventTypes() {
  return get<unknown>('/api/console/event-catalog/event-types')
}

/** GET /api/console/event-catalog/topics */
export function listKafkaTopics() {
  return get<unknown>('/api/console/event-catalog/topics')
}
