import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import type { components } from '@/types/api.generated'

vi.mock('./client', () => ({ get: vi.fn(), put: vi.fn(), del: vi.fn() }))

import { get, put } from './client'
import { workflowDesignerApi, type WorkflowDefinitionFullUpdateRequest } from './workflowDesigner'

const mockedPut = vi.mocked(put)
const mockedGet = vi.mocked(get)
const request: WorkflowDefinitionFullUpdateRequest = {
  definition: {
    tenantId: 'tenant-a',
    workflowCode: 'WF_DAILY',
    workflowName: 'Daily',
    workflowType: 'DAG',
    enabled: true,
    nodes: [
      { nodeCode: 'START', nodeName: 'Start', nodeType: 'START' },
      { nodeCode: 'JOB', nodeName: 'Import', nodeType: 'JOB', relatedJobCode: 'IMPORT_ORDERS' },
      { nodeCode: 'END', nodeName: 'End', nodeType: 'END' },
    ],
    edges: [
      { fromNodeCode: 'START', toNodeCode: 'JOB', edgeType: 'ALWAYS' },
      { fromNodeCode: 'JOB', toNodeCode: 'END', edgeType: 'SUCCESS' },
    ],
  },
  expectedVersion: 3,
}

describe('Workflow designer version contract', () => {
  beforeEach(() => {
    mockedPut.mockReset()
    mockedGet.mockReset()
  })

  it('requires the expected version in the generated request contract', () => {
    expectTypeOf<
      components['schemas']['WorkflowDefinitionFullUpdateRequest']['expectedVersion']
    >().toEqualTypeOf<number>()
  })

  it('sends the original version and definition in one full-update request', async () => {
    const saved = { id: 7, version: 4 }
    mockedPut.mockResolvedValue(saved)

    await expect(workflowDesignerApi.putFull(7, request)).resolves.toEqual(saved)

    expect(mockedPut).toHaveBeenCalledExactlyOnceWith(
      '/api/console/workflow-definitions/7/full',
      request,
    )
  })

  it('propagates a version conflict without retrying an unconditional write', async () => {
    const conflict = new Error('version conflict')
    mockedPut.mockRejectedValue(conflict)

    await expect(workflowDesignerApi.putFull(7, request)).rejects.toBe(conflict)

    expect(mockedPut).toHaveBeenCalledExactlyOnceWith(
      '/api/console/workflow-definitions/7/full',
      request,
    )
  })

  it('lists persisted version summaries for the selected tenant', async () => {
    const versions = [
      { version: 4, savedBy: 'admin', savedAt: '2026-10-25T10:00:00Z', summary: null, current: true },
      { version: 3, savedBy: 'operator', savedAt: '2026-10-24T10:00:00Z', summary: null, current: false },
    ]
    mockedGet.mockResolvedValue(versions)

    await expect(workflowDesignerApi.listVersions(7, 'tenant-a')).resolves.toEqual(versions)
    expect(mockedGet).toHaveBeenCalledWith('/api/console/workflow-definitions/7/versions', {
      tenantId: 'tenant-a',
    })
  })
})
