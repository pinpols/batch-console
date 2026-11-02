// @vitest-environment jsdom
/**
 * JsonSyncPanel 的 3 个场景：
 * - 画布变更 → JSON textarea 文本同步更新
 * - JSON textarea 改 → blur 后画布(store.nodes/edges)同步更新
 * - JSON 非法 → 显示 parseError 提示,画布不破坏
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { ElMessageBox } from 'element-plus'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'

import JsonSyncPanel from './JsonSyncPanel.vue'
import { useDesignerStore } from '../store/useDesignerStore'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'en-US',
  messages: {
    'zh-CN': {
      workflowDesignerJson: {
        toolbarButton: 'JSON',
        panelTitle: 'JSON 同步',
        placeholder: '编辑…',
        parseError: 'JSON 解析失败:{msg}',
        parseShapeError: 'JSON 结构非法',
        applyTooltip: '500ms 自动应用',
      },
    },
    'en-US': {
      workflowDesignerJson: {
        toolbarButton: 'JSON',
        panelTitle: 'JSON sync',
        placeholder: 'Edit…',
        parseError: 'JSON parse error: {msg}',
        parseShapeError: 'Invalid JSON shape',
        applyTooltip: '500ms auto apply',
      },
    },
  },
})

function factory(collapsed = false, readonly = false) {
  setActivePinia(createPinia())
  const store = useDesignerStore()
  store.setLock({ isMine: true, lockedBy: 'test', expiresAt: '2099-01-01' })
  const wrapper = mount(JsonSyncPanel, {
    props: { collapsed, readonly },
    global: { plugins: [i18n] },
  })
  return { store, wrapper }
}

describe('JsonSyncPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('画布变更 → JSON textarea 文本同步更新', async () => {
    const { store, wrapper } = factory(false)
    await nextTick()
    // 初始 empty JSON
    const ta0 = wrapper.find('textarea').element as HTMLTextAreaElement
    expect(ta0.value).toContain('"nodes"')
    expect(ta0.value).toContain('"edges"')

    store.addNode({ nodeCode: 'job_a', nodeType: 'JOB', x: 100, y: 50 })
    await nextTick()
    await nextTick()
    const ta = wrapper.find('textarea').element as HTMLTextAreaElement
    expect(ta.value).toContain('job_a')
    expect(ta.value).toContain('"JOB"')
  })

  it('JSON textarea 改 → blur 后画布(store)同步更新', async () => {
    const { store, wrapper } = factory(false)
    await nextTick()
    expect(store.nodes).toHaveLength(0)

    const taWrap = wrapper.find('textarea')
    const next = JSON.stringify({
      nodes: [
        { nodeCode: 'n1', nodeName: 'N1', nodeType: 'START', x: 10, y: 20 },
        { nodeCode: 'n2', nodeName: 'N2', nodeType: 'END', x: 200, y: 20 },
      ],
      edges: [{ sourceNodeCode: 'n1', targetNodeCode: 'n2' }],
    })
    await taWrap.setValue(next)
    await taWrap.trigger('blur')
    await nextTick()

    expect(store.nodes.map((n) => n.nodeCode).sort()).toEqual(['n1', 'n2'])
    expect(store.edges).toHaveLength(1)
    expect(store.edges[0].source).toBe('n1')
    expect(store.edges[0].target).toBe('n2')
    expect(wrapper.find('.json-sync-panel__error').exists()).toBe(false)
  })

  it('JSON 非法 → 显示 parseError 红色提示,画布不破坏', async () => {
    const { store, wrapper } = factory(false)
    // 先在画布有一个节点
    store.addNode({ nodeCode: 'keep', nodeType: 'JOB', x: 0, y: 0 })
    await nextTick()
    await nextTick()
    expect(store.nodes).toHaveLength(1)

    const taWrap = wrapper.find('textarea')
    await taWrap.setValue('{ not valid json')
    await taWrap.trigger('blur')
    await nextTick()

    expect(wrapper.find('.json-sync-panel__error').exists()).toBe(true)
    // 画布保留原节点
    expect(store.nodes).toHaveLength(1)
    expect(store.nodes[0].nodeCode).toBe('keep')
  })

  it('只读态展示 JSON 但不会把手工文本应用到画布', async () => {
    const { store, wrapper } = factory(false, true)
    const taWrap = wrapper.find('textarea')
    const next = JSON.stringify({
      nodes: [{ nodeCode: 'blocked', nodeType: 'START' }],
      edges: [],
    })

    await taWrap.setValue(next)
    await taWrap.trigger('blur')
    await nextTick()

    expect((taWrap.element as HTMLTextAreaElement).readOnly).toBe(true)
    expect(store.nodes).toHaveLength(0)
  })
  it('保存前同步应用未到防抖时间的 JSON', async () => {
    const { store, wrapper } = factory(false)
    await nextTick()
    const ta = wrapper.get('textarea')
    await ta.setValue(
      JSON.stringify({ nodes: [{ nodeCode: 'saved', nodeType: 'START' }], edges: [] }),
    )
    expect(store.nodes).toHaveLength(0)
    expect(wrapper.vm.flushDraft()).toBe(true)
    expect(store.nodes[0].nodeCode).toBe('saved')
    wrapper.unmount()
  })

  it('非法草稿折叠后仍保留并阻止保存', async () => {
    const { store, wrapper } = factory(false)
    await nextTick()
    const ta = wrapper.get('textarea')
    await ta.setValue('{ invalid')
    await wrapper.setProps({ collapsed: true })
    expect(wrapper.vm.flushDraft()).toBe(false)
    expect((ta.element as HTMLTextAreaElement).value).toBe('{ invalid')
    expect(store.nodes).toHaveLength(0)
    expect(wrapper.vm.hasDraft()).toBe(true)
    wrapper.unmount()
  })

  it('输入法组合期间不应用 JSON 草稿', async () => {
    const { store, wrapper } = factory(false)
    await nextTick()
    const ta = wrapper.get('textarea')
    await ta.trigger('compositionstart')
    const draft = JSON.stringify({ nodes: [{ nodeCode: 'draft', nodeType: 'START' }], edges: [] })
    ;(ta.element as HTMLTextAreaElement).value = draft
    await ta.trigger('input')
    vi.advanceTimersByTime(600)
    expect(wrapper.vm.flushDraft()).toBe(false)
    expect(store.nodes).toHaveLength(0)
    await ta.trigger('compositionend')
    await nextTick()
    await nextTick()
    await nextTick()
    expect(wrapper.vm.flushDraft()).toBe(true)
    expect(store.nodes[0].nodeCode).toBe('draft')
    wrapper.unmount()
  })

  it('组合输入的原生事件立即更新覆盖确认所观察的草稿状态', async () => {
    const { wrapper } = factory(false)
    await nextTick()
    const textarea = wrapper.get('textarea')
    await textarea.trigger('compositionstart')
    const before = wrapper.vm.getDraftState()
    ;(textarea.element as HTMLTextAreaElement).value = '组合中的新内容'
    textarea.element.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }))
    expect(wrapper.vm.getDraftState()).not.toBe(before)
    wrapper.unmount()
  })

  it('非法 JSON 后画布变化，修复 JSON 也不能自动覆盖画布', async () => {
    const { store, wrapper } = factory(false)
    await nextTick()
    const ta = wrapper.get('textarea')
    await ta.setValue('{ invalid')
    await ta.trigger('blur')
    store.addNode({ nodeCode: 'canvas', nodeType: 'START', x: 0, y: 0 })
    await nextTick()
    const raw = JSON.stringify({ nodes: [{ nodeCode: 'json', nodeType: 'START' }], edges: [] })
    await ta.setValue(raw)
    vi.advanceTimersByTime(600)
    expect(wrapper.vm.flushDraft()).toBe(false)
    expect(store.nodes[0].nodeCode).toBe('canvas')
    expect((ta.element as HTMLTextAreaElement).value).toBe(raw)
    expect(wrapper.find('.json-sync-panel__conflict').exists()).toBe(true)
    wrapper.unmount()
  })

  it('冲突时用户可选择保留画布并放弃 JSON，或明确用 JSON 覆盖画布', async () => {
    const { store, wrapper } = factory(false)
    await nextTick()
    const ta = wrapper.get('textarea')
    const raw = JSON.stringify({ nodes: [{ nodeCode: 'json', nodeType: 'START' }], edges: [] })
    await ta.setValue(raw)
    store.addNode({ nodeCode: 'canvas', nodeType: 'START', x: 0, y: 0 })
    await nextTick()
    await wrapper.get('[data-testid="keep-canvas"]').trigger('click')
    expect(wrapper.vm.hasDraft()).toBe(false)
    expect((ta.element as HTMLTextAreaElement).value).toContain('canvas')
    await ta.setValue(raw)
    store.updateNode('canvas', { nodeName: 'changed again' })
    await nextTick()
    vi.spyOn(ElMessageBox, 'confirm').mockResolvedValueOnce(
      'confirm' as Awaited<ReturnType<typeof ElMessageBox.confirm>>,
    )
    await wrapper.get('[data-testid="apply-json"]').trigger('click')
    await nextTick()
    expect(store.nodes[0].nodeCode).toBe('json')
    expect(wrapper.vm.hasDraft()).toBe(false)
    wrapper.unmount()
  })

  it('只调整 JSON 空白不清空画布撤销历史和选择', async () => {
    const { store, wrapper } = factory(false)
    store.addNode({ nodeCode: 'canvas', nodeType: 'START', x: 0, y: 0 })
    await nextTick()
    const ta = wrapper.get('textarea')
    const raw = (ta.element as HTMLTextAreaElement).value
    await ta.setValue(`  ${raw}  `)
    expect(wrapper.vm.flushDraft()).toBe(true)
    expect(store.canUndo).toBe(true)
    expect(store.selectedIds.has('canvas')).toBe(true)
    wrapper.unmount()
  })

  it('确认覆盖期间画布再次变化时不覆盖', async () => {
    const { store, wrapper } = factory(false)
    await nextTick()
    await wrapper
      .get('textarea')
      .setValue(JSON.stringify({ nodes: [{ nodeCode: 'json', nodeType: 'START' }], edges: [] }))
    store.addNode({ nodeCode: 'canvas', nodeType: 'START', x: 0, y: 0 })
    await nextTick()
    let confirm!: (value: Awaited<ReturnType<typeof ElMessageBox.confirm>>) => void
    vi.spyOn(ElMessageBox, 'confirm').mockReturnValueOnce(
      new Promise((resolve) => {
        confirm = resolve
      }),
    )
    await wrapper.get('[data-testid="apply-json"]').trigger('click')
    store.updateNode('canvas', { nodeName: 'newer' })
    confirm('confirm' as Awaited<ReturnType<typeof ElMessageBox.confirm>>)
    await nextTick()
    await nextTick()
    expect(store.nodes[0].nodeName).toBe('newer')
    expect(wrapper.vm.hasDraft()).toBe(true)
    wrapper.unmount()
  })

  it('工作流作用域重置后旧 JSON 防抖不能覆盖相同画布', async () => {
    const { store, wrapper } = factory(false)
    await nextTick()
    await wrapper
      .get('textarea')
      .setValue(
        JSON.stringify({ nodes: [{ nodeCode: 'old-draft', nodeType: 'START' }], edges: [] }),
      )
    store.reset({ nodes: [], edges: [] })
    vi.advanceTimersByTime(600)
    await nextTick()
    expect(store.nodes).toHaveLength(0)
    expect(wrapper.vm.flushDraft()).toBe(false)
    wrapper.unmount()
  })

  it('失锁发生在只读属性更新之前时，JSON 防抖不修改画布', async () => {
    const { store, wrapper } = factory(false)
    await nextTick()
    await wrapper
      .get('textarea')
      .setValue(JSON.stringify({ nodes: [{ nodeCode: 'draft', nodeType: 'START' }], edges: [] }))
    store.setLock({ isMine: false, lockedBy: 'other', expiresAt: '' })
    vi.advanceTimersByTime(600)
    expect(store.nodes).toHaveLength(0)
    expect(wrapper.vm.hasDraft()).toBe(true)
    wrapper.unmount()
  })
})
