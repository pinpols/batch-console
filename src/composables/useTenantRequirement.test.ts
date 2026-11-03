import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTenantRequirement } from './useTenantRequirement'

const state = vi.hoisted(() => ({ tenantId: '' as string, warning: vi.fn() }))

vi.mock('@/stores/tenant', () => ({
  useTenantStore: () => ({
    get tenantId() {
      return state.tenantId
    },
  }),
}))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('element-plus', () => ({ ElMessage: { warning: state.warning } }))

afterEach(() => {
  state.tenantId = ''
  vi.clearAllMocks()
})

describe('useTenantRequirement', () => {
  it('未选择租户时提示并返回 false，避免点击后毫无反应', () => {
    const { ensureTenantSelected, tenantMissing } = useTenantRequirement()
    expect(tenantMissing.value).toBe(true)
    expect(ensureTenantSelected()).toBe(false)
    expect(state.warning).toHaveBeenCalledWith('common.selectTenantBeforeAction')
  })

  it('已选择租户时直接放行且不提示', () => {
    state.tenantId = 'ta'
    const { ensureTenantSelected, tenantMissing } = useTenantRequirement()
    expect(tenantMissing.value).toBe(false)
    expect(ensureTenantSelected()).toBe(true)
    expect(state.warning).not.toHaveBeenCalled()
  })
})
