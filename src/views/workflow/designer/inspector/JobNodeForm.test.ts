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
  ElRadioGroup: { name: 'ElRadioGroup', template: '<div><slot /></div>' },
  ElRadioButton: { name: 'ElRadioButton', template: '<div><slot /></div>' },
  ElSkeleton: { name: 'ElSkeleton', template: '<div class="skeleton" />' },
  ElAlert: { name: 'ElAlert', props: ['title'], template: '<div>{{ title }}</div>' },
  ElPagination: { name: 'ElPagination', template: '<div class="pagination" />' },
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

vi.mock('@/composables/useJobDefinitionDependencies', async () => {
  const { ref } = await import('vue')
  return {
    useJobDefinitionDependencies: () => ({
      loading: ref(false),
      downstreamLoading: ref(false),
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

vi.mock('@/composables/queries/useConsoleMeta', async () => {
  const { ref } = await import('vue')
  return { useMetaWindowsQuery: () => ({ data: ref([{ value: 'NIGHT', label: 'Night' }]) }) }
})

import JobNodeForm from './JobNodeForm.vue'
import StartNodeForm from './StartNodeForm.vue'
import EndNodeForm from './EndNodeForm.vue'
import GatewayNodeForm from './GatewayNodeForm.vue'
import NodeInspector from './NodeInspector.vue'
import { useDesignerStore } from '../store/useDesignerStore'
import type { DesignerNode } from '../types'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'en-US',
  messages: {
    'zh-CN': {
      workflowDesignerSpike: { nodeJob: 'JOB', nodeStart: 'START', nodeEnd: 'END' },
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
          windowCode: '批次窗口',
          windowCodePlaceholder: '选择窗口',
          maxRetries: '失败重试',
          timeoutSeconds: '超时',
          skipExpression: '跳过条件',
          skipExpressionPlaceholder: '',
        },
        validation: { jobCodeRequired: '请配置 jobCode', nodeNameTooLong: '节点名称过长' },
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
  store.setLock({ isMine: true, lockedBy: 'test', expiresAt: '2099-01-01' })
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
    vi.resetAllMocks()
    setActivePinia(createPinia())
  })

  it('同步尚未失焦的名称和跳过表达式，单次撤销恢复并保留选择', async () => {
    const { wrapper, store } = factory(mkNode({ jobCode: 'job-a', skipExpression: 'old' }))
    store.setSelection(['job-1'])
    const inputs = wrapper.findAll('input')
    const name = inputs.find((input) => (input.element as HTMLInputElement).value === 'My Job')!
    const expression = inputs.find((input) => (input.element as HTMLInputElement).value === 'old')!
    await name.setValue('updated name')
    await expression.setValue('new expression')
    const editor = wrapper.vm as unknown as { hasDraft: () => boolean; flushDraft: () => void }
    expect(editor.hasDraft()).toBe(true)
    editor.flushDraft()
    expect(store.nodes[0]).toMatchObject({
      nodeName: 'updated name',
      attrs: { skipExpression: 'new expression' },
    })
    expect([...store.selectedIds]).toEqual(['job-1'])
    expect(editor.hasDraft()).toBe(false)
    editor.flushDraft()
    store.undo()
    expect(store.nodes[0]).toMatchObject({ nodeName: 'My Job', attrs: { skipExpression: 'old' } })
    expect([...store.selectedIds]).toEqual(['job-1'])
  })

  it('JOB 锁丢失后仍报告草稿但不写入，只读恢复后可提交', async () => {
    const { wrapper, store } = factory(mkNode({ jobCode: 'job-a' }))
    const input = wrapper
      .findAll('input')
      .find((field) => (field.element as HTMLInputElement).value === 'My Job')!
    await input.setValue('pending draft')
    await wrapper.setProps({ readonly: true })
    const editor = wrapper.vm as unknown as { hasDraft: () => boolean; flushDraft: () => void }
    expect(editor.hasDraft()).toBe(true)
    editor.flushDraft()
    expect(store.nodes[0]!.nodeName).toBe('My Job')
    expect(store.canUndo).toBe(false)
    await wrapper.setProps({ readonly: false })
    editor.flushDraft()
    expect(store.nodes[0]!.nodeName).toBe('pending draft')
  })

  it('渲染节点 code / name 并展示 jobCode 下拉选项', () => {
    const { wrapper } = factory(mkNode({ jobCode: 'job-a' }))
    const inputs = wrapper.findAll('input')
    expect(inputs.some((i) => (i.element as HTMLInputElement).value === 'job-1')).toBe(true)
    expect(inputs.some((i) => (i.element as HTMLInputElement).value === 'My Job')).toBe(true)
    // jobCode 下拉默认选项渲染出 2 条
    expect(wrapper.findAll('select')[0].findAll('option')).toHaveLength(2)
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

  it('锁状态先于只读属性更新时，已排队的选项变更不写入画布', async () => {
    const { wrapper, store } = factory(mkNode({ jobCode: 'job-a' }))
    store.setLock({ isMine: false, lockedBy: 'other', expiresAt: '2099-01-01' })
    await wrapper.find('select').setValue('job-b')
    expect(store.nodes[0]!.attrs?.jobCode).toBe('job-a')
    expect(store.dirty).toBe(false)
    wrapper.unmount()
  })

  it('修改窗口 → 将执行窗口写入 Job 节点属性', async () => {
    const { wrapper, store } = factory(mkNode({ jobCode: 'job-a' }))
    const selects = wrapper.findAll('select')
    expect(selects).toHaveLength(2)
    ;(selects[1].element as HTMLSelectElement).value = 'NIGHT'
    await selects[1].trigger('change')
    expect(store.nodes[0].attrs?.windowCode).toBe('NIGHT')
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

describe('节点名称长度提示', () => {
  it.each([
    ['START', StartNodeForm],
    ['END', EndNodeForm],
    ['JOB', JobNodeForm],
    ['GATEWAY', GatewayNodeForm],
  ] as const)('%s 节点按 Unicode 字符提示，不截断并仍在失焦时写入', async (nodeType, component) => {
    setActivePinia(createPinia())
    const store = useDesignerStore()
    store.setLock({ isMine: true, lockedBy: 'test', expiresAt: '2099-01-01' })
    const node = { ...mkNode(), nodeType }
    store.nodes.push(node)
    const wrapper = mount(component, {
      props: { node, readonly: false },
      global: { plugins: [i18n] },
    })
    const item = wrapper
      .findAll('.el-form-item')
      .find((field) => field.attributes('data-label') === '节点名称')!
    const input = item.get('input')
    await input.setValue('😀'.repeat(256))
    expect(item.attributes('data-error') || '').toBe('')
    await input.setValue('😀'.repeat(257))
    expect(item.attributes('data-error')).toBe('节点名称过长')
    expect((input.element as HTMLInputElement).value).toBe('😀'.repeat(257))
    expect(store.nodes[0]!.nodeName).toBe('My Job')
    await input.trigger('blur')
    expect(store.nodes[0]!.nodeName).toBe('😀'.repeat(257))
    store.undo()
    expect(store.nodes[0]!.nodeName).toBe('My Job')
    wrapper.unmount()
  })

  it.each([
    ['START', StartNodeForm],
    ['END', EndNodeForm],
    ['GATEWAY', GatewayNodeForm],
  ] as const)('%s 节点无失焦提交名称且重复提交不产生撤销项', async (nodeType, component) => {
    setActivePinia(createPinia())
    const store = useDesignerStore()
    store.setLock({ isMine: true, lockedBy: 'test', expiresAt: '2099-01-01' })
    const node = { ...mkNode(), nodeType }
    store.nodes.push(node)
    const wrapper = mount(component, {
      props: { node, readonly: false },
      global: { plugins: [i18n] },
    })
    const input = wrapper
      .findAll('input')
      .find((field) => (field.element as HTMLInputElement).value === 'My Job')!
    await input.setValue('saved draft')
    const editor = wrapper.vm as unknown as { hasDraft: () => boolean; flushDraft: () => void }
    expect(editor.hasDraft()).toBe(true)
    editor.flushDraft()
    expect(store.nodes[0]!.nodeName).toBe('saved draft')
    expect(editor.hasDraft()).toBe(false)
    editor.flushDraft()
    store.undo()
    expect(store.nodes[0]!.nodeName).toBe('My Job')
    expect(store.canUndo).toBe(false)
    wrapper.unmount()
  })

  it.each([
    ['START', StartNodeForm],
    ['END', EndNodeForm],
    ['GATEWAY', GatewayNodeForm],
  ] as const)('%s 节点锁丢失后保留草稿而不写入', async (nodeType, component) => {
    setActivePinia(createPinia())
    const store = useDesignerStore()
    const node = { ...mkNode(), nodeType }
    store.nodes.push(node)
    const wrapper = mount(component, {
      props: { node, readonly: false },
      global: { plugins: [i18n] },
    })
    const input = wrapper
      .findAll('input')
      .find((field) => (field.element as HTMLInputElement).value === 'My Job')!
    await input.setValue('pending draft')
    await wrapper.setProps({ readonly: true })
    const editor = wrapper.vm as unknown as { hasDraft: () => boolean; flushDraft: () => void }
    expect(editor.hasDraft()).toBe(true)
    editor.flushDraft()
    expect(store.nodes[0]!.nodeName).toBe('My Job')
    expect(store.canUndo).toBe(false)
    wrapper.unmount()
  })
})

describe('NodeInspector 草稿委托', () => {
  it('输入法组合中的草稿在失锁和切换选中项后保留，恢复锁后可提交和撤销', async () => {
    setActivePinia(createPinia())
    const store = useDesignerStore()
    store.nodes.push(mkNode({ jobCode: 'job-a' }), {
      ...mkNode(),
      id: 'job-2',
      nodeCode: 'job-2',
      nodeName: '第二个',
    })
    store.setLock({ isMine: true, lockedBy: 'test', expiresAt: '2099-01-01' })
    store.setSelection(['job-1'])
    const wrapper = mount(NodeInspector, {
      global: { plugins: [i18n], stubs: { DependencyCreateDialog: true } },
    })
    const name = wrapper
      .findAll('input')
      .find((field) => (field.element as HTMLInputElement).value === 'My Job')!
    const el = name.element as HTMLInputElement
    el.value = '组合中的文字'
    el.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }))
    store.setLock({ isMine: false, lockedBy: 'other', expiresAt: '2099-01-01' })
    store.setSelection(['job-2'])
    await wrapper.vm.$nextTick()
    store.setSelection(['job-1'])
    await wrapper.vm.$nextTick()
    expect(
      wrapper
        .findAll('input')
        .some((field) => (field.element as HTMLInputElement).value === '组合中的文字'),
    ).toBe(true)
    expect(store.nodes[0]!.nodeName).toBe('My Job')
    store.setLock({ isMine: true, lockedBy: 'test', expiresAt: '2099-01-01' })
    await wrapper.vm.$nextTick()
    const inspector = wrapper.vm as unknown as { flushDraft: () => void }
    inspector.flushDraft()
    expect(store.nodes[0]!.nodeName).toBe('组合中的文字')
    store.undo()
    expect(store.nodes[0]!.nodeName).toBe('My Job')
    wrapper.unmount()
  })

  it('作用域重置后旧输入事件不能写入同 ID 的新节点', async () => {
    setActivePinia(createPinia())
    const store = useDesignerStore()
    store.reset({ nodes: [mkNode({ jobCode: 'job-a' })], edges: [] })
    store.setMeta({ tenantId: 'old', id: 1 })
    store.setLock({ isMine: true, lockedBy: 'test', expiresAt: '2099-01-01' })
    store.setSelection(['job-1'])
    const wrapper = mount(NodeInspector, {
      global: { plugins: [i18n], stubs: { DependencyCreateDialog: true } },
    })
    const oldInput = wrapper
      .findAll('input')
      .find((field) => (field.element as HTMLInputElement).value === 'My Job')!
      .element as HTMLInputElement
    store.reset({ nodes: [{ ...mkNode(), nodeName: '新租户节点' }], edges: [] })
    store.setMeta({ tenantId: 'new', id: 2 })
    store.setSelection(['job-1'])
    oldInput.value = '迟到旧输入'
    oldInput.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }))
    await wrapper.vm.$nextTick()
    expect(store.inspectorDrafts).toHaveLength(0)
    expect(store.nodes[0]!.nodeName).toBe('新租户节点')
    wrapper.unmount()
  })

  it('数字输入尚未触发 change 时失锁，重选后仍保留并可恢复应用', async () => {
    setActivePinia(createPinia())
    const store = useDesignerStore()
    store.nodes.push(mkNode({ jobCode: 'job-a', maxRetries: 1 }), {
      ...mkNode(),
      id: 'job-2',
      nodeCode: 'job-2',
    })
    store.setLock({ isMine: true, lockedBy: 'test', expiresAt: '2099-01-01' })
    store.setSelection(['job-1'])
    const wrapper = mount(NodeInspector, {
      global: { plugins: [i18n], stubs: { DependencyCreateDialog: true } },
    })
    const number = wrapper.find('input[type="number"]').element as HTMLInputElement
    number.addEventListener('input', (event) => event.stopImmediatePropagation(), {
      capture: true,
      once: true,
    })
    number.value = '3'
    number.dispatchEvent(new InputEvent('input', { bubbles: true }))
    expect(store.getInspectorDraft('nodeMaxRetries', 'job-1')?.value).toBe('3')
    store.setLock({ isMine: false, lockedBy: 'other', expiresAt: '2099-01-01' })
    store.setSelection(['job-2'])
    await wrapper.vm.$nextTick()
    store.setSelection(['job-1'])
    await wrapper.vm.$nextTick()
    expect((wrapper.find('input[type="number"]').element as HTMLInputElement).value).toBe('3')
    expect(store.nodes[0]!.attrs?.maxRetries).toBe(1)
    store.setLock({ isMine: true, lockedBy: 'test', expiresAt: '2099-01-01' })
    await wrapper.vm.$nextTick()
    ;(wrapper.vm as unknown as { flushDraft: () => void }).flushDraft()
    expect(store.nodes[0]!.attrs?.maxRetries).toBe(3)
    wrapper.unmount()
  })

  it('将选中表单的草稿同步到 store，并保留当前选择', async () => {
    setActivePinia(createPinia())
    const store = useDesignerStore()
    store.nodes.push(mkNode({ jobCode: 'job-a' }))
    store.setLock({ isMine: true, lockedBy: 'test', expiresAt: '2099-01-01' })
    store.setSelection(['job-1'])
    const wrapper = mount(NodeInspector, {
      attachTo: document.body,
      global: { plugins: [i18n], stubs: { DependencyCreateDialog: true } },
    })
    const name = wrapper
      .findAll('input')
      .find((field) => (field.element as HTMLInputElement).value === 'My Job')!
    await name.setValue('selected draft')
    const inspector = wrapper.vm as unknown as { hasDraft: () => boolean; flushDraft: () => void }
    expect(inspector.hasDraft()).toBe(true)
    name.element.focus()
    inspector.flushDraft()
    await wrapper.vm.$nextTick()
    expect(store.nodes[0]!.nodeName).toBe('selected draft')
    expect(document.activeElement).toBe(name.element)
    expect([...store.selectedIds]).toEqual(['job-1'])
    wrapper.unmount()
  })

  it('锁丢失后依然报告未失焦草稿，禁止写入只读图', async () => {
    setActivePinia(createPinia())
    const store = useDesignerStore()
    store.nodes.push(mkNode({ jobCode: 'job-a' }))
    store.setLock({ isMine: true, lockedBy: 'test', expiresAt: '2099-01-01' })
    store.setSelection(['job-1'])
    const wrapper = mount(NodeInspector, {
      global: { plugins: [i18n], stubs: { DependencyCreateDialog: true } },
    })
    const input = wrapper
      .findAll('input')
      .find((field) => (field.element as HTMLInputElement).value === 'My Job')!
    await input.setValue('pending draft')
    store.setLock({ isMine: false, lockedBy: 'other', expiresAt: '2099-01-01' })
    await wrapper.vm.$nextTick()
    const inspector = wrapper.vm as unknown as { hasDraft: () => boolean; flushDraft: () => void }
    expect(store.dirty).toBe(false)
    expect(inspector.hasDraft()).toBe(true)
    inspector.flushDraft()
    expect(store.nodes[0]!.nodeName).toBe('My Job')
    expect((input.element as HTMLInputElement).value).toBe('pending draft')
    wrapper.unmount()
  })
})
