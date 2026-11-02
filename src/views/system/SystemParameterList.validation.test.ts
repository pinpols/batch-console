// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { ElButton, ElForm, ElFormItem, ElInput } from 'element-plus'
import { describe, expect, it, vi } from 'vitest'
import SystemParameterList from './SystemParameterList.vue'

vi.mock('@/api/systemParameters', () => ({
  listSystemParameters: vi.fn().mockResolvedValue([{ paramKey: 'valid.key', paramValue: '123' }]),
  upsertSystemParameter: vi.fn(),
  deleteSystemParameter: vi.fn(),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => ({ tenantId: 'tenant-a' }) }))
vi.mock('@/composables/useTenantReload', () => ({ useTenantReload: (load: () => void) => load() }))
vi.mock('@/composables/useWriteAvailability', async () => {
  const { ref } = await import('vue')
  return {
    useWriteAvailability: () => ({ writesFrozen: ref(false), ensureWriteAvailable: () => true }),
  }
})
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
const slots = { template: '<div><slot /><slot name="actions" /><slot name="query" /></div>' }
const column = defineComponent({
  props: ['label'],
  setup(props, { slots }) {
    return () =>
      props.label === 'systemParameterList.colActions'
        ? h('div', slots.default?.({ row: { key: 'valid.key', value: '123' } }))
        : null
  },
})
const actions = defineComponent({
  props: ['actions'],
  setup(props) {
    return () =>
      h(
        'button',
        { onClick: () => (props.actions as Array<{ onClick: () => void }>)[0].onClick() },
        'edit',
      )
  },
})

describe('SystemParameterList', () => {
  it('关闭无效的新建表单后重新打开或编辑不保留旧校验错误', async () => {
    const wrapper = mount(SystemParameterList, {
      global: {
        components: { ElForm, ElFormItem, ElInput, ElButton },
        stubs: {
          PageContainer: slots,
          PageHeader: slots,
          SectionCard: slots,
          ProTable: slots,
          ListPageQueryBar: slots,
          CopyableText: true,
          RowActions: actions,
          ElTableColumn: column,
          ElDrawer: {
            props: ['modelValue'],
            template: '<div v-show="modelValue"><slot/><slot name="footer"/></div>',
          },
        },
      },
    })
    await flushPromises()
    const button = (text: string) => wrapper.findAll('button').find((node) => node.text() === text)!
    await button('systemParameterList.headerCreate').trigger('click')
    const key = wrapper.find('input[placeholder="systemParameterList.fieldKeyPlaceholder"]')
    await key.setValue('invalid key !')
    await key.trigger('blur')
    await flushPromises()
    expect(wrapper.find('.el-form-item.is-error').exists()).toBe(true)
    await button('common.cancel').trigger('click')
    await button('edit').trigger('click')
    await flushPromises()
    expect(wrapper.find('.el-form-item.is-error').exists()).toBe(false)
    expect((key.element as HTMLInputElement).value).toBe('valid.key')
    await button('common.cancel').trigger('click')
    await button('systemParameterList.headerCreate').trigger('click')
    await key.setValue('invalid key !')
    await key.trigger('blur')
    await flushPromises()
    expect(wrapper.find('.el-form-item.is-error').exists()).toBe(true)
    await button('common.cancel').trigger('click')
    await button('systemParameterList.headerCreate').trigger('click')
    await flushPromises()
    expect(wrapper.find('.el-form-item.is-error').exists()).toBe(false)
    expect((key.element as HTMLInputElement).value).toBe('')
    wrapper.unmount()
  })
})
