// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getClusterDiagnostic, getWorkerConsistency } from '@/api/clusterDiagnostic'
import { getKafkaLag, getOutboxStats, republishOutbox } from '@/api/ops'
import { useTenantStore } from '@/stores/tenant'
import zhCN from '@/locales/zh-CN'
import OpsDiagnostic from './OpsDiagnostic.vue'

vi.mock('@/stores/tenant', async () => {
  const { reactive } = await import('vue')
  const state = reactive({ tenantId: 'tenant-a' })
  return { useTenantStore: () => state }
})
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ role: 'ADMIN', hasPermission: () => true }),
}))
vi.mock('@/composables/useWriteAvailability', () => ({
  useWriteAvailability: () => ({
    writesFrozen: ref(false),
    disabledReason: ref(''),
    ensureWriteAvailable: () => true,
  }),
}))
vi.mock('@/api/ops', () => ({
  getKafkaLag: vi.fn().mockResolvedValue([]),
  getOutboxStats: vi.fn().mockResolvedValue({}),
  cleanupOutbox: vi.fn(),
  republishOutbox: vi.fn(),
}))
vi.mock('@/api/clusterDiagnostic', () => ({
  getClusterDiagnostic: vi.fn().mockResolvedValue({}),
  getShedLockStatus: vi.fn().mockResolvedValue({
    totalLocks: 2,
    activeLocks: 1,
    locks: [
      { name: 'active-lock', lockUntil: '2030-01-01T00:00:00Z', lockedBy: 'worker-1' },
      { name: 'expired-lock', lockUntil: '2020-01-01T00:00:00Z', lockedBy: 'worker-2' },
    ],
  }),
  getWorkerConsistency: vi.fn().mockResolvedValue({}),
  getOutboxHealth: vi.fn().mockResolvedValue({}),
  getTerminalChildrenHealth: vi.fn().mockResolvedValue({}),
}))
vi.mock('@/api/forensic', () => ({
  requestForensicExport: vi.fn(),
  downloadForensicExport: vi.fn(),
}))

enableAutoUnmount(afterEach)
const slotStub = { template: '<div><slot name="actions" /><slot /></div>' }

