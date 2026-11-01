// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import ReplayStatusSummary from './ReplayStatusSummary.vue'
import type { BatchDayReplaySession } from '@/api/batchDayReplay'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: {
    'zh-CN': {
      batchDayReplay: {
        statusSummaryTitle: '处理摘要',
        statusPreviewUnavailable: '历史详情不包含提交前的预览结果。',
        statusApprovalId: '审批 ID',
        statusStartedAt: '开始时间',
        statusCompletedAt: '完成时间',
        fieldApprovedBy: '审批人',
        colStatus: '状态',
        colProgress: '进度',
        statusLabels: { PENDING_APPROVAL: '待审批', RUNNING: '执行中', PARTIAL_FAILED: '部分失败' },
        statusGuidance: {
          PENDING_APPROVAL: '等待审批，授权管理员可处理。',
          RUNNING: '执行中，查看已返回计数。',
          PARTIAL_FAILED: '部分失败，查看失败明细。',
        },
        statusGuidanceUnknown: '状态由服务端返回，请核对明细。',
        entriesSummary: '{ok}/{fail}/{pending}/{total}',
      },
    },
  },
})
const session: BatchDayReplaySession = {
  id: 1,
  tenantId: 'tenant-a',
  calendarCode: 'default',
  bizDate: '2026-11-01',
  scope: 'ALL',
  executionMode: 'REPLAY',
  candidateSource: 'EXISTING_INSTANCES',
  status: 'PENDING_APPROVAL',
}

describe('ReplayStatusSummary', () => {
  it('shows the recorded state without inventing approval, timestamps, or zero counts', () => {
    const wrapper = mount(ReplayStatusSummary, {
      props: { record: session },
      global: { plugins: [i18n] },
    })
    expect(wrapper.text()).toContain('待审批')
    expect(wrapper.text()).toContain('等待审批，授权管理员可处理')
    expect(wrapper.text()).toContain('历史详情不包含提交前的预览结果')
    expect(wrapper.text()).not.toContain('审批人')
    expect(wrapper.text()).not.toContain('开始时间')
    expect(wrapper.text()).not.toContain('完成时间')
    expect(wrapper.text()).not.toContain('进度')
  })

  it('shows returned approval, start time and known counts without inventing missing counts', () => {
    const wrapper = mount(ReplayStatusSummary, {
      props: {
        record: {
          ...session,
          status: 'RUNNING',
          approvedBy: 'alice',
          startedAt: '2026-11-01T02:00:00Z',
          succeededCount: 0,
          totalCount: 5,
        },
      },
      global: { plugins: [i18n] },
    })
    expect(wrapper.text()).toContain('执行中，查看已返回计数')
    expect(wrapper.text()).toContain('alice')
    expect(wrapper.text()).toContain('开始时间')
    expect(wrapper.text()).not.toContain('完成时间')
    expect(wrapper.text()).toContain('0/—/—/5')
  })
  it('shows neutral guidance for unknown status without inferring a stage', () => {
    const wrapper = mount(ReplayStatusSummary, {
      props: { record: { ...session, status: 'FUTURE_STATE' } },
      global: { plugins: [i18n] },
    })
    expect(wrapper.text()).toContain('FUTURE_STATE')
    expect(wrapper.text()).toContain('状态由服务端返回，请核对明细')
    expect(wrapper.text()).not.toContain('等待审批')
    expect(wrapper.text()).not.toContain('执行中')
  })
})
