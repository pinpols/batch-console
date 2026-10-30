// @vitest-environment jsdom
import { shallowMount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, reactive } from 'vue'
import { ElMessageBox } from 'element-plus'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WorkflowDesigner from './WorkflowDesigner.vue'
import DesignerToolbar from './toolbar/DesignerToolbar.vue'
import { useDesignerStore } from './store/useDesignerStore'
import { useTenantStore } from '@/stores/tenant'
import { stubLocalStorage } from '@/test-utils/localStorage'

const state = vi.hoisted(() => ({
  route: null as unknown as { params: { id?: string } },
  getFull: vi.fn(),
  putFull: vi.fn(),
  create: vi.fn(),
  acquire: vi.fn(),
  release: vi.fn(),
  leave: null as unknown as () => Promise<boolean>,
  update: null as unknown as (to: unknown, from: unknown) => Promise<boolean>,
}))
vi.mock('vue-router', () => ({
  useRoute: () => state.route,
  useRouter: () => ({ replace: vi.fn() }),
  onBeforeRouteLeave: (guard: typeof state.leave) => {
    state.leave = guard
  },
  onBeforeRouteUpdate: (guard: typeof state.update) => {
    state.update = guard
  },
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('@/api/workflowDesigner', () => ({
  workflowDesignerApi: { getFull: state.getFull, putFull: state.putFull },
}))
vi.mock('@/api/workflow', () => ({ workflowApi: { create: state.create } }))
vi.mock('@/composables/useLockManager', () => ({
  useLockManager: () => ({ acquire: state.acquire, release: state.release }),
}))
vi.mock('./canvas/DagCanvas.vue', () => ({ default: { name: 'DagCanvas', template: '<div />' } }))
vi.mock('@/utils/logger', () => ({ logRoute: vi.fn() }))
const storage = stubLocalStorage()

function detail(id: number, tenantId = 'tenant-a') {
  return {
    id,
    tenantId,
    workflowCode: 'WF-' + id,
    workflowName: 'Workflow ' + id,
    workflowType: 'DAG',
    enabled: true,
    version: 1,
    nodes: [],
    edges: [],
  }
}
function mountDesigner() {
  return shallowMount(WorkflowDesigner, {
    global: {
      directives: { loading: () => {} },
      stubs: {
        ElTooltip: true,
        ElDialog: true,
        ElDrawer: true,
        ElIcon: true,
        ElButton: true,
        ElTag: true,
      },
    },
  })
}

describe('Workflow 设计器加载目标与生命周期', () => {
  beforeEach(() => {
    storage.clear()
    setActivePinia(createPinia())
    useTenantStore().setTenantId('tenant-a')
    state.route = reactive({ params: { id: '1' } })
    state.leave = undefined as unknown as typeof state.leave
    state.update = undefined as unknown as typeof state.update
    // Element Plus 共用确认框与输入框的交叉返回类型；此场景只使用确认结果。
    const confirmed = 'confirm' as Awaited<ReturnType<typeof ElMessageBox.confirm>>
    vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue(confirmed)
    state.getFull
      .mockReset()
      .mockImplementation(async (id: number, tenant: string) => detail(id, tenant))
    state.putFull.mockReset()
    state.create.mockReset()
    state.acquire.mockReset().mockResolvedValue('editable')
    state.release.mockReset().mockResolvedValue(undefined)
  })

  it('旧定义详情晚到不覆盖新路由的画布元数据，也不获取旧定义锁', async () => {
    let resolveOld!: (value: unknown) => void
    state.getFull.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve
      }),
    )
    const wrapper = mountDesigner()
    await flushPromises()
    state.route.params.id = '2'
    await nextTick()
    await flushPromises()
    resolveOld(detail(1))
    await flushPromises()
    expect(useDesignerStore().meta.id).toBe(2)
    expect(state.acquire).not.toHaveBeenCalledWith(1, 'tenant-a')
    wrapper.unmount()
  })

  it('更换租户会重新读取当前目标，不能继续显示前租户画布', async () => {
    const wrapper = mountDesigner()
    await flushPromises()
    useTenantStore().setTenantId('tenant-b')
    await nextTick()
    await flushPromises()
    expect(state.getFull).toHaveBeenLastCalledWith(1, 'tenant-b')
    expect(useDesignerStore().meta.tenantId).toBe('tenant-b')
    wrapper.unmount()
  })

  it('切到新建模式时清空已有定义的编码、名称和版本', async () => {
    const wrapper = mountDesigner()
    await flushPromises()
    state.route.params.id = undefined
    await nextTick()
    await flushPromises()
    expect(useDesignerStore().meta).toMatchObject({
      id: null,
      workflowCode: '',
      workflowName: '',
      version: 0,
    })
    wrapper.unmount()
  })

  it('卸载后迟到的详情不写共享 Store，也不继续申请锁', async () => {
    let resolveOld!: (value: unknown) => void
    state.getFull.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve
      }),
    )
    const wrapper = mountDesigner()
    await flushPromises()
    wrapper.unmount()
    resolveOld(detail(1))
    await flushPromises()
    expect(useDesignerStore().meta.id).toBeNull()
    expect(state.acquire).not.toHaveBeenCalled()
  })

  it('取消离页时保留未保存画布和当前编辑锁', async () => {
    const wrapper = mountDesigner()
    await flushPromises()
    const store = useDesignerStore()
    store.dirty = true
    vi.mocked(ElMessageBox.confirm).mockRejectedValueOnce('cancel')
    state.release.mockClear()
    expect(await state.leave()).toBe(false)
    expect(store.meta.id).toBe(1)
    expect(store.dirty).toBe(true)
    expect(state.release).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('明确放弃修改后允许离页，干净画布无需重复确认', async () => {
    const wrapper = mountDesigner()
    await flushPromises()
    const store = useDesignerStore()
    expect(await state.leave()).toBe(true)
    expect(ElMessageBox.confirm).not.toHaveBeenCalled()
    store.dirty = true
    expect(await state.leave()).toBe(true)
    expect(ElMessageBox.confirm).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('复用设计器路由切换定义时也保护未保存画布，同一目标不受影响', async () => {
    const wrapper = mountDesigner()
    await flushPromises()
    useDesignerStore().dirty = true
    const same = { params: { id: '1' } }
    expect(await state.update(same, same)).toBe(true)
    expect(ElMessageBox.confirm).not.toHaveBeenCalled()
    vi.mocked(ElMessageBox.confirm).mockRejectedValueOnce('cancel')
    expect(await state.update({ params: { id: '2' } }, same)).toBe(false)
    expect(useDesignerStore().meta.id).toBe(1)
    wrapper.unmount()
  })

  it.each([false, true])('保存期间的新编辑保持未保存状态，新建=%s', async (creating) => {
    if (creating) state.route.params.id = undefined
    const wrapper = mountDesigner()
    await flushPromises()
    const store = useDesignerStore()
    store.setMeta({ workflowCode: 'WF-save', workflowName: '保存中的工作流' })
    store.setLock({ isMine: true, lockedBy: 'fixture-admin', expiresAt: '' })
    store.reset({
      nodes: [
        { id: 'start', nodeCode: 'start', nodeName: '开始', nodeType: 'START', x: 0, y: 0 },
        { id: 'end', nodeCode: 'end', nodeName: '结束', nodeType: 'END', x: 100, y: 0 },
      ],
      edges: [{ id: 'edge', source: 'start', target: 'end' }],
    })
    store.updateNode('end', { nodeName: '已提交名称' })
    let finishSave!: (value: unknown) => void
    const response = new Promise((resolve) => {
      finishSave = resolve
    })
    if (creating) state.create.mockReturnValueOnce(response)
    else state.putFull.mockReturnValueOnce(response)
    wrapper.findComponent(DesignerToolbar).vm.$emit('save')
    await flushPromises()
    expect(creating ? state.create : state.putFull).toHaveBeenCalledOnce()
    store.updateNode('end', { nodeName: '保存期间新名称' })
    finishSave({ ...detail(creating ? 3 : 1), version: 2 })
    await flushPromises()
    if (creating) {
      state.route.params.id = '3'
      await nextTick()
      await flushPromises()
      expect(state.getFull).not.toHaveBeenCalled()
      expect(state.acquire).toHaveBeenCalledWith(3, 'tenant-a')
    }
    expect(store.nodes.find((node) => node.id === 'end')?.nodeName).toBe('保存期间新名称')
    expect(store.dirty).toBe(true)
    expect(store.meta.version).toBe(2)
    store.undo()
    expect(store.nodes.find((node) => node.id === 'end')?.nodeName).toBe('已提交名称')
    expect(store.dirty).toBe(false)
    wrapper.unmount()
  })
})
