import { describe, expect, it } from 'vitest'
import { getAlertResourceTarget } from './alertResourceTarget'

describe('getAlertResourceTarget', () => {
  it('兼容后端把 detailJson 做了 HTML 转义的旧响应', () => {
    expect(
      getAlertResourceTarget(
        '{&quot;jobInstanceId&quot;:&quot;442&quot;,&quot;workflowRunId&quot;:&quot;343&quot;}',
      ),
    ).toEqual({ type: 'workflowRun', id: '343', path: '/monitor/workflow-runs/343' })
  })

  it('links an alert to its workflow run when a workflow identity is present', () => {
    expect(getAlertResourceTarget('{"workflowRunId":91,"jobInstanceId":42}')).toEqual({
      type: 'workflowRun',
      id: '91',
      path: '/monitor/workflow-runs/91',
    })
  })

  it('links a job alert to its exact job instance', () => {
    expect(getAlertResourceTarget('{"jobInstanceId":"42","bizDate":"2026-10-11"}')).toEqual({
      type: 'jobInstance',
      id: '42',
      path: '/monitor/job-instances/42',
    })
  })

  it.each([
    '',
    'not-json',
    '[]',
    '{}',
    '{"jobInstanceId":0}',
    '{"jobInstanceId":-2}',
    '{"jobInstanceId":"1/../2"}',
    '{"jobInstanceId":"9007199254740992"}',
    '{"workflowRunId":9007199254740992}',
  ])('does not guess a target for invalid or missing identity: %s', (detailJson) => {
    expect(getAlertResourceTarget(detailJson)).toBeNull()
  })
})
