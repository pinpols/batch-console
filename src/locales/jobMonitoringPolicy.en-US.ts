import type { Messages } from './zh-CN'

const jobMonitoringPolicy: Messages['jobMonitoringPolicy'] = {
  jobCode: 'Job code',
  jobCodePlaceholder: 'Filter by job code',
  jobName: 'Job name',
  jobStatus: 'Job status',
  scheduleType: 'Schedule type',
  allScheduleTypes: 'All types',
  monitoringCategory: 'Monitoring category',
  allMonitoringCategories: 'All categories',
  categoryScheduled: 'Scheduled',
  categoryDependency: 'Eligibility-driven',
  categoryRuntimeOnly: 'Runtime only',
  cronSchedule: 'Cron schedule',
  fixedRateSchedule: 'Fixed interval',
  manualSchedule: 'Manual',
  manualScheduleHintShort: 'Start and completion rules not configured',
  enabledOnly: 'Enabled only',
  disabledOnly: 'Disabled only',
  enabled: 'Enabled',
  disabled: 'Disabled',
  softRuntime: 'Runtime too long',
  startGrace: 'Started too late',
  completionDeadline: 'Completed too late',
  scheduledDeadlines: 'Start and completion deadlines',
  completionMode: 'Completion deadline mode',
  completionClockMode: 'Absolute completion time',
  completionWindowMode: 'Relative completion window',
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
    'Measure from actual eligibility: the planned time for Cron, upstream readiness for dependencies, and node activation plus captured dependencies for Workflow children. Standalone manual runs without eligibility evidence are not classified as late. Set to 0 to disable.',
  completionDeadlineHint:
    'Use the scheduled day for standalone Cron jobs and the business date for Workflow children. Leave empty to disable. Timezone: {timezone}',
  dependencyCompletionHint:
    'Measure dependent jobs and Workflow children from their actual eligibility. A standalone manual run needs eligibility evidence. Set to 0 to disable.',
  manualScheduleHint:
    'Policies can be configured in advance. Start and completion alerts require actual schedule or eligibility evidence. Standalone manual runs never infer lateness from creation time.',
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
