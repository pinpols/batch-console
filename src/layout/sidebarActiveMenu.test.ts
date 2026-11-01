import { describe, expect, it } from 'vitest'
import { resolveSidebarActiveMenu } from './sidebarActiveMenu'

const groups = [
  {
    key: 'files',
    children: [
      { path: '/files/list' },
      { path: '/files/templates' },
      { path: '/files/channels', hidden: true },
      { path: '/files/arrival-groups', hidden: true },
    ],
  },
  {
    key: 'monitor',
    children: [{ path: '/monitor/job-instances' }, { path: '/monitor/job-steps', hidden: true }],
  },
  { key: 'workspace', children: [{ path: '/approvals' }, { path: '/approvals?tab=catch-up' }] },
]

describe('sidebar active menu', () => {
  it('highlights a visible parent for hidden destinations', () => {
    expect(resolveSidebarActiveMenu('/files/channels', {}, '/files/channels', groups)).toBe(
      '/files/templates',
    )
    expect(
      resolveSidebarActiveMenu('/files/arrival-groups', {}, '/files/arrival-groups', groups),
    ).toBe('/files/list')
    expect(resolveSidebarActiveMenu('/monitor/job-steps', {}, '/monitor/job-steps', groups)).toBe(
      '/monitor/job-instances',
    )
  })
  it('uses the most specific visible query target and detail parent', () => {
    expect(resolveSidebarActiveMenu('/approvals', { tab: 'catch-up' }, '/approvals', groups)).toBe(
      '/approvals?tab=catch-up',
    )
    expect(
      resolveSidebarActiveMenu('/monitor/job-instances/42', {}, '/monitor/job-instances', groups),
    ).toBe('/monitor/job-instances')
  })
  it('never highlights a parent missing from the permitted sidebar', () => {
    expect(
      resolveSidebarActiveMenu('/files/channels', {}, '/files/channels', [
        { key: 'files', children: [{ path: '/files/channels', hidden: true }] },
      ]),
    ).toBeNull()
  })
})
