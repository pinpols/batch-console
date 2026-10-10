import type { Messages } from './zh-CN'

const jobMonitoringPolicy: Messages['jobMonitoringPolicy'] = {
  jobCode: 'Job code',
  jobCodePlaceholder: 'Filter by job code',
  jobName: 'Job name',
  jobStatus: 'Job status',
  scheduleType: 'Schedule type',
  allScheduleTypes: 'All types',
  cronSchedule: 'Cron schedule',
  fixedRateSchedule: 'Fixed interval',
  manualSchedule: 'Manual',
  manualScheduleHintShort: 'Runtime monitoring only',
  enabledOnly: 'Enabled only',
  disabledOnly: 'Disabled only',
  enabled: 'Enabled',
  disabled: 'Disabled',
  softRuntime: 'Runtime too long',
  startGrace: 'Started too late',
  completionDeadline: 'Completed too late',
  scheduledDeadlines: 'Start and completion deadlines',
  thresholdSeconds: 'Threshold (seconds)',
  deadlineTime: 'Completion deadline',
  deadlineTimePlaceholder: 'Empty disables',
  deadlineDay: 'Deadline day',
  sameDay: 'Scheduled day',
  nextDay: 'Following day',
  notApplicable: 'Scheduled jobs only',
  severity: 'Alert severity',
  softRuntimeHint:
    'Alert when runtime exceeds this duration, measured from execution start. Disabled by default; set to 0 to disable.',
  startGraceHint:
    'Standalone Cron jobs use the planned fire time. Dependent jobs use the later of the planned fire and upstream-ready times. New jobs default to 5 minutes; set to 0 to disable.',
  completionDeadlineHint:
    'Cron jobs without an upstream dependency only: alert if the instance is unfinished at the local deadline on its scheduled day. Leave empty to disable. Timezone: {timezone}',
  dependencyCompletionHint:
    'Dependent jobs are measured from eligibility; for Cron jobs, use the later of the planned fire and upstream-ready times. Set to 0 to disable.',
  manualScheduleHint:
    'Standalone fixed-rate and manual/API/external jobs support runtime alerts only. Jobs with an upstream dependency also support start and completion deadlines.',
  alertOnlyHint:
    'These thresholds emit alerts only; they do not pause, cancel, or change job state.',
  secondsValue: '{seconds} sec',
  minutesValue: '{minutes} min',
  editTitle: 'Edit monitoring policy · {jobCode}',
  loadFailed: 'Failed to load job monitoring policies',
  saveSuccess: 'Job monitoring policy saved',
  saveFailed: 'Failed to save job monitoring policy',
}

export default jobMonitoringPolicy
