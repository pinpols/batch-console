// @vitest-environment jsdom
import { shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import TenantBatchCreateDialog from './TenantBatchCreateDialog.vue'

vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      `${key}:${params?.line ?? ''}:${params?.max ?? ''}`,
  }),
}))

describe('TenantBatchCreateDialog', () => {
  it('validates each parsed tenant against backend length limits with source line numbers', () => {
    const wrapper = shallowMount(TenantBatchCreateDialog, {
      props: { modelValue: true, items: [] },
    })
    const formRules = (
      wrapper.vm as unknown as {
        batchFormRules: {
          tenantsText: Array<{
            validator?: (rule: object, value: string, done: (error?: Error) => void) => void
          }>
        }
      }
    ).batchFormRules
    const validator = formRules.tenantsText.find((rule) => rule.validator)?.validator
    expect(validator).toBeDefined()
    const done = vi.fn()
    validator!({}, `${'a'.repeat(64)},${'名'.repeat(256)},${'d'.repeat(512)}`, done)
    expect(done).toHaveBeenLastCalledWith()
    validator!({}, `ok,good\n\n${'a'.repeat(65)},name`, done)
    expect(done.mock.lastCall?.[0]?.message).toContain('ruleLineTooLong:3:64')
    validator!({}, `ok,${'名'.repeat(257)}`, done)
    expect(done.mock.lastCall?.[0]?.message).toContain('ruleLineTooLong:1:256')
    validator!({}, `ok,name,${'d'.repeat(513)}`, done)
    expect(done.mock.lastCall?.[0]?.message).toContain('ruleLineTooLong:1:512')
    validator!({}, 'a,name', done)
    expect(done.mock.lastCall?.[0]?.message).toContain('ruleLineIdLength:1:')
    validator!({}, `ok,${'😀'.repeat(129)}`, done)
    expect(done.mock.lastCall?.[0]?.message).toContain('ruleLineTooLong:1:256')
    wrapper.unmount()
  })
})
