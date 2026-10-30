export default {
  stateCount: '{status}: {count}',
  title: 'Job stages and execution progress',
  status: 'Job status: {status}',
  currentStage: 'Current stage: {stage}',
  pipelineLink: 'View Pipeline #{id}',
  PARTITION: 'Planned partitions',
  TASK: 'Created technical tasks',
  counts: 'Closed {closed} / {total}, succeeded {success}, created {created}',
  notCreated: 'No execution records yet',
  denominator:
    'Partition totals come from this job plan. Task totals cover created tasks only. Closed includes failed, cancelled and terminated work. Stages use the immutable runtime pipeline version rather than the current job definition.',
  pipelineVersion:
    'System pipeline {code}, semantic version {version}. Stage order is shown; conditional stages may not execute.',
  noGraph:
    'No verifiable system stage version. Observed stages remain visible; unknown dependencies are not inferred. GENERAL / ATOMIC jobs may have no file pipeline.',
  stage: 'System stage',
  attempt: 'Attempt',
  processed: 'Processed records',
}
