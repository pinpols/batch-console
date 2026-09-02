// @vitest-environment jsdom
/**
 * JsonSyncPanel — 3 case:
 * - 画布变更 → JSON textarea 文本同步更新
 * - JSON textarea 改 → blur 后画布(store.nodes/edges)同步更新
 * - JSON 非法 → 显示 parseError 提示,画布不破坏
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
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
})
