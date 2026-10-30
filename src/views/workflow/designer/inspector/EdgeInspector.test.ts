// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('element-plus/es/components/form/style/css', () => ({}))
vi.mock('element-plus/es/components/form-item/style/css', () => ({}))
vi.mock('element-plus/es/components/input/style/css', () => ({}))
vi.mock('element-plus/es/components/select/style/css', () => ({}))
vi.mock('element-plus/es/components/option/style/css', () => ({}))
vi.mock('element-plus/es/components/switch/style/css', () => ({}))

vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), warning: vi.fn() },
  ElForm: { name: 'ElForm', template: '<form><slot /></form>' },
  ElFormItem: {
    name: 'ElFormItem',
    props: ['label', 'error', 'required'],
    template:
      '<div class="el-form-item" :data-label="label" :data-error="error" :data-required="required"><slot /></div>',
  },
  ElInput: {
    name: 'ElInput',
    props: ['modelValue', 'readonly', 'placeholder', 'type'],
    emits: ['update:modelValue', 'blur'],
    template:
      '<textarea v-if="type === \'textarea\'" :value="modelValue" :readonly="readonly" :placeholder="placeholder" @input="$emit(\'update:modelValue\', $event.target.value)" @blur="$emit(\'blur\')" />' +
      '<input v-else :value="modelValue" :readonly="readonly" :placeholder="placeholder" />',
  },
  ElSelect: {
    name: 'ElSelect',
    props: ['modelValue', 'disabled'],
    emits: ['update:modelValue', 'change'],
    template:
      '<select :disabled="disabled" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value); $emit(\'change\', $event.target.value)"><slot /></select>',
  },
  ElOption: {
    name: 'ElOption',
    props: ['label', 'value'],
    template: '<option :value="value">{{ label }}</option>',
  },
  ElSwitch: {
    name: 'ElSwitch',
    props: ['modelValue', 'disabled'],
    emits: ['update:modelValue', 'change'],
    template:
      '<input class="switch" type="checkbox" :checked="modelValue" :disabled="disabled" @change="$emit(\'update:modelValue\', $event.target.checked); $emit(\'change\', $event.target.checked)" />',
  },
  ElButton: {
    name: 'ElButton',
    props: ['disabled', 'type', 'plain'],
    emits: ['click'],
    template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
}))

import EdgeInspector from './EdgeInspector.vue'
import { useDesignerStore } from '../store/useDesignerStore'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: {
    'zh-CN': {
      enum: {
        edgeType: { SUCCESS: '成功', FAILURE: '失败', CONDITION: '条件', ALWAYS: '总是' },
      },
      workflowDesignerMvp: {
        field: {
          edgeSource: '上游节点',
          edgeTarget: '下游节点',
          edgeType: '连线类型',
          conditionExpr: '条件表达式',
          conditionExprPlaceholder: '如 status == "READY"',
          edgeEnabled: '启用',
        },
        edgeTypeDescription: {
          SUCCESS: '成功说明',
          FAILURE: '失败说明',
          CONDITION: '条件说明',
          ALWAYS: '始终说明',
        },
        conditionExprHelp: '直接引用 sourcePayload 字段',
        disabledEdgeHint: '禁用后不参与运行',
        dependency: {
          updated: '依赖已更新',
          deleted: '依赖已删除',
          deleteAction: '删除依赖',
          invalidEndpoint: '端点不合法',
          duplicate: '依赖重复',
          cycle: '不能成环',
        },
        validation: {
          conditionExprRequired: '条件连线 {source} → {target} 必须配置表达式',
          conditionExprTemplateWrapper: '不支持模板包裹',
        },
      },
    },
  },
})

function factory() {
  setActivePinia(createPinia())
  const store = useDesignerStore()
  store.reset({
    nodes: [
      {
        id: 'source',
        nodeCode: 'source',
        nodeName: '清洗数据',
        nodeType: 'JOB',
        x: 0,
        y: 0,
      },
      {
        id: 'target',
        nodeCode: 'target',
        nodeName: '生成报表',
        nodeType: 'JOB',
        x: 0,
        y: 120,
      },
    ],
    edges: [
      {
        id: 'edge-1',
        source: 'source',
        target: 'target',
        attrs: { edgeType: 'SUCCESS', enabled: true },
      },
    ],
  })
  const wrapper = mount(EdgeInspector, {
    props: { edge: store.edges[0]!, readonly: false },
    global: { plugins: [i18n] },
  })
  return { store, wrapper }
}

describe('EdgeInspector', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setActivePinia(createPinia())
  })

  it('明确展示上下游节点和当前触发语义', () => {
    const { wrapper } = factory()
    const selectValues = wrapper
      .findAll('select')
      .map((select) => (select.element as HTMLSelectElement).value)
    expect(selectValues).toEqual(['source', 'target', 'SUCCESS'])
    expect(wrapper.text()).toContain('清洗数据 (source)')
    expect(wrapper.text()).toContain('生成报表 (target)')
    expect(wrapper.text()).toContain('成功说明')
  })

  it('CONDITION 边即时提示必填并把表达式写回 store', async () => {
    const { store, wrapper } = factory()
    await wrapper.findAll('select')[2]!.setValue('CONDITION')

    const conditionItem = wrapper
      .findAll('.el-form-item')
      .find((item) => item.attributes('data-label') === '条件表达式')
    expect(conditionItem?.attributes('data-error')).toContain('source → target')

    await wrapper.find('textarea').setValue('amount > 1000')
    await wrapper.find('textarea').trigger('blur')
    expect(store.edges[0]).toMatchObject({
      label: 'amount > 1000',
      attrs: { edgeType: 'CONDITION', enabled: true },
    })
  })

  it('禁用连线时保存状态并显示运行影响', async () => {
    const { store, wrapper } = factory()
    await wrapper.find('input.switch').setValue(false)
    expect(store.edges[0].attrs?.enabled).toBe(false)
    expect(wrapper.text()).toContain('禁用后不参与运行')
  })

  it('CONDITION 边拒绝运行时不支持的模板包裹', async () => {
    const { wrapper } = factory()
    await wrapper.findAll('select')[2]!.setValue('CONDITION')
    await wrapper.find('textarea').setValue('${bizDate != null}')

    const conditionItem = wrapper
      .findAll('.el-form-item')
      .find((item) => item.attributes('data-label') === '条件表达式')
    expect(conditionItem?.attributes('data-error')).toBe('不支持模板包裹')
  })
})
