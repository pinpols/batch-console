// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/locales'
import { useDesignerStore } from '../store/useDesignerStore'
import TemplateLibrary from './TemplateLibrary.vue'

const confirm = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useDangerConfirm', () => ({ confirmDanger: confirm }))

function setup(jsonDraft = '') {
  setActivePinia(createPinia())
  const store = useDesignerStore()
  store.reset({
    nodes: [{ id: 'job', nodeCode: 'job', nodeName: '原节点', nodeType: 'JOB', x: 0, y: 0 }],
    edges: [],
  })
  store.setLock({ isMine: true, lockedBy: 'test', expiresAt: '' })
  const json = ref(jsonDraft)
  const hasUnsavedChanges = () => store.dirty || store.inspectorDrafts.length > 0 || !!json.value
  const getOverwriteState = () =>
    JSON.stringify([store.snapshot, store.inspectorDrafts, json.value])
  const wrapper = mount(TemplateLibrary, {
    props: { visible: true, hasUnsavedChanges, getOverwriteState },
    global: { plugins: [i18n], stubs: { ElDialog: { template: '<div><slot /></div>' } } },
  })
  return { wrapper, store, json }
}

describe('模板覆盖确认', () => {
  beforeEach(() => confirm.mockReset())

  it.each(['inspector', 'json'])('%s 未保存时取消确认保留原图和草稿', async (kind) => {
    confirm.mockRejectedValueOnce(new Error('cancel'))
    const { wrapper, store, json } = setup(kind === 'json' ? '{ draft' : '')
    if (kind === 'inspector') store.setInspectorDraft('nodeName', 'job', '未失焦')
    await wrapper.get('.template-library__card').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledOnce()
    expect(store.nodes[0]!.nodeName).toBe('原节点')
    if (kind === 'inspector')
      expect(store.getInspectorDraft('nodeName', 'job')?.value).toBe('未失焦')
    else expect(json.value).toBe('{ draft')
    expect(wrapper.emitted('applied')).toBeUndefined()
    wrapper.unmount()
  })

  it.each(['draft', 'scope', 'lock'])('确认期间 %s 变化后，即使确认也不覆盖', async (kind) => {
    let accept!: () => void
    confirm.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        accept = resolve
      }),
    )
    const { wrapper, store, json } = setup('{ draft')
    await wrapper.get('.template-library__card').trigger('click')
    if (kind === 'draft') {
      json.value = '{ newer draft'
      json.value = '{ draft'
    }
    if (kind === 'scope') {
      const originalTenant = store.meta.tenantId
      store.setMeta({ tenantId: 'new-tenant' })
      store.setMeta({ tenantId: originalTenant })
    }
    if (kind === 'lock') {
      store.setLock({ isMine: false, lockedBy: 'other', expiresAt: '' })
      store.setLock({ isMine: true, lockedBy: 'test', expiresAt: '' })
    }
    accept()
    await flushPromises()
    expect(store.nodes[0]!.nodeName).toBe('原节点')
    expect(wrapper.emitted('applied')).toBeUndefined()
    wrapper.unmount()
  })

  it('状态不变且确认覆盖后应用模板', async () => {
    confirm.mockResolvedValueOnce(undefined)
    const { wrapper, store } = setup('{ draft')
    await wrapper.get('.template-library__card').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledOnce()
    expect(store.nodes.some((node) => node.nodeCode === 'start')).toBe(true)
    expect(store.dirty).toBe(true)
    expect(wrapper.emitted('applied')).toBeTruthy()
    wrapper.unmount()
  })
})
