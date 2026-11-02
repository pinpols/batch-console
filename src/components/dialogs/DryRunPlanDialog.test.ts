// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, inject, provide, toRef, type Ref } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import { useTenantStore } from '@/stores/tenant'
import { ElMessage } from 'element-plus'
import zh from '@/locales/zh-CN'
import en from '@/locales/en-US'
import { dryRunApi } from '@/api/dryRun'
import CopyableText from '@/components/common/CopyableText.vue'
import DryRunPlanDialog from './DryRunPlanDialog.vue'

vi.mock('@/api/dryRun', () => ({ dryRunApi: { plan: vi.fn() } }))
vi.mock('element-plus', async (importOriginal) => ({
  ...(await importOriginal<typeof import('element-plus')>()),
  ElMessage: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}))
enableAutoUnmount(afterEach)

const slot = { template: '<div><slot /><slot name="footer" /></div>' }
const table = defineComponent({
  props: ['data'],
  setup(props, { slots }) {
    provide('rows', toRef(props, 'data'))
    return () => h('div', slots.default?.())
  },
})
const column = defineComponent({
  props: ['prop'],
  setup(props, { slots }) {
    const rows = inject<Ref<Record<string, string>[]>>('rows')!
    return () =>
      h(
        'div',
        rows.value.map((row) => h('div', slots.default?.({ row }) ?? row[props.prop])),
      )
  },
})
const group = defineComponent({
  emits: ['update:modelValue'],
  setup(_, { emit, slots }) {
    provide('choose', (value: string) => emit('update:modelValue', value))
    return () => h('div', slots.default?.())
  },
})
const radio = defineComponent({
  props: ['value'],
  setup(props, { slots }) {
    const choose = inject<(value: string) => void>('choose')!
    return () => h('button', { onClick: () => choose(props.value) }, slots.default?.())
  },
})
const stubs = {
  ElDialog: slot,
  ElForm: slot,
  ElFormItem: slot,
  ElDivider: slot,
  ElTag: slot,
  ElRadioGroup: group,
  ElRadioButton: radio,
  ElTable: table,
  ElTableColumn: column,
  ElInput: true,
  ElDatePicker: true,
  ElAlert: { props: ['title', 'type'], template: '<div :data-type="type">{{ title }}</div>' },
  ElButton: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
}

