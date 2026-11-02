// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { effectScope, reactive } from 'vue'
import { STORAGE_KEYS } from '@/constants/storageKeys'
import { stubLocalStorage } from '@/test-utils/localStorage'

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  fetchMe: vi.fn(),
}))

vi.mock('element-plus', () => ({
  ElMessageBox: { confirm: mocks.confirm },
  ElMessage: { success: mocks.success, warning: mocks.warning, error: vi.fn() },
}))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key, te: () => false }) }))
vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/', fullPath: '/', matched: [], meta: {} }),
  useRouter: () => ({ resolve: vi.fn(), push: vi.fn() }),
}))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ userInfo: { permissions: [] }, fetchMe: mocks.fetchMe }),
}))
vi.mock('@/stores/app', () => ({ useAppStore: () => ({}) }))
vi.mock('@/stores/permission', () => ({ usePermissionStore: () => ({ visibleGroups: [] }) }))
vi.mock('@/stores/tabs', () => ({ useTabsStore: () => ({ clear: vi.fn() }) }))

import { useTenantStore } from '@/stores/tenant'
import { useHeaderLogic } from './useHeaderLogic'
import { useDirtyForm } from '@/composables/useDirtyForm'

const storage = stubLocalStorage()

beforeEach(() => {
  storage.clear()
  setActivePinia(createPinia())
  mocks.confirm.mockReset()
  mocks.success.mockReset()
  mocks.warning.mockReset()
  mocks.fetchMe.mockReset().mockResolvedValue(undefined)
})

describe('顶栏租户切换', () => {
  it('确认期间草稿发生 ABA 时保留租户并提示重新确认', async () => {
    const tenant = useTenantStore()
    tenant.setTenantId('tenant-a')
    const scope = effectScope()
    const form = reactive({ name: 'initial' })
    let header!: ReturnType<typeof useHeaderLogic>
    scope.run(() => {
      useDirtyForm(() => form)
      header = useHeaderLogic()
    })
    form.name = 'draft'
    let finish!: (value: string) => void
    mocks.confirm.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        finish = resolve
      }),
    )
    const switching = header.handleTenantSwitch('tenant-b')
    form.name = 'changed'
    form.name = 'draft'
    finish('confirm')
    await switching
    expect(tenant.tenantId).toBe('tenant-a')
    expect(mocks.warning).toHaveBeenCalledWith('dirtyForm.tenantSwitchDraftChanged')
    expect(mocks.fetchMe).not.toHaveBeenCalled()
    scope.stop()
  })
  it('取消时保留租户、选择值和资料；确认后才切换并刷新资料', async () => {
    const tenant = useTenantStore()
    tenant.setTenantId('tenant-a')
    tenant.registerTenantChangeGuard(() => true)
    const scope = effectScope()
    const header = scope.run(() => useHeaderLogic())!
    mocks.confirm.mockRejectedValueOnce('cancel').mockResolvedValueOnce('confirm')

    await header.handleTenantSwitch('tenant-b')
    expect(tenant.tenantId).toBe('tenant-a')
    expect(header.tenantIdInput.value).toBe('tenant-a')
    expect(storage.get(STORAGE_KEYS.tenantId)).toBe('tenant-a')
    expect(mocks.fetchMe).not.toHaveBeenCalled()
    expect(mocks.success).not.toHaveBeenCalled()

    await header.handleTenantSwitch('tenant-b')
    expect(tenant.tenantId).toBe('tenant-b')
    expect(storage.get(STORAGE_KEYS.tenantId)).toBe('tenant-b')
    expect(mocks.fetchMe).toHaveBeenCalledTimes(1)
    expect(mocks.success).toHaveBeenCalledTimes(1)
    scope.stop()
  })
})
