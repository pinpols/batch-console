// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'

// element-plus 子组件 style/css 模块走 .css 副作用,vite-node 在 unit 测试环境
// 不支持 css extension,这里全部 stub 成空模块(不影响 stubs 渲染)
vi.mock('element-plus/es/components/form/style/css', () => ({}))
vi.mock('element-plus/es/components/form-item/style/css', () => ({}))
vi.mock('element-plus/es/components/input/style/css', () => ({}))
vi.mock('element-plus/es/components/select/style/css', () => ({}))
vi.mock('element-plus/es/components/option/style/css', () => ({}))
vi.mock('element-plus/es/components/input-number/style/css', () => ({}))
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('element-plus', () => ({
  ElForm: { name: 'ElForm', template: '<form><slot /></form>' },
  ElFormItem: {
    name: 'ElFormItem',
    props: ['label', 'error', 'required'],
    template:
      '<div class="el-form-item" :data-label="label" :data-error="error" :data-required="required"><slot /></div>',
  },
  ElInput: {
    name: 'ElInput',
    props: ['modelValue', 'readonly', 'placeholder'],
    emits: ['update:modelValue', 'blur'],
    template:
      '<input :value="modelValue" :readonly="readonly" :placeholder="placeholder" @input="$emit(\'update:modelValue\', $event.target.value)" @blur="$emit(\'blur\')" />',
  },
  ElSelect: {
    name: 'ElSelect',
    props: ['modelValue', 'disabled', 'loading', 'placeholder'],
    emits: ['update:modelValue', 'change'],
    template:
      '<select :disabled="disabled" :value="modelValue" @change="$emit(\'change\', $event.target.value); $emit(\'update:modelValue\', $event.target.value)"><slot /></select>',
  },
  ElOption: {
    name: 'ElOption',
    props: ['label', 'value'],
    template: '<option :value="value">{{ label }}</option>',
  },
  ElInputNumber: {
    name: 'ElInputNumber',
    props: ['modelValue', 'min', 'max', 'disabled'],
    emits: ['update:modelValue', 'change'],
    template:
      '<input type="number" :value="modelValue" :min="min" :max="max" :disabled="disabled" @input="$emit(\'change\', Number($event.target.value)); $emit(\'update:modelValue\', Number($event.target.value))" />',
  },
}))

vi.mock('@/composables/useJobCodeOptions', async () => {
  const { ref } = await import('vue')
  return {
    useJobCodeOptions: () => ({
      loading: ref(false),
      options: ref(['job-a', 'job-b']),
      load: vi.fn().mockResolvedValue(['job-a', 'job-b']),
      clear: vi.fn(),
    }),
  }
})

import JobNodeForm from './JobNodeForm.vue'
import { useDesignerStore } from '../store/useDesignerStore'
import type { DesignerNode } from '../types'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'en-US',
  messages: {
    'zh-CN': {
      workflowDesignerSpike: { nodeJob: 'JOB' },
      workflowDesignerMvp: {
        field: {
          nodeType: '节点类型',
          nodeCode: '节点编码',
          nodeName: '节点名称',
          jobCode: '关联 Job',
          jobCodePlaceholder: '选择或输入',
          maxRetries: '失败重试',
          timeoutSeconds: '超时',
          skipExpression: '跳过条件',
          skipExpressionPlaceholder: '',
        },
        validation: { jobCodeRequired: '请配置 jobCode' },
      },
    },
    'en-US': { workflowDesignerSpike: { nodeJob: 'JOB' } },
  },
})

function mkNode(attrs: Record<string, unknown> = {}): DesignerNode {
  return {
    id: 'job-1',
    nodeCode: 'job-1',
    nodeName: 'My Job',
    nodeType: 'JOB',
    x: 0,
    y: 0,
    attrs,
  }
}

function factory(node: DesignerNode, readonly = false) {
  setActivePinia(createPinia())
  const store = useDesignerStore()
  // 注入节点到 store 以便 updateNode 找得到
  store.nodes.push(node)
  store.setMeta({ tenantId: 't1' })
  return {
    store,
    wrapper: mount(JobNodeForm, {
      props: { node, readonly },
      global: { plugins: [i18n] },
    }),
  }
}

describe('JobNodeForm', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('渲染节点 code / name 并展示 jobCode 下拉选项', () => {
    const { wrapper } = factory(mkNode({ jobCode: 'job-a' }))
    const inputs = wrapper.findAll('input')
    expect(inputs.some((i) => (i.element as HTMLInputElement).value === 'job-1')).toBe(true)
    expect(inputs.some((i) => (i.element as HTMLInputElement).value === 'My Job')).toBe(true)
    // jobCode 下拉默认选项渲染出 2 条
    expect(wrapper.findAll('option')).toHaveLength(2)
  })

  it('修改 jobCode → store.updateNode 被调用并标 dirty', async () => {
    const { wrapper, store } = factory(mkNode({ jobCode: '' }))
    const select = wrapper.find('select')
    ;(select.element as HTMLSelectElement).value = 'job-b'
    await select.trigger('change')
    expect(store.nodes[0].attrs?.jobCode).toBe('job-b')
    expect(store.dirty).toBe(true)
  })

  it('校验错误时 jobCode el-form-item 携带 error 文案', async () => {
    const { wrapper, store } = factory(mkNode({}))
    store.setValidationErrors([
      {
        nodeId: 'job-1',
        field: 'jobCode',
        messageKey: 'workflowDesignerMvp.validation.jobCodeRequired',
      },
    ])
    await wrapper.vm.$nextTick()
    const items = wrapper.findAll('.el-form-item')
    const jobItem = items.find((i) => i.attributes('data-label') === '关联 Job')
    expect(jobItem?.attributes('data-error')).toBe('请配置 jobCode')
  })
})
