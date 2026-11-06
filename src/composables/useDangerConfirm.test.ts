// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { confirmDanger } from './useDangerConfirm'
const mocks = vi.hoisted(() => ({
  state: null as unknown as {
    tenantId: string
    writesFrozen: boolean
    isLoggedIn: boolean
    userInfo: { userId: string; username: string; permissions: string[] }
  },
  confirm: vi.fn(),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => mocks.state }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => mocks.state }))
vi.mock('@/stores/app', () => ({ useAppStore: () => mocks.state }))
vi.mock('@/locales', () => ({ i18n: { global: { t: (key: string) => key } } }))
vi.mock('element-plus', () => ({ ElMessageBox: { confirm: mocks.confirm } }))
function pending() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  return { promise, resolve }
}
beforeEach(() => {
  mocks.state = reactive({
    tenantId: 'tenant-a',
    writesFrozen: false,
    isLoggedIn: true,
    userInfo: { userId: 'operator-1', username: 'operator', permissions: ['ROLE_ADMIN'] },
  })
  mocks.confirm.mockReset().mockResolvedValue(undefined)
})
/** 递归取出确认内容 VNode 中的文字，断言可恢复性说明 */
function vnodeText(node: unknown): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(vnodeText).join('')
  return vnodeText((node as { children?: unknown }).children)
}

describe('危险确认的可恢复性说明', () => {
  it('未声明可恢复的操作不附“可在列表里恢复”，避免把重跑、取消说成可撤销', async () => {
    await confirmDanger({ verb: '重跑', target: '实例 614' })
    expect(vnodeText(mocks.confirm.mock.calls[0]![0])).not.toContain('dangerConfirm.reversibleNote')
  })
  it('显式声明可恢复的启停类操作才附可恢复说明', async () => {
    await confirmDanger({ verb: '暂停', target: '触发器', reversible: true })
    expect(vnodeText(mocks.confirm.mock.calls[0]![0])).toContain('dangerConfirm.reversibleNote')
  })
  it('不可恢复操作附不可恢复说明', async () => {
    await confirmDanger({ verb: '吊销', target: '密钥', irreversible: true })
    expect(vnodeText(mocks.confirm.mock.calls[0]![0])).toContain('dangerConfirm.irreversibleNote')
  })
})

describe('危险确认附带说明', () => {
  it('提供 note 时在同一个框里显示输入框，并返回去掉空白的说明', async () => {
    mocks.confirm.mockResolvedValue({ value: '  上游已恢复  ', action: 'confirm' })
    const note = await confirmDanger({
      verb: '确认告警',
      target: '「A」',
      note: { placeholder: '审计说明（可选）' },
    })
    expect(mocks.confirm.mock.calls[0]![2]).toMatchObject({
      showInput: true,
      inputPlaceholder: '审计说明（可选）',
    })
    expect(note).toBe('上游已恢复')
  })

  it('说明留空返回 undefined；不提供 note 时不显示输入框', async () => {
    mocks.confirm.mockResolvedValue({ value: '   ', action: 'confirm' })
    expect(await confirmDanger({ verb: '静默', target: '「A」', note: { placeholder: 'x' } })).toBe(
      undefined,
    )
    mocks.confirm.mockResolvedValue('confirm')
    await confirmDanger({ verb: '关闭', target: '「A」' })
    expect(mocks.confirm.mock.calls[1]![2]).not.toHaveProperty('showInput')
  })
})

describe('危险确认共享上下文', () => {
  it.each(['tenant', 'aba', 'operator', 'permission', 'maintenance', 'logout'] as const)(
    '确认期间 %s 变化，旧确认按取消处理',
    async (change) => {
      const dialog = pending()
      mocks.confirm.mockReturnValueOnce(dialog.promise)
      const action = vi.fn()
      const result = confirmDanger({ verb: '删除', target: '原目标' }).then(action, () => undefined)
      if (change === 'tenant' || change === 'aba') mocks.state.tenantId = 'tenant-b'
      if (change === 'aba') mocks.state.tenantId = 'tenant-a'
      if (change === 'operator') mocks.state.userInfo.username = 'another-operator'
      if (change === 'permission') mocks.state.userInfo.permissions = ['ROLE_AUDITOR']
      if (change === 'maintenance') {
        mocks.state.writesFrozen = true
        mocks.state.writesFrozen = false
      }
      if (change === 'logout') mocks.state.isLoggedIn = false
      dialog.resolve()
      await result
      expect(action).not.toHaveBeenCalled()
    },
  )
  it('相同上下文确认继续执行，权限集合顺序变化不影响权限语义', async () => {
    mocks.state.userInfo.permissions = ['ROLE_ADMIN', 'ROLE_TENANT_ADMIN']
    const dialog = pending()
    mocks.confirm.mockReturnValueOnce(dialog.promise)
    const action = vi.fn()
    const result = confirmDanger({ verb: '删除', target: '当前目标' }).then(action)
    mocks.state.userInfo.permissions = ['ROLE_TENANT_ADMIN', 'ROLE_ADMIN']
    dialog.resolve()
    await result
    expect(action).toHaveBeenCalledOnce()
  })
  it('用户取消保持原拒绝结果，结束后新确认独立生效', async () => {
    mocks.confirm.mockRejectedValueOnce('cancel')
    await expect(confirmDanger({ verb: '删除', target: '原目标' })).rejects.toBe('cancel')
    mocks.state.tenantId = 'tenant-b'
    await expect(confirmDanger({ verb: '删除', target: '当前目标' })).resolves.toBeUndefined()
  })
})
