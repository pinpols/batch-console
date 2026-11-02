// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { defineComponent, reactive, ref } from 'vue'
import { ElForm, ElFormItem } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { createEmptyJobEditForm } from '../jobEditFormTypes'
import { createJobDefinitionWizardRules } from '../jobDefinitionWizardRules'
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

enableAutoUnmount(afterEach)
function render(jobCode: string, jobType: string) {
  const model = reactive({
    ...createEmptyJobEditForm(),
    jobCode,
    jobType,
    jobName: 'Example',
    scheduleType: 'MANUAL',
  })
  const rules = createJobDefinitionWizardRules(model, (key) => key)
  const Host = defineComponent({
    components: { ElForm, JobConfigBasicForm },
    setup: () => ({ model, rules }),
    template:
      '<ElForm :model="model" :rules="rules"><JobConfigBasicForm :model="model" :readonly-identity="false" :sections="[\'basic\']" /></ElForm>',
  })
  return mount(Host, {
    global: {
      components: { ElFormItem },
      stubs: { CodeNameBuilder: true, MetaSelect: true, ElInput: true, ElSwitch: true },
    },
  })
}

describe('作业向导基本信息校验', () => {
  it('作业编码为空时阻止继续', async () => {
    const wrapper = render('', 'GENERAL')
    const form = wrapper.getComponent(ElForm).vm as unknown as FormInstance
    const errors = await form.validate().catch((error) => error)
    expect(errors).toHaveProperty('jobCode')
  })

  it('作业类型为空时阻止继续', async () => {
    const wrapper = render('IMPORT_BILLING', '')
    const form = wrapper.getComponent(ElForm).vm as unknown as FormInstance
    const errors = await form.validate().catch((error) => error)
    expect(errors).toHaveProperty('jobType')
  })

  it('必填身份字段有效时允许继续', async () => {
    const wrapper = render('IMPORT_BILLING', 'GENERAL')
    const form = wrapper.getComponent(ElForm).vm as unknown as FormInstance
    expect(await form.validate()).toBe(true)
  })
})
