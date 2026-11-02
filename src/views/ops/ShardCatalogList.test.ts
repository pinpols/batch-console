// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { ElInput } from 'element-plus'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ShardCatalogList from './ShardCatalogList.vue'

const api = vi.hoisted(() => ({ list: vi.fn(), save: vi.fn(), remove: vi.fn() }))
vi.mock('@/api/opsManagement', () => ({
  listShardCatalog: api.list,
  upsertShardCatalog: api.save,
  deleteShardCatalog: api.remove,
  PLACEMENT_KEY_PATTERN: /^[a-z0-9-]{1,64}$/,
}))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ hasPermission: () => true }) }))
vi.mock('@/composables/useWriteAvailability', async () => {
  const { ref } = await import('vue')
  return {
    useWriteAvailability: () => ({ writesFrozen: ref(false), ensureWriteAvailable: () => true }),
  }
})
vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('element-plus', async () => {
  const actual = await vi.importActual<typeof import('element-plus')>('element-plus')
  return { ...actual, ElMessage: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }
})

describe('ShardCatalogList', () => {
  beforeEach(() => {
    api.list.mockReset().mockResolvedValue([])
    api.save.mockReset().mockResolvedValue(undefined)
    api.remove.mockReset()
  })

  it('exposes the backend length limits and submits values at those limits', async () => {
    const wrapper = mount(ShardCatalogList, {
      global: {
        components: { ElInput },
        stubs: {
          PageContainer: { template: '<main><slot /></main>' },
          PageHeader: { template: '<header><slot name="actions" /></header>' },
          SectionCard: { template: '<section><slot name="header" /><slot /></section>' },
          ProTable: true,
          HelpLabel: { template: '<span><slot /></span>' },
          ElDrawer: {
            props: ['modelValue'],
            template: '<aside v-if="modelValue"><slot /><slot name="footer" /></aside>',
          },
          ElForm: { template: '<form><slot /></form>' },
          ElFormItem: {
            props: ['label', 'error'],
            template: '<label :data-label="label" :data-error="error"><slot /></label>',
          },
          ElInputNumber: true,
          ElSwitch: true,
          ElButton: { template: '<button type="button"><slot /></button>' },
          ElTag: true,
        },
      },
    })
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'common.create')!
      .trigger('click')
    const key = wrapper.get('[data-label="shardCatalogList.colKey"] input')
    const host = wrapper.get('[data-label="shardCatalogList.fieldHost"] input')
    const save = wrapper.findAll('button').find((button) => button.text() === 'common.save')!
    await save.trigger('click')
    expect(api.save).not.toHaveBeenCalled()
    expect(wrapper.get('[data-label="shardCatalogList.colKey"]').attributes('data-error')).toBe(
      'form.required',
    )
    expect(wrapper.get('[data-label="shardCatalogList.fieldHost"]').attributes('data-error')).toBe(
      'form.required',
    )
    expect(
      wrapper.get('[data-label="shardCatalogList.fieldDbName"]').attributes('data-error'),
    ).toBe('form.required')
    await key.setValue('INVALID_KEY')
    await host.setValue('db-host')
    await wrapper.get('[data-label="shardCatalogList.fieldDbName"] input').setValue('database')
    await save.trigger('click')
    expect(api.save).not.toHaveBeenCalled()
    expect(wrapper.get('[data-label="shardCatalogList.colKey"]').attributes('data-error')).toBe(
      'tenantPlacementList.keyPatternError',
    )
    await key.setValue('shard-a')
    expect(wrapper.get('[data-label="shardCatalogList.colKey"]').attributes('data-error')).toBe('')
    await host.setValue('   ')
    await save.trigger('click')
    expect(api.save).not.toHaveBeenCalled()
    await host.setValue('db-host')
    const dbName = wrapper.get('[data-label="shardCatalogList.fieldDbName"] input')
    await dbName.setValue('   ')
    await save.trigger('click')
    expect(api.save).not.toHaveBeenCalled()
    const secretRef = wrapper.get('[data-label="shardCatalogList.colSecretRef"] input')
    expect(dbName.attributes('maxlength')).toBe('64')
    expect(secretRef.attributes('maxlength')).toBe('128')
    await dbName.setValue('d'.repeat(64))
    await secretRef.setValue('s'.repeat(128))
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'common.save')!
      .trigger('click')
    await flushPromises()
    expect(api.save).toHaveBeenCalledWith(
      expect.objectContaining({ dbName: 'd'.repeat(64), secretRef: 's'.repeat(128) }),
    )
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'common.create')!
      .trigger('click')
    expect(wrapper.get('[data-label="shardCatalogList.colKey"]').attributes('data-error')).toBe('')
    expect(wrapper.get('[data-label="shardCatalogList.fieldHost"]').attributes('data-error')).toBe(
      '',
    )
    expect(
      wrapper.get('[data-label="shardCatalogList.fieldDbName"]').attributes('data-error'),
    ).toBe('')
    await wrapper.get('[data-label="shardCatalogList.colKey"] input').setValue('shard-b')
    await wrapper.get('[data-label="shardCatalogList.fieldHost"] input').setValue('db-host')
    await wrapper.get('[data-label="shardCatalogList.fieldDbName"] input').setValue('database')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'common.save')!
      .trigger('click')
    await flushPromises()
    expect(api.save).toHaveBeenCalledWith(
      expect.objectContaining({
        placementKey: 'shard-b',
        host: 'db-host',
        dbName: 'database',
        secretRef: '',
      }),
    )
    wrapper.unmount()
  })
})
