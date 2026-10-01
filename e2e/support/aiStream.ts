import type { APIResponse, Response } from '@playwright/test'

type StreamResponse = Pick<APIResponse | Response, 'text'>

export function aiSseEvent(event: string, data: unknown): string {
  return `event:${event}\ndata:${JSON.stringify(data)}\n\n`
}

export async function aiStreamEventData<T>(response: StreamResponse, event: string): Promise<T> {
  const body = (await response.text()).replace(/\r\n/g, '\n')
  const block = body
    .split('\n\n')
    .find((part) => part.split('\n').some((line) => line === `event:${event}`))
  if (!block) throw new Error(`Missing AI SSE event ${event}`)
  const data = block
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5))
    .join('\n')
  return JSON.parse(data) as T
}
