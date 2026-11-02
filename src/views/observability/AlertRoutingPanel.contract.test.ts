// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { ElForm, ElFormItem, ElInput } from 'element-plus'
import { nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import AlertRoutingPanel from './AlertRoutingPanel.vue'

vi.mock('@/stores/tenant', () => ({ useTenantStore: () => ({ tenantId: 'test-tenant' }) }))
vi.mock('@/composables/useTenantChangeGuard', () => ({ useTenantChangeGuard: () => {} }))
vi.mock('@/composables/usePermission', () => ({
  usePermission: () => ({ canMutateConfig: ref(true) }),
}))
vi.mock('@/composables/useTenantReload', () => ({ useTenantReload: () => {} }))
vi.mock('@/composables/useFormFocus', () => ({ useFormFocus: () => {} }))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))

const wrapperSlots = { template: '<div><slot /><slot name="actions" /></div>' }

describe('AlertRoutingPanel contract', () => {
  it('matches save-request boundaries and rejects a blank alert group', async () => {
    const wrapper = mount(AlertRoutingPanel, {
      global: {
        directives: { loading: () => {} },
        components: { ElForm, ElFormItem, ElInput },
        stubs: {
          PageContainer: wrapperSlots,
          PageHeader: wrapperSlots,
          SectionCard: wrapperSlots,
          ListPageQueryBar: true,
          TablePagerBar: true,
          ElTable: true,
          ElAlert: true,
          ElDrawer: {
            props: ['modelValue'],
            template: '<aside v-if="modelValue"><slot /></aside>',
          },
          ElInputNumber: true,
          ElSwitch: true,
          MetaSelect: true,
          ElButton: true,
        },
      },
    })
    ;(wrapper.vm as unknown as { dialogVisible: boolean }).dialogVisible = true
    await nextTick()
    const maxLength = (key: string) =>
      wrapper
        .findAll('.el-form-item')
        .find((item) => item.text().includes(`alertRoutingPanel.${key}`))!
        .get('input, textarea')
        .attributes('maxlength')
    expect(maxLength('fieldRouteName')).toBe('128')
    expect(maxLength('fieldTeam')).toBe('64')
    expect(maxLength('fieldAlertGroup')).toBe('64')
    expect(maxLength('fieldGroupBy')).toBe('128')
    expect(maxLength('descriptionLabel')).toBe('512')
    const form = (wrapper.vm as unknown as { form: Record<string, string> }).form
    Object.assign(form, { routeCode: 'route', team: 'team', alertGroup: '   ', receiver: 'oncall' })
    await nextTick()
    const formComponent = wrapper.findComponent(ElForm)
    await expect(formComponent.vm.validate()).rejects.toBeDefined()
    form.alertGroup = '😀'.repeat(33)
    await nextTick()
    await expect(formComponent.vm.validate()).rejects.toBeDefined()
    form.alertGroup = 'operations'
    await nextTick()
    await expect(formComponent.vm.validate()).resolves.toBe(true)
    wrapper.unmount()
  })
})
