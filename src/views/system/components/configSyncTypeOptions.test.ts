import { computed, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'
import { localizeConfigSyncTypeOptions } from './configSyncTypeOptions'

describe('localizeConfigSyncTypeOptions', () => {
  it('语言切换后重新生成当前语言的类型标签', async () => {
    const i18n = createI18n({
      legacy: false,
      locale: 'zh-CN',
      messages: {
        'zh-CN': { configSyncTab: { typeJob: '作业', typeWorkflow: '工作流' } },
        'en-US': { configSyncTab: { typeJob: 'Job', typeWorkflow: 'Workflow' } },
      },
    })
    const options = computed(() => localizeConfigSyncTypeOptions(i18n.global.t))

    expect(options.value.slice(0, 2).map((option) => option.label)).toEqual(['作业', '工作流'])

    i18n.global.locale.value = 'en-US'
    await nextTick()

    expect(options.value.slice(0, 2).map((option) => option.label)).toEqual(['Job', 'Workflow'])
  })
})
