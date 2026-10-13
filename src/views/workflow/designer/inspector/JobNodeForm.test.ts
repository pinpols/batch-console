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
  ElLoadingDirective: { mounted: vi.fn(), updated: vi.fn(), unmounted: vi.fn() },
  ElButton: {
    name: 'ElButton',
    emits: ['click'],
    template: '<button @click="$emit(\'click\')"><slot /></button>',
  },
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
  ElTag: { name: 'ElTag', template: '<span><slot /></span>' },
  ElSkeleton: { name: 'ElSkeleton', template: '<div class="skeleton" />' },
  ElAlert: { name: 'ElAlert', props: ['title'], template: '<div>{{ title }}</div>' },
  ElPagination: { name: 'ElPagination', template: '<div class="pagination" />' },
}))

vi.mock('@/composables/useJobCodeOptions', async () => {
  const { ref } = await import('vue')
  return {
    useJobCodeOptions: () => ({
      loading: ref(false),
      downstreamLoading: ref(false),
      options: ref(['job-a', 'job-b']),
      load: vi.fn().mockResolvedValue(['job-a', 'job-b']),
      clear: vi.fn(),
    }),
  }
})

vi.mock('@/composables/useJobDefinitionDependencies', async () => {
  const { ref } = await import('vue')
  return {
    useJobDefinitionDependencies: () => ({
      loading: ref(false),
      hasError: ref(false),
      definition: ref(null),
      upstream: ref(null),
      downstream: ref([]),
      downstreamTotal: ref(0),
      downstreamPage: ref(1),
      pageSize: 15,
      load: vi.fn().mockResolvedValue(undefined),
      loadDownstreamPage: vi.fn().mockResolvedValue(undefined),
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
        readonlyTag: '只读',
        jobDependencies: {
          title: '作业依赖概览',
          workflowTitle: '当前流程（可编辑）',
          workflowUpstream: '流程上游',
          workflowDownstream: '流程下游',
          noWorkflowUpstream: '当前流程没有直接上游节点',
          noWorkflowDownstream: '当前流程没有直接下游节点',
          definitionTitle: '作业定义依赖',
          definitionUpstream: '作业定义前置',
          definitionDownstream: '直接依赖此作业的定义（{count}）',
          noDefinitionUpstream: '未配置作业定义前置依赖',
          noDefinitionDownstream: '暂无直接后置作业定义',
          definitionMissing: '当前绑定的作业定义未找到，依赖信息可能不完整。',
          selectJob: '先选择关联作业，即可查看作业定义中的前置与后置依赖。',
          loadError: '作业定义依赖暂时无法加载，请稍后重试。',
        },
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
      enum: { edgeType: { SUCCESS: '成功' } },
      common: { enabled: '已启用', disabled: '已禁用' },
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
    expect(wrapper.text()).toContain('当前流程（可编辑）')
    expect(wrapper.text()).toContain('作业定义依赖')
  })

  it('修改 jobCode → store.updateNode 被调用并标 dirty', async () => {
    const { wrapper, store } = factory(mkNode({ jobCode: '' }))
    const select = wrapper.find('select')
    ;(select.element as HTMLSelectElement).value = 'job-b'
    await select.trigger('change')
    expect(store.nodes[0].attrs?.jobCode).toBe('job-b')
    expect(store.dirty).toBe(true)
  })

  it('同一节点被撤销或重做时刷新本地表单值', async () => {
    const node = mkNode({ jobCode: 'job-a', maxRetries: 1 })
    const { wrapper } = factory(node)

    await wrapper.setProps({
      node: {
        ...node,
        nodeName: 'Restored name',
        attrs: { jobCode: 'job-b', maxRetries: 3 },
      },
    })
    await wrapper.vm.$nextTick()

    const inputs = wrapper.findAll('input')
    expect(inputs.some((input) => input.element.value === 'Restored name')).toBe(true)
    expect(wrapper.find('select').element.value).toBe('job-b')
    expect(inputs.some((input) => input.element.value === '3')).toBe(true)
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

  it('分别显示当前流程中的直接上游和下游节点', async () => {
    const { wrapper, store } = factory(mkNode({ jobCode: 'job-a' }))
    store.nodes.push(
      { ...mkNode(), id: 'upstream', nodeCode: 'upstream', nodeName: '前置作业' },
      { ...mkNode(), id: 'downstream', nodeCode: 'downstream', nodeName: '后置作业' },
    )
    store.edges.push(
      {
        id: 'edge-in',
        source: 'upstream',
        target: 'job-1',
        attrs: { edgeType: 'SUCCESS', enabled: true },
      },
      {
        id: 'edge-out',
        source: 'job-1',
        target: 'downstream',
        attrs: { edgeType: 'SUCCESS', enabled: true },
      },
    )
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('前置作业 (upstream)')
    expect(wrapper.text()).toContain('后置作业 (downstream)')
    expect(wrapper.text()).toContain('成功')
  })

  it('尚未绑定作业时显示配置引导而不是定义缺失警告', () => {
    const { wrapper } = factory(mkNode())

    expect(wrapper.text()).toContain('先选择关联作业，即可查看作业定义中的前置与后置依赖。')
    expect(wrapper.text()).not.toContain('当前绑定的作业定义未找到')
  })
})