describe('DryRunPlanDialog SQL plan availability', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useTenantStore().setTenantId('tenant-a')
    vi.clearAllMocks()
    vi.mocked(dryRunApi.plan).mockReset()
    vi.mocked(dryRunApi.plan).mockResolvedValue({
      level: 'EXECUTION_PLAN',
      success: false,
      findings: [
        {
          severity: 'ERROR',
          scope: 'execution',
          code: 'EXEC_SQL_PLAN_UNAVAILABLE',
          message: 'backend SQL message',
        },
        { severity: 'WARN', scope: 'execution', code: 'OTHER', message: 'backend other message' },
      ],
    })
  })

  it('长诊断编码提供完整值查看入口', async () => {
    const code = `EXEC_${'SQL_VALIDATION_'.repeat(4)}FAILED`
    vi.mocked(dryRunApi.plan).mockResolvedValue({
      level: 'CONFIG_VALIDATE',
      success: false,
      findings: [{ severity: 'ERROR', scope: 'job', code, message: 'failure' }],
    })
    const i18n = createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': zh } })
    const wrapper = mount(DryRunPlanDialog, {
      props: { modelValue: true, tenantId: 'tenant-a', jobCode: 'JOB' },
      global: { plugins: [i18n], stubs },
    })
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '运行演练')!
      .trigger('click')
    await flushPromises()
    const value = wrapper.getComponent(CopyableText)
    expect(value.props('text')).toBe(code)
    expect(value.get('.copyable-text__inspect').attributes('aria-label')).toBe('查看完整内容')
  })

  it('切换租户后旧演练结果不显示成功提示', async () => {
    let finish!: (value: { level: 'CONFIG_VALIDATE'; success: true; findings: [] }) => void
    vi.mocked(dryRunApi.plan).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const i18n = createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': zh } })
    const wrapper = mount(DryRunPlanDialog, {
      props: { modelValue: true, tenantId: 'tenant-a', jobCode: 'JOB' },
      global: { plugins: [i18n], stubs },
    })
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '运行演练')!
      .trigger('click')
    useTenantStore().setTenantId('tenant-b')
    useTenantStore().setTenantId('tenant-a')
    finish({ level: 'CONFIG_VALIDATE', success: true, findings: [] })
    await flushPromises()
    expect(ElMessage.success).not.toHaveBeenCalled()
    expect(wrapper.text()).not.toContain('演练全部通过')
  })

  it('reports warnings without claiming all checks passed', async () => {
    vi.mocked(dryRunApi.plan).mockResolvedValue({
      level: 'EXECUTION_PLAN',
      success: true,
      findings: [{ severity: 'WARN', scope: 'execution', code: 'WARN', message: 'needs review' }],
    })
    const i18n = createI18n({
      legacy: false,
      locale: 'zh-CN',
      messages: { 'zh-CN': zh, 'en-US': en },
    })
    const wrapper = mount(DryRunPlanDialog, {
      props: { modelValue: true, tenantId: 'tenant-a', jobCode: 'JOB' },
      global: { plugins: [i18n], stubs },
    })
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '运行演练')!
      .trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('演练完成，有 1 项警告')
    expect(wrapper.text()).not.toContain('演练全部通过')
    expect(ElMessage.warning).toHaveBeenCalledWith('演练完成，有 1 项警告')
    expect(ElMessage.success).not.toHaveBeenCalled()
  })

  it.each([
    ['PASS', true, '演练全部通过'],
    ['ERROR', false, '发现 1 项 ERROR'],
  ] as const)(
    'reports %s findings with the corresponding result',
    async (severity, success, text) => {
      vi.mocked(dryRunApi.plan).mockResolvedValue({
        level: 'CONFIG_VALIDATE',
        success,
        findings: [{ severity, scope: 'job', code: 'TEST', message: 'result' }],
      })
      const i18n = createI18n({
        legacy: false,
        locale: 'zh-CN',
        messages: { 'zh-CN': zh, 'en-US': en },
      })
      const wrapper = mount(DryRunPlanDialog, {
        props: { modelValue: true, tenantId: 'tenant-a', jobCode: 'JOB' },
        global: { plugins: [i18n], stubs },
      })
      await wrapper
        .findAll('button')
        .find((button) => button.text() === '运行演练')!
        .trigger('click')
      await flushPromises()
      expect(wrapper.text()).toContain(text)
      expect(success ? ElMessage.success : ElMessage.warning).toHaveBeenCalledWith(text)
    },
  )

  it.each([
    ['zh-CN', 'SQL 计划执行已停用', 'SQL 已完成静态检查，数据库执行计划已停用'],
    [
      'en-US',
      'SQL plan execution is disabled',
      'SQL passed static checks; database plan execution is disabled',
    ],
  ])(
    'shows an accurate L3 hint and localized unavailability in %s',
    async (locale, hint, error) => {
      const i18n = createI18n({ legacy: false, locale, messages: { 'zh-CN': zh, 'en-US': en } })
      const wrapper = mount(DryRunPlanDialog, {
        props: { modelValue: true, tenantId: 'tenant-a', jobCode: 'JOB' },
        global: { plugins: [i18n], stubs },
      })
      await wrapper
        .findAll('button')
        .find((button) => button.text().startsWith('L3'))!
        .trigger('click')
      expect(wrapper.text()).toContain(hint)
      await wrapper
        .findAll('button')
        .find((button) => button.text() === i18n.global.t('dryRunDialog.submit'))!
        .trigger('click')
      await flushPromises()
      expect(wrapper.text()).toContain(error)
      expect(wrapper.text()).toContain('backend other message')
      expect(wrapper.text()).not.toContain('backend SQL message')
    },
  )
})
