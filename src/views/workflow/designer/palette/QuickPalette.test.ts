// @vitest-environment jsdom
/**
 * QuickPalette — 4 case:
 * - 渲染:visible=true 时挂载 dialog + input + 默认 6 类型行
 * - 搜索:输入后 filteredRows 收敛
 * - 选中(Enter / 点击):store.addNode 被调,emit('created')
 * - Esc:emit('update:visible', false)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

vi.mock('@/composables/useJobCodeOptions', async () => {
  const { ref } = await import('vue')
  return {
    useJobCodeOptions: () => ({
      loading: ref(false),
      options: ref<string[]>([]),
      load: vi.fn().mockResolvedValue([]),
      clear: vi.fn(),
    }),
  }
})
vi.mock('@/composables/usePipelineCodeOptions', async () => {
  const { ref } = await import('vue')
  return {
    usePipelineCodeOptions: () => ({
      loading: ref(false),
      options: ref<string[]>([]),
      load: vi.fn().mockResolvedValue([]),
      clear: vi.fn(),
    }),
  }
})

// tenant store 依赖 localStorage,jsdom 提供 window.localStorage 但模块顶层 ref 调用
// 在测试环境下可能在 setup 之前求值,直接 mock 一个最小实现
// tenant store 依赖 localStorage;测试中直接返回 plain object 让 `tenant.tenantId` 求值为字符串
vi.mock('@/stores/tenant', () => ({
  useTenantStore: () => ({
    tenantId: 'test-tenant',
    setTenantId: vi.fn(),
  }),
}))

import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import QuickPalette from './QuickPalette.vue'
import { useDesignerStore } from '../store/useDesignerStore'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'en-US',
  messages: {
    'zh-CN': {
      workflowDesignerPolish: {
        quickPaletteTitle: '快速节点',
        searchPlaceholder: '搜索',
        noResults: '无结果',
        quickPaletteHint: '↑↓',
      },
    },
    'en-US': {
      workflowDesignerPolish: {
        quickPaletteTitle: 'Quick',
        searchPlaceholder: 'Search',
        noResults: 'No results',
        quickPaletteHint: '↑↓',
      },
    },
  },
})

function factory(visible = true) {
  setActivePinia(createPinia())
  const store = useDesignerStore()
  const wrapper = mount(QuickPalette, {
    props: { visible, centerX: 200, centerY: 300 },
    global: { plugins: [i18n] },
  })
  return { store, wrapper }
}

describe('QuickPalette', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('visible 时渲染 input + 6 类型行', async () => {
    const { wrapper } = factory(true)
    await nextTick()
    expect(wrapper.find('.quick-palette__mask').exists()).toBe(true)
    expect(wrapper.find('.quick-palette__input').exists()).toBe(true)
    const items = wrapper.findAll('.quick-palette__item')
    expect(items.length).toBe(6) // START / END / JOB / GATEWAY / FILE_STEP / APPROVAL
  })

  it('搜索 "job" → 仅保留 JOB 类型行', async () => {
    const { wrapper } = factory(true)
    await nextTick()
    const input = wrapper.find('.quick-palette__input')
    await input.setValue('job')
    await nextTick()
    const items = wrapper.findAll('.quick-palette__item')
    expect(items.length).toBe(1)
    expect(items[0].text()).toContain('JOB')
  })

  it('点击 row → store.addNode 被调,emit("created")', async () => {
    const { wrapper, store } = factory(true)
    await nextTick()
    expect(store.nodes.length).toBe(0)
    const items = wrapper.findAll('.quick-palette__item')
    // 找 JOB 行点击
    const jobItem = items.find((i) => i.text().trim().startsWith('JOB'))!
    await jobItem.trigger('click')
    await nextTick()
    expect(store.nodes.length).toBe(1)
    expect(store.nodes[0].nodeType).toBe('JOB')
    expect(store.nodes[0].x).toBe(200)
    expect(store.nodes[0].y).toBe(300)
    expect(wrapper.emitted('created')).toBeTruthy()
    expect(wrapper.emitted('update:visible')?.[0]).toEqual([false])
  })

  it('Esc 关闭 → emit("update:visible", false)', async () => {
    const { wrapper } = factory(true)
    await nextTick()
    const panel = wrapper.find('.quick-palette__panel')
    await panel.trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('update:visible')?.[0]).toEqual([false])
  })
})
