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
