export default {
  noSchedules: 'No schedules are enabled. Registered records and actual runs are shown separately.',
  title: 'Tenant daily plan and execution',
  date: 'Business date',
  today: 'Today',
  refresh: 'Refresh progress',
  unavailable:
    'Progress is disconnected. Showing the last snapshot while reconnecting and reloading.',
  incomplete:
    'Plan coverage is incomplete: {missing} / {total} schedules do not cover the batch cutoff. Planned completion percentage is unavailable.',
  complete:
    'Plan projection for currently enabled schedules covers this business day’s batch cutoff.',
  scopeHint:
    'Hot runtime records only; archived history is excluded. Five separate scopes; do not add their counts. Superseded plans and dry runs are excluded. Created tasks exclude future tasks; plans without a resolved business date are outside this query.',
  tableCaption: 'Ended, successful, failed and waiting counts by business scope',
  chartLabel: 'State distribution within each scope, based on its registered records',
  denominator: 'Registered total',
  ended: 'Ended',
  percentage: 'Ended ratio',
  unknown: 'Undetermined',
  noWork: 'No registered records',
  scope: 'Scope',
  succeeded: 'Succeeded',
  failed: 'Failed',
  active: 'Running',
  pending: 'Pending / waiting',
  skipped: 'Skipped / cancelled',
  other: 'Other states',
  SCHEDULED_OCCURRENCE: 'Scheduled triggers',
  TRIGGER_REQUEST: 'Trigger requests',
  WORKFLOW_RUN: 'Workflow runs',
  JOB_INSTANCE: 'Job instances',
  JOB_TASK: 'Created tasks',
}
