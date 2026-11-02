// @vitest-environment jsdom
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import ElementPlus from 'element-plus'
import { beforeEach, describe, expect, it } from 'vitest'
import DependencyCreateDialog from './DependencyCreateDialog.vue'
import { useDesignerStore } from '../store/useDesignerStore'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: { 'zh-CN': {} },
  missingWarn: false,
})

function factory() {
  const store = useDesignerStore()
  store.reset({
    nodes: [
      { id: 'start', nodeCode: 'start', nodeName: 'Start', nodeType: 'START', x: 0, y: 0 },
      { id: 'end', nodeCode: 'end', nodeName: 'End', nodeType: 'END', x: 100, y: 0 },
    ],
    edges: [],
  })
  const wrapper = mount(DependencyCreateDialog, {
    props: { modelValue: true },
    global: { plugins: [i18n, ElementPlus] },
  })
  const state = (
    wrapper.vm.$ as unknown as {
      setupState: {
        sourceId: string
        targetId: string
        edgeType: string
        conditionExpr: string
        submit: () => void
      }
    }
  ).setupState
  state.sourceId = 'start'
  state.targetId = 'end'
  return { wrapper, store, state }
}

describe('创建依赖的条件草稿', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })
  it.each(['SUCCESS', 'FAILURE', 'ALWAYS'])('切换为 %s 时不写入隐藏条件', async (kind) => {
    const { wrapper, store, state } = factory()
    state.edgeType = 'CONDITION'
    state.conditionExpr = 'amount > 1'
    state.edgeType = kind
    await flushPromises()
    state.submit()
    expect(store.edges[0].label).toBeUndefined()
    expect(store.edges[0].attrs?.edgeType).toBe(kind)
    wrapper.unmount()
  })
  it('切换回条件类型时保留草稿并提交', async () => {
    const { wrapper, store, state } = factory()
    state.edgeType = 'CONDITION'
    state.conditionExpr = ' amount > 1 '
    state.edgeType = 'SUCCESS'
    state.edgeType = 'CONDITION'
    await flushPromises()
    expect(state.conditionExpr).toBe(' amount > 1 ')
    state.submit()
    expect(store.edges[0].label).toBe('amount > 1')
    wrapper.unmount()
  })
})
