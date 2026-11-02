// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ElMessage } from 'element-plus'
import OidcIdentityBindingsDrawer from './OidcIdentityBindingsDrawer.vue'

const state = vi.hoisted(() => ({
  provider: vi.fn(),
  list: vi.fn(),
  bind: vi.fn(),
  unbind: vi.fn(),
  confirm: vi.fn(),
  row: { id: 1, tenantId: 'sample', username: 'operator', subject: 'subject' },
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('element-plus', async (original) => ({
  ...(await original<typeof import('element-plus')>()),
  ElMessage: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('@/api/oidc', () => ({
  getConsoleOidcProvider: state.provider,
  listConsoleOidcIdentities: state.list,
  bindConsoleOidcIdentity: state.bind,
  unbindConsoleOidcIdentity: state.unbind,
}))
vi.mock('@/composables/useDangerConfirm', () => ({ confirmDanger: state.confirm }))

const stubs = {
  ElDrawer: { template: '<div><slot /></div>' },
  ElAlert: true,
  ElForm: { template: '<div><slot /></div>' },
  ElFormItem: { template: '<div><slot /></div>' },
  ElInput: {
    props: ['modelValue'],
    template:
      '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  ElTable: { template: '<div class="identity-table"><slot /></div>' },
  ElTableColumn: { setup: () => ({ row: state.row }), template: '<div><slot :row="row" /></div>' },
  ElButton: {
    inheritAttrs: false,
    template: '<button @click="$emit(\'click\')"><slot /></button>',
  },
  CopyableText: true,
}

describe('身份绑定结果确认', () => {
  beforeEach(() => {
    state.provider.mockReset().mockResolvedValue({ enabled: true })
    state.list.mockReset().mockResolvedValue([state.row])
    state.bind.mockReset().mockRejectedValue(new Error('request failed'))
    state.unbind.mockReset().mockRejectedValue(new Error('request failed'))
    state.confirm.mockReset().mockResolvedValue(undefined)
    vi.mocked(ElMessage.success).mockClear()
    vi.mocked(ElMessage.error).mockClear()
  })

  it('绑定请求失败且回查失败时提示结果未知', async () => {
    state.list.mockResolvedValueOnce([state.row]).mockRejectedValueOnce(new Error('read failed'))
    const wrapper = mount(OidcIdentityBindingsDrawer, {
      props: { modelValue: true, tenantId: 'sample', writesFrozen: false },
      global: { stubs, directives: { loading: () => {} } },
    })
    await flushPromises()
    const inputs = wrapper.findAll('input')
    await inputs[0]!.setValue('another-operator')
    await inputs[1]!.setValue('another-subject')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'oidcIdentityBindings.bind')!
      .trigger('click')
    await flushPromises()
    expect(state.bind).toHaveBeenCalledOnce()
    expect(ElMessage.success).not.toHaveBeenCalled()
    expect(ElMessage.error).toHaveBeenCalledWith('oidcIdentityBindings.bindUnknown')
    expect(wrapper.find('.identity-table').exists()).toBe(false)
    wrapper.unmount()
  })

  it('请求失败且回查失败时不显示解绑已确认', async () => {
    state.list.mockResolvedValueOnce([state.row]).mockRejectedValueOnce(new Error('read failed'))
    const wrapper = mount(OidcIdentityBindingsDrawer, {
      props: { modelValue: true, tenantId: 'sample', writesFrozen: false },
      global: { stubs, directives: { loading: () => {} } },
    })
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'oidcIdentityBindings.unbind')!
      .trigger('click')
    await flushPromises()
    expect(ElMessage.success).not.toHaveBeenCalledWith('oidcIdentityBindings.unbindReconciled')
    expect(ElMessage.error).toHaveBeenCalledWith('oidcIdentityBindings.unbindUnknown')
    expect(wrapper.find('.identity-table').exists()).toBe(false)
    wrapper.unmount()
  })

  it.each([
    { rows: [state.row], message: 'oidcIdentityBindings.unbindError', type: 'error' },
    { rows: [], message: 'oidcIdentityBindings.unbindReconciled', type: 'success' },
  ] as const)('请求失败后按实际回查结果提示 $message', async ({ rows, message, type }) => {
    state.list.mockResolvedValueOnce([state.row]).mockResolvedValueOnce(rows)
    const wrapper = mount(OidcIdentityBindingsDrawer, {
      props: { modelValue: true, tenantId: 'sample', writesFrozen: false },
      global: { stubs, directives: { loading: () => {} } },
    })
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'oidcIdentityBindings.unbind')!
      .trigger('click')
    await flushPromises()
    expect(ElMessage[type]).toHaveBeenCalledWith(message)
    wrapper.unmount()
  })

  it('请求失败后身份提供方停用时不将空列表视为解绑成功', async () => {
    state.provider
      .mockResolvedValueOnce({ enabled: true })
      .mockResolvedValueOnce({ enabled: false })
    const wrapper = mount(OidcIdentityBindingsDrawer, {
      props: { modelValue: true, tenantId: 'sample', writesFrozen: false },
      global: { stubs, directives: { loading: () => {} } },
    })
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'oidcIdentityBindings.unbind')!
      .trigger('click')
    await flushPromises()
    expect(ElMessage.success).not.toHaveBeenCalled()
    expect(ElMessage.error).toHaveBeenCalledWith('oidcIdentityBindings.unbindUnknown')
    wrapper.unmount()
  })
})