function renderPage() {
  return mount(OpsDiagnostic, {
    global: {
      plugins: [createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': zhCN } })],
      directives: { 'track-click': () => {} },
      stubs: {
        PageContainer: slotStub,
        PageHeader: slotStub,
        ElCollapseTransition: slotStub,
        ElButton: {
          props: ['disabled'],
          template: '<button :disabled="disabled"><slot /></button>',
        },
        ElTag: slotStub,
        ElTooltip: slotStub,
        ElIcon: slotStub,
        JsonPreview: {
          props: ['data'],
          template: '<div class="json-preview"><slot name="summary" :data="data" /></div>',
        },
      },
    },
  })
}

describe('运维诊断结果', () => {
  it.each([
    ['PUBLISHED', true, false],
    ['GIVE_UP', true, true],
    ['FAILED', false, true],
    ['NEW', false, false],
  ])('依据 %s 状态启用符合后端契约的补救按钮', async (status, cleanupEnabled, republishEnabled) => {
    vi.mocked(getOutboxStats).mockResolvedValueOnce({
      tenantId: 'tenant-a',
      statusBreakdown: [{ publishStatus: status, count: 3 }],
    })
    const wrapper = renderPage()
    await flushPromises()
    const card = wrapper.find('.diag-card--danger')
    const cleanup = card.findAll('button').find((button) => button.text() === '清理')!
    const republish = card.findAll('button').find((button) => button.text() === '重发布')!
    expect(cleanup.element.disabled).toBe(!cleanupEnabled)
    expect(republish.element.disabled).toBe(!republishEnabled)
  })

  it('将接口对象中的锁明细展示为表格', async () => {
    const wrapper = renderPage()
    await flushPromises()

    const card = wrapper
      .findAll('.diag-card')
      .find((item) => item.text().includes('数据库调度锁状态'))!
    expect(card.find('table').exists()).toBe(true)
    expect(card.findAll('tbody tr').map((row) => row.text())).toEqual([
      'active-lock2030-01-01T00:00:00Zworker-1',
      'expired-lock2020-01-01T00:00:00Zworker-2',
    ])
  })

  it('将数值型非法标签计数显示为异常，不报告一致', async () => {
    const workers = { onlineWorkers: 1, invalidCapabilityTags: 3, healthy: false }
    vi.mocked(getWorkerConsistency).mockResolvedValueOnce(workers)
    vi.mocked(getClusterDiagnostic).mockResolvedValueOnce({ workers })
    const wrapper = renderPage()
    await flushPromises()

    const workerCard = wrapper
      .findAll('.diag-card')
      .find((item) => item.text().includes('Worker 一致性'))!
    const clusterCard = wrapper
      .findAll('.diag-card')
      .find((item) => item.text().includes('集群概览'))!
    expect(workerCard.text()).toContain('非法 tag 3')
    expect(workerCard.text()).not.toContain('一致性 ✓')
    expect(clusterCard.text()).toContain('异常 3')
    expect(workerCard.text()).not.toContain('opsDiagnostic.')
    expect(clusterCard.text()).not.toContain('opsDiagnostic.')
  })

  it('没有非法标签和其他异常时保持一致性提示', async () => {
    vi.mocked(getWorkerConsistency).mockResolvedValueOnce({
      onlineWorkers: 1,
      invalidCapabilityTags: 0,
      healthy: true,
    })
    const wrapper = renderPage()
    await flushPromises()
    const workerCard = wrapper
      .findAll('.diag-card')
      .find((item) => item.text().includes('Worker 一致性'))!
    expect(workerCard.text()).toContain('一致性 ✓')
    expect(workerCard.text()).not.toContain('非法 tag')
  })

  it('运行实例存在但没有在线 Worker 时显示异常', async () => {
    const workers = { onlineWorkers: 0, runningInstances: 2, healthy: false }
    vi.mocked(getWorkerConsistency).mockResolvedValueOnce(workers)
    vi.mocked(getClusterDiagnostic).mockResolvedValueOnce({ workers })
    const wrapper = renderPage()
    await flushPromises()
    const workerCard = wrapper
      .findAll('.diag-card')
      .find((item) => item.text().includes('Worker 一致性'))!
    const clusterCard = wrapper
      .findAll('.diag-card')
      .find((item) => item.text().includes('集群概览'))!
    expect(workerCard.text()).toContain('无在线 Worker，仍有运行实例')
    expect(workerCard.text()).not.toContain('一致性 ✓')
    expect(clusterCard.text()).toContain('无在线 Worker，仍有运行实例')
  })

  it('没有在线 Worker 且没有运行实例时不显示缺员异常', async () => {
    vi.mocked(getWorkerConsistency).mockResolvedValueOnce({
      onlineWorkers: 0,
      runningInstances: 0,
      healthy: true,
    })
    const wrapper = renderPage()
    await flushPromises()
    const workerCard = wrapper
      .findAll('.diag-card')
      .find((item) => item.text().includes('Worker 一致性'))!
    expect(workerCard.text()).toContain('一致性 ✓')
    expect(workerCard.text()).not.toContain('无在线 Worker，仍有运行实例')
  })

  it('按实际发布状态统计待发、失败和放弃的事件', async () => {
    vi.mocked(getOutboxStats).mockResolvedValueOnce({
      tenantId: 'tenant-a',
      statusBreakdown: [
        { publishStatus: 'NEW', count: 2 },
        { publishStatus: 'PUBLISHING', count: 1 },
        { publishStatus: 'FAILED', count: 4 },
        { publishStatus: 'GIVE_UP', count: 1 },
        { publishStatus: 'PUBLISHED', count: 5 },
      ],
    })
    const wrapper = renderPage()
    await flushPromises()
    const card = wrapper.findAll('.diag-card').find((item) => item.text().includes('Outbox 统计'))!
    expect(card.text()).toContain('共 13 条')
    expect(card.text()).toContain('待发/发送中 3')
    expect(card.text()).toContain('失败/放弃 5')
  })

  it('已发布事件不计入待发或失败', async () => {
    vi.mocked(getOutboxStats).mockResolvedValueOnce({
      statusBreakdown: [{ publishStatus: 'PUBLISHED', count: 5 }],
    })
    const wrapper = renderPage()
    await flushPromises()
    const card = wrapper.findAll('.diag-card').find((item) => item.text().includes('Outbox 统计'))!
    expect(card.text()).toContain('共 5 条')
    expect(card.text()).toContain('待发/发送中 0')
    expect(card.text()).toContain('失败/放弃 0')
  })

  it('Kafka 查询失败或结果缺失时不显示零积压', async () => {
    vi.mocked(getKafkaLag).mockResolvedValueOnce([
      { groupId: 'ok-group', totalLag: 0, partitionCount: 2 },
      { groupId: 'failed-group', error: 'access denied' },
      { groupId: 'unknown-group' },
    ])
    const wrapper = renderPage()
    await flushPromises()
    const card = wrapper.findAll('.diag-card').find((item) => item.text().includes('Kafka Lag'))!
    const rows = card.findAll('tbody tr')
    expect(rows).toHaveLength(3)
    expect(rows[0].text()).toContain('ok-group02')
    expect(rows[1].text()).toContain('access denied')
    expect(rows[1].find('.lag-ok').exists()).toBe(false)
    expect(rows[2].text()).toContain('数据不可用')
    expect(rows[2].find('.lag-ok').exists()).toBe(false)
  })

  it('切换租户后立即清除旧统计并禁用补救操作', async () => {
    const tenant = useTenantStore()
    vi.mocked(getOutboxStats).mockImplementation((tenantId) => {
      if (tenantId === 'tenant-a') {
        return Promise.resolve({ statusBreakdown: [{ publishStatus: 'PUBLISHED', count: 5 }] })
      }
      return new Promise(() => {})
    })
    const wrapper = renderPage()
    await flushPromises()
    const card = wrapper.find('.diag-card--danger')
    const cleanup = card.findAll('button').find((button) => button.text() === '清理')!
    expect(cleanup.element.disabled).toBe(false)
    tenant.tenantId = 'tenant-b'
    await wrapper.vm.$nextTick()
    expect(getOutboxStats).toHaveBeenCalledWith('tenant-b')
    expect(cleanup.element.disabled).toBe(true)
    expect(wrapper.text()).not.toContain('共 5 条')
    wrapper.unmount()
    tenant.tenantId = 'tenant-a'
    vi.mocked(getOutboxStats).mockReset().mockResolvedValue({})
  })

  it('输入重投事件期间切换租户，即使切回也不发起请求', async () => {
    const tenant = useTenantStore()
    vi.mocked(getOutboxStats).mockResolvedValueOnce({
      statusBreakdown: [{ publishStatus: 'FAILED', count: 1 }],
    })
    let resolvePrompt!: (value: { value: string; action: 'confirm' }) => void
    const prompt = vi.spyOn(ElMessageBox, 'prompt').mockImplementation(
      () =>
        new Promise<{ value: string; action: 'confirm' }>((resolve) => {
          resolvePrompt = resolve
        }) as unknown as ReturnType<typeof ElMessageBox.prompt>,
    )
    try {
      const wrapper = renderPage()
      await flushPromises()
      const republish = wrapper
        .find('.diag-card--danger')
        .findAll('button')
        .find((button) => button.text() === '重发布')!
      await republish.trigger('click')
      expect(prompt).toHaveBeenCalledOnce()
      tenant.tenantId = 'tenant-b'
      tenant.tenantId = 'tenant-a'
      resolvePrompt({ value: '123', action: 'confirm' })
      await flushPromises()
      expect(republishOutbox).not.toHaveBeenCalled()
      wrapper.unmount()
    } finally {
      tenant.tenantId = 'tenant-a'
      prompt.mockRestore()
    }
  })

  it.each([
    [0, 'warning', '请求 2 条，实际重置 0 条'],
    [1, 'warning', '请求 2 条，实际重置 1 条'],
    [2, 'success', '已重置 2 条事件，等待重新投递'],
  ] as const)('重投结果为 %i 时按实际重置数量提示', async (resetCount, level, expected) => {
    vi.mocked(getOutboxStats).mockResolvedValueOnce({
      statusBreakdown: [{ publishStatus: 'FAILED', count: 2 }],
    })
    vi.mocked(republishOutbox).mockResolvedValueOnce({
      tenantId: 'tenant-a',
      requestedCount: 2,
      resetCount,
    })
    const prompt = vi
      .spyOn(ElMessageBox, 'prompt')
      .mockResolvedValueOnce({ value: '1,2', action: 'confirm' } as never)
    const message = vi.spyOn(ElMessage, level).mockImplementation(() => undefined as never)
    try {
      const wrapper = renderPage()
      await flushPromises()
      const button = wrapper
        .find('.diag-card--danger')
        .findAll('button')
        .find((item) => item.text() === '重发布')!
      await button.trigger('click')
      await flushPromises()
      expect(republishOutbox).toHaveBeenCalledWith('tenant-a', ['1', '2'])
      expect(message).toHaveBeenCalledWith(expected)
    } finally {
      prompt.mockRestore()
      message.mockRestore()
      vi.mocked(republishOutbox).mockClear()
    }
  })

  it.each(['1,9223372036854775808', '1,0'])('重投 ID %s 无效时拒绝整次请求', async (input) => {
    vi.mocked(getOutboxStats).mockResolvedValueOnce({
      statusBreakdown: [{ publishStatus: 'FAILED', count: 2 }],
    })
    const prompt = vi
      .spyOn(ElMessageBox, 'prompt')
      .mockResolvedValueOnce({ value: input, action: 'confirm' } as never)
    const warning = vi.spyOn(ElMessage, 'warning').mockImplementation(() => undefined as never)
    try {
      const wrapper = renderPage()
      await flushPromises()
      const button = wrapper
        .find('.diag-card--danger')
        .findAll('button')
        .find((item) => item.text() === '重发布')!
      await button.trigger('click')
      await flushPromises()
      expect(republishOutbox).not.toHaveBeenCalled()
      expect(warning).toHaveBeenCalled()
    } finally {
      prompt.mockRestore()
      warning.mockRestore()
      vi.mocked(republishOutbox).mockClear()
    }
  })

  it('重投大于安全整数的有效 Long ID 时保留原始精度', async () => {
    vi.mocked(getOutboxStats).mockResolvedValueOnce({
      statusBreakdown: [{ publishStatus: 'FAILED', count: 2 }],
    })
    vi.mocked(republishOutbox).mockResolvedValueOnce({
      tenantId: 'tenant-a',
      requestedCount: 2,
      resetCount: 2,
    })
    const prompt = vi.spyOn(ElMessageBox, 'prompt').mockResolvedValueOnce({
      value: '9007199254740993,9223372036854775807',
      action: 'confirm',
    } as never)
    const success = vi.spyOn(ElMessage, 'success').mockImplementation(() => undefined as never)
    try {
      const wrapper = renderPage()
      await flushPromises()
      const button = wrapper
        .find('.diag-card--danger')
        .findAll('button')
        .find((item) => item.text() === '重发布')!
      await button.trigger('click')
      await flushPromises()
      expect(republishOutbox).toHaveBeenCalledWith('tenant-a', [
        '9007199254740993',
        '9223372036854775807',
      ])
    } finally {
      prompt.mockRestore()
      success.mockRestore()
      vi.mocked(republishOutbox).mockClear()
    }
  })
})
