// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import type { LineageEvidence } from '@/api/lineage'
import LineageRelationExplorer from './LineageRelationExplorer.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: {
    'zh-CN': {
      lineageEvidence: {
        relationsTitle: '关联对象',
        relationsHint: '仅显示明确关联',
        selectRecord: '选择对象',
        idUnavailable: '不可用',
        noConfirmedLinks: '无法确认关联',
        relationIssues: { missingField: '关联字段未提供' },
        resultVersionTitle: '结果版本',
        jobInstanceTitle: '作业实例',
        pipelineInstances: '流水线',
        fileRecords: '文件',
        dispatchRecords: '投递',
      },
    },
  },
})
const record = {
  resultVersion: { id: 7, jobInstanceId: 42 },
  jobInstance: { id: 42, job_code: 'daily' },
  pipelineInstances: [],
  fileRecords: [],
  dispatchRecords: [],
} as unknown as LineageEvidence

describe('LineageRelationExplorer', () => {
  it('selects a linked object and displays its actual details', async () => {
    const wrapper = mount(LineageRelationExplorer, {
      props: { evidence: record },
      global: {
        plugins: [i18n],
        stubs: {
          ElSelect: { template: '<div><slot /></div>' },
          ElOption: true,
          ElButton: { template: '<button><slot /></button>' },
          JsonPreview: { props: ['data'], template: '<pre>{{ JSON.stringify(data) }}</pre>' },
        },
      },
    })
    expect(wrapper.text()).toContain('jobInstanceId')
    expect(wrapper.get('pre').text()).toContain('"id":7')
    const job = wrapper.findAll('button').find((item) => item.text().includes('作业实例'))!
    await job.trigger('click')
    expect(wrapper.get('pre').text()).toContain('daily')
    expect(wrapper.text()).toContain('关联字段未提供')
  })
})
