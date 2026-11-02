// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { BatchDayReplaySession } from '@/api/batchDayReplay'
import BatchDayReplaySessionsTable from './BatchDayReplaySessionsTable.vue'

vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key, te: () => false }),
}))

describe('BatchDayReplaySessionsTable', () => {
  it('keeps the session closed when the operator uses the full-value action', async () => {
    const row = { id: 1, requestedBy: 'operator-with-a-long-identifier' }
    const wrapper = mount(BatchDayReplaySessionsTable, {
      props: {
        sessions: [row] as BatchDayReplaySession[],
        loading: false,
        historyUnavailable: false,
        writesFrozen: false,
        scopeLabel: () => '',
        scopeTagType: () => 'info',
        statusTagType: () => 'info',
        progressPct: () => 0,
        progressStatus: () => undefined,
      },
      global: {
        directives: { loading: () => {} },
        stubs: {
          ElTable: {
            props: ['data'],
            emits: ['row-click'],
            template: '<div @click="$emit(\'row-click\', data[0])"><slot /></div>',
          },
          ElTableColumn: {
            props: ['prop'],
            template:
              '<div v-if="prop === \'requestedBy\'"><slot :row="{ requestedBy: \'operator-with-a-long-identifier\' }" /></div>',
          },
          CopyableText: { props: ['text'], template: '<button>{{ text }}</button>' },
          DatetimeColumn: true,
        },
      },
    })
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('open-detail')).toBeUndefined()
    await wrapper.get('div').trigger('click')
    expect(wrapper.emitted('open-detail')?.[0]).toEqual([row])
    wrapper.unmount()
  })
})
