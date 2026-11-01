// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import CommandPalette from './CommandPalette.vue'

const mocks = vi.hoisted(() => ({
  tenant: { tenantId: '' },
  jobs: vi.fn(),
  workflows: vi.fn(),
  files: vi.fn(),
  push: vi.fn(),
}))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key, te: () => false }) }))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => mocks.tenant }))
vi.mock('@/stores/permission', () => ({
  usePermissionStore: () => ({ canAccessRole: () => true, canAccessPermissions: () => true }),
}))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ hasCapability: () => true }) }))
vi.mock('@/api/instance', () => ({ instanceApi: { list: mocks.jobs } }))
vi.mock('@/api/workflow', () => ({ workflowApi: { listDefinitions: mocks.workflows } }))
vi.mock('@/api/file', () => ({ fileApi: { list: mocks.files } }))
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mocks.push,
    resolve: (raw: string) => {
      const path = raw.split('?')[0]
      const activeMenu = path.startsWith('/monitor/job-instances')
        ? '/monitor/job-instances'
        : path === '/files/channels'
          ? '/files/templates'
          : path
      return { path, matched: [{}], meta: { activeMenu } }
    },
  }),
}))

const groups = [
  {
    key: 'monitor',
    title: 'Monitor',
    icon: { render: () => null },
    children: [{ path: '/monitor/job-instances', title: 'Jobs' }],
  },
]
function render(
  recentTabs: { key: string; path: string; title: string; lastAccessAt: number }[] = [],
) {
  return mount(CommandPalette, {
    props: { modelValue: true, groups, recentTabs },
    global: {
      stubs: {
        ElDialog: { template: '<div><slot name="header"/><slot/><slot name="footer"/></div>' },
      },
    },
  })
}

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.tenant = reactive({ tenantId: 'A' })
    mocks.jobs.mockReset()
    mocks.workflows.mockReset()
    mocks.files.mockReset()
    mocks.push.mockReset()
    mocks.workflows.mockResolvedValue({ records: [] })
    mocks.files.mockResolvedValue({ records: [] })
  })
  afterEach(() => vi.useRealTimers())

  it('discards an in-flight result when the term and tenant change', async () => {
    let resolve!: (value: unknown) => void
    mocks.jobs.mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    const wrapper = render()
    await wrapper.get('input').setValue('old-job')
    await vi.advanceTimersByTimeAsync(300)
    expect(mocks.jobs).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'A' }))
    await wrapper.get('input').setValue('')
    mocks.tenant.tenantId = 'B'
    resolve({
      records: [{ id: 1, instanceNo: 'old-result', jobCode: 'old-job', instanceStatus: 'RUNNING' }],
    })
    await Promise.resolve()
    await Promise.resolve()
    await nextTick()
    expect(wrapper.text()).not.toContain('old-result')
    wrapper.unmount()
  })

  it('filters stale recent paths and direct jumps, and only queries permitted entities', async () => {
    mocks.jobs.mockResolvedValue({ records: [] })
    const wrapper = render([
      { key: 'tenants', path: '/system/tenants', title: 'Private', lastAccessAt: 1 },
    ])
    expect(wrapper.text()).not.toContain('Private')
    await wrapper.get('input').setValue('file:42')
    expect(wrapper.findAll('[role="option"]')).toHaveLength(0)
    await wrapper.get('input').setValue('word')
    await vi.advanceTimersByTimeAsync(300)
    await Promise.resolve()
    await Promise.resolve()
    await nextTick()
    expect(mocks.jobs).toHaveBeenCalledOnce()
    expect(mocks.workflows).not.toHaveBeenCalled()
    expect(mocks.files).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('deduplicates a recent page and exposes keyboard selection', async () => {
    const wrapper = render([
      { key: 'jobs', path: '/monitor/job-instances?status=FAILED', title: 'Jobs', lastAccessAt: 1 },
    ])
    expect(wrapper.findAll('[role="option"]')).toHaveLength(1)
    expect(wrapper.get('input').attributes('aria-activedescendant')).toBe(
      'command-palette-option-0',
    )
    expect(wrapper.get('[role="option"]').attributes('aria-selected')).toBe('true')
    await wrapper.get('input').trigger('keydown.enter')
    await nextTick()
    expect(mocks.push).toHaveBeenCalledWith('/monitor/job-instances?status=FAILED')
    wrapper.unmount()
  })
  it('keeps explicitly allowed routes and details with their parent menu', async () => {
    const wrapper = render([
      { key: 'me', path: '/system/me', title: 'Account', lastAccessAt: 5 },
      { key: 'users', path: '/system/users', title: 'Permissions', lastAccessAt: 4 },
      { key: 'ai', path: '/system/ai-chat', title: 'Assistant', lastAccessAt: 3 },
      { key: 'job', path: '/monitor/job-instances/77', title: 'Job detail', lastAccessAt: 2 },
      { key: 'channel', path: '/files/channels', title: 'Channel', lastAccessAt: 1 },
    ])
    await wrapper.setProps({
      groups: [
        ...groups,
        {
          key: 'files',
          title: 'Files',
          icon: { render: () => null },
          children: [{ path: '/files/templates', title: 'Templates' }],
        },
      ],
    })
    expect(wrapper.text()).toContain('Account')
    expect(wrapper.text()).toContain('Permissions')
    expect(wrapper.text()).toContain('Assistant')
    expect(wrapper.text()).toContain('Job detail')
    expect(wrapper.text()).toContain('Channel')
    wrapper.unmount()
  })
})
