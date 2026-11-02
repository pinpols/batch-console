// @vitest-environment jsdom
import { shallowMount } from '@vue/test-utils'
import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { createEmptyJobEditForm } from '../jobEditFormTypes'
import JobConfigBasicForm from './JobConfigBasicForm.vue'

vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useMetaCalendarsQuery: () => ({ data: ref([]) }),
  useMetaWindowsQuery: () => ({ data: ref([]) }),
  useMetaBizTypesQuery: () => ({ data: ref([]) }),
}))

describe('JobConfigBasicForm dependency input', () => {
  it('exposes the 64 character upstream reference limit', () => {
    const model = createEmptyJobEditForm()
    model.scheduleType = 'CRON'
    const wrapper = shallowMount(JobConfigBasicForm, {
      props: { model, sections: ['schedule'] },
      global: {
        stubs: {
          ElFormItem: { template: '<label><slot /></label>' },
          ElInput: { template: '<input />' },
        },
      },
    })
    expect(
      wrapper
        .get('input[placeholder="jobConfigBasic.placeholderDependsOnJobCode"]')
        .attributes('maxlength'),
    ).toBe('64')
    wrapper.unmount()
  })
})
