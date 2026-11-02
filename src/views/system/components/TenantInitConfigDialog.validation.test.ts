// @vitest-environment jsdom
import { mount, flushPromises } from '@vue/test-utils'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { ref } from 'vue'
import ElementPlus, { ElForm } from 'element-plus'
import zhCN from '@/locales/zh-CN'
import TenantInitConfigDialog from './TenantInitConfigDialog.vue'
import { batchInitTenantConfig } from '@/api/ops'

vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ userInfo: { username: 'operator' } }) }))
vi.mock('@/composables/usePermission', () => ({
  usePermission: () => ({ canWriteSystem: ref(true) }),
}))
vi.mock('@/api/ops', () => ({ batchInitTenantConfig: vi.fn() }))

const scrollDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  })
})
afterAll(() => {
  if (scrollDescriptor)
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scrollDescriptor)
  else delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView
})

function render() {
  const i18n = createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': zhCN } })
  return mount(TenantInitConfigDialog, {
    props: { modelValue: true, targetTenantId: 'tenant-a' },
    global: {
      plugins: [i18n, ElementPlus],
      stubs: { ElDrawer: { template: '<div><slot /><slot name="footer" /></div>' } },
    },
  })
}

describe('租户初始化配置提示', () => {
  it('合法对象保持试运行请求及原始内容', async () => {
    vi.mocked(batchInitTenantConfig).mockClear()
    const wrapper = render()
    await wrapper.get('textarea').setValue('{"jobDefinitions":[]}')
    const dryRun = wrapper.findAll('button').find((button) => button.text() === '试运行预览')!
    await dryRun.trigger('click')
    await flushPromises()
    expect(batchInitTenantConfig).toHaveBeenCalledWith({
      targetTenantIds: ['tenant-a'],
      spec: { jobDefinitions: [] },
      configTypes: undefined,
      mode: 'SKIP_EXISTING',
      dryRun: true,
    })
    wrapper.unmount()
  })

  it.each(['[]', 'null', '"text"', '123', '   '])(
    '非对象或空白根值 %s 不允许试运行',
    async (value) => {
      vi.mocked(batchInitTenantConfig).mockClear()
      const wrapper = render()
      await wrapper.get('textarea').setValue(value)
      await flushPromises()
      const isValid = await wrapper
        .getComponent(ElForm)
        .vm.validate()
        .catch(() => false)
      expect(isValid).toBe(false)
      if (!value.trim()) {
        await vi.waitFor(() =>
          expect(wrapper.get('.el-form-item__error').text()).toBe(
            zhCN.tenantInitConfigDialog.ruleSpec,
          ),
        )
      }
      const dryRun = wrapper.findAll('button').find((button) => button.text() === '试运行预览')!
      await dryRun.trigger('click')
      await flushPromises()
      expect(batchInitTenantConfig).not.toHaveBeenCalled()
      wrapper.unmount()
    },
  )

  it('语法错误只显示带定位详情的解析提示，根类型错误有提示，空值显示必填', async () => {
    const wrapper = render()
    const textarea = wrapper.get('textarea')
    await textarea.setValue('{')
    await wrapper
      .getComponent(ElForm)
      .vm.validate()
      .catch(() => false)
    await flushPromises()
    expect(wrapper.text()).toContain('JSON 格式无效：')
    expect(wrapper.findAll('.el-form-item__error')).toHaveLength(0)
    await textarea.setValue('[]')
    await flushPromises()
    expect(wrapper.text()).toContain('期望根是 JSON 对象')
    await textarea.setValue('')
    await wrapper
      .getComponent(ElForm)
      .vm.validate()
      .catch(() => false)
    await flushPromises()
    await vi.waitFor(() =>
      expect(wrapper.get('.el-form-item__error').text()).toBe(zhCN.tenantInitConfigDialog.ruleSpec),
    )
    wrapper.unmount()
  })
})
