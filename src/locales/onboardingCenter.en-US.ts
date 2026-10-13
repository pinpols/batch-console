const onboardingCenter = {
  eyebrow: 'Get started',
  continue: 'Continue setup',
  remindLater: 'Remind me later',
  progress: '{completed} of {total} complete',
  partialFailure:
    'Some status could not be loaded. Available progress is preserved; refresh again later.',
  completedTitle: 'Basic activation is complete for your role',
  completedDescription:
    'The activation center stays here so you can review configuration and runtime status later.',
  blockers: '{count} configuration item(s) need attention',
  moreBlockers: '{count} more item(s). Open configuration to see the full list.',
  importConfig: 'Import config package',
  viewGuide: 'View guide',
  role: {
    admin: {
      title: 'Complete the first runnable platform flow',
      description: 'Set up a tenant, job, configuration, worker, and successful run in order.',
    },
    auditor: {
      title: 'Establish runtime and audit visibility',
      description: 'Confirm the tenant and run records, then open the operation audit trail.',
    },
    tenantAdmin: {
      title: 'Make this tenant ready to run',
      description: 'Complete job setup and readiness checks, connect a worker, and verify a run.',
    },
    tenantUser: {
      title: 'Run and verify the first job',
      description:
        'Confirm an administrator prepared a runnable job, then run it and review the result.',
    },
  },
  status: {
    completed: 'Complete',
    current: 'Ready to start',
    blocked: 'Needs attention',
    pending: 'Waiting for prerequisite',
    unavailable: 'Status unknown',
  },
  step: {
    'tenant-context': {
      title: 'Choose a working tenant',
      description:
        'Select the business tenant whose configuration and runtime data you want to use.',
      blockedDescription:
        'No tenant is available for this account. Ask a platform admin for access.',
      action: 'Manage tenants',
    },
    'job-config': {
      title: 'Create job configuration',
      description:
        'Create a job definition or import the required resources as a configuration package.',
      action: 'Create job',
    },
    'configuration-readiness': {
      title: 'Resolve configuration blockers',
      description:
        'Use tenant readiness checks to find missing references and required configuration.',
      action: 'Fix configuration',
    },
    'worker-online': {
      title: 'Bring a worker online',
      description:
        'Confirm at least one execution worker is registered, online, and ready for tasks.',
      action: 'View workers',
    },
    'first-success': {
      title: 'Complete the first successful run',
      description: 'Start a job and confirm that its instance finishes successfully.',
      blockedDescription:
        'No runnable job is ready yet. Ask a tenant administrator to complete setup.',
      action: 'Run a job',
    },
    'runnable-job': {
      title: 'Confirm a runnable job',
      description: 'This tenant has a job definition ready for selection.',
      blockedDescription:
        'This tenant has no job definition yet. Ask a tenant administrator to configure one.',
      action: 'View jobs',
    },
    'inspect-run': {
      title: 'Inspect a run instance',
      description:
        'Review instance status, timeline, and errors to establish the daily inspection path.',
      action: 'View instances',
    },
    'audit-trail': {
      title: 'Review the operation audit trail',
      description:
        'Open audit records and confirm that key changes are traceable by actor and time.',
      action: 'Open audit trail',
    },
  },
} as const

export default onboardingCenter
