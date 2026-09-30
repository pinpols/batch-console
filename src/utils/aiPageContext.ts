const PAGE_TYPES: Record<string, string> = {
  'ops-summary': 'ops-summary',
  'm-ops-summary': 'ops-summary',
  'job-definition-detail': 'job-definition',
  'job-instance-detail': 'job-instance',
  'm-job-detail': 'job-instance',
  'workflow-viewer': 'workflow-definition',
  'm-workflow-viewer': 'workflow-definition',
  'workflow-run-detail': 'workflow-run',
  'observability-trace': 'trace',
}

const PAGE_LABEL_KEYS: Record<string, string> = {
  'ops-summary': 'page.opsSummary.title',
  'job-definition': 'page.jobsDefinitions.title',
  'job-instance': 'page.monitorJobInstances.title',
  'workflow-definition': 'page.workflowViewer.title',
  'workflow-run': 'page.monitorWorkflowRuns.title',
  trace: 'page.observabilityTrace.title',
}

export function aiPageType(routeName: unknown): string | undefined {
  return typeof routeName === 'string' ? PAGE_TYPES[routeName] : undefined
}

export function aiPageLabelKey(pageType: string | undefined): string | undefined {
  return pageType ? PAGE_LABEL_KEYS[pageType] : undefined
}
