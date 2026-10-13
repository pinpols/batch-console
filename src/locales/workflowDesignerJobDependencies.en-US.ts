export default {
  title: 'Job dependency overview',
  workflowTitle: 'Current workflow (editable)',
  workflowUpstream: 'Workflow predecessors',
  workflowDownstream: 'Workflow successors',
  noWorkflowUpstream: 'No direct predecessor in this workflow',
  noWorkflowDownstream: 'No direct successor in this workflow',
  definitionTitle: 'Job-definition dependencies',
  definitionUpstream: 'Job-definition predecessor',
  definitionDownstream: 'Definitions directly depending on this job ({count})',
  noDefinitionUpstream: 'No job-definition predecessor configured',
  noDefinitionDownstream: 'No direct downstream job definitions',
  definitionMissing:
    'The linked job definition was not found; dependency information may be incomplete.',
  selectJob: 'Select a linked job to view its upstream and downstream definition dependencies.',
  loadError: 'Job-definition dependencies could not be loaded. Try again later.',
}
