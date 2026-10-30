import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./client', () => ({ get: vi.fn() }))
import { get } from './client'
import { listEventTypes, listKafkaTopics } from './eventCatalog'

describe('event catalogue backend contract', () => {
  beforeEach(() => vi.mocked(get).mockReset())

  it('shows the business event codes returned by the server without inventing alert aliases', async () => {
    vi.mocked(get).mockResolvedValue([
      { code: 'JOB_SUCCESS', description: 'Job succeeded' },
      { code: 'WORKFLOW_FAILED', description: 'Workflow failed' },
    ])
    const rows = await listEventTypes()
    expect(get).toHaveBeenCalledWith('/api/console/event-catalog/event-types')
    expect(rows.map(row => row.eventType)).toEqual(['JOB_SUCCESS', 'WORKFLOW_FAILED'])
  })

  it('maps the independent Job, Workflow and atomic dispatch topics from the server', async () => {
    const topics = ['batch.job.terminal.v1', 'batch.workflow.terminal.v1', 'batch.task.dispatch.atomic']
    vi.mocked(get).mockResolvedValue(topics.map(name => ({ name, description: 'topic description' })))
    const rows = await listKafkaTopics()
    expect(get).toHaveBeenCalledWith('/api/console/event-catalog/topics')
    expect(rows.map(row => row.topic)).toEqual(topics)
  })
})
