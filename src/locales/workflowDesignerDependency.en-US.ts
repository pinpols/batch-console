export default {
  graphStats: '{nodes} nodes · {edges} dependencies',
  autoConnect: {
    connected: 'Node added; dependencies and layout updated automatically',
    duplicateStart: 'A workflow can have only one START node',
    multipleSelection: 'Select only one node or edge as the insertion point',
    selectInsertionPoint: 'Select an upstream node or the edge where this node should be inserted',
    cannotAppendAfterEnd: 'END is terminal and cannot have downstream nodes',
    cannotInsertTerminal:
      'END cannot be inserted inside a dependency; add it after an upstream node',
    invalidPlacement: 'A valid dependency cannot be generated at this position',
  },
  dependency: {
    createTitle: 'Add dependency',
    createAction: 'Add dependency',
    createHint:
      'Dependencies are validated: duplicates, self loops, incoming START edges, outgoing END edges, and cycles are rejected.',
    created: 'Dependency added',
    updated: 'Dependency endpoints updated',
    deleted: 'Dependency deleted; use Undo to restore it',
    deleteAction: 'Delete dependency',
    invalidEndpoint: 'Invalid endpoints: START cannot be downstream and END cannot be upstream',
    duplicate: 'A dependency with the same endpoints already exists',
    cycle: 'This change would create a cycle, which is not allowed in a DAG workflow',
  },
  deleteNodeAction: 'Delete node',
  nodeDeleted: 'Node and {count} connected dependencies deleted; use Undo to restore them',
}
