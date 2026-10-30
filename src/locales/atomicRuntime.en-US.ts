export default {
  title: 'Atomic effective runtime gates',
  scope:
    'Read-only configuration of the single Worker connected through the reverse channel. This is not a cluster aggregate and does not use the static catalog defaults below.',
  readAt: 'Last successful query:',
  worker: 'Worker: {code} · Type: {type}',
  executor: 'Executor',
  enabled: 'Effective switch',
  gates: 'Effective safety gates',
  on: 'Enabled',
  off: 'Disabled',
  unknown: 'Unknown',
  notApplicable: 'Not applicable',
  loadError: 'Failed to read effective runtime configuration. Retry the query.',
  executors: {
    shell: 'Shell',
    sql: 'SQL',
    http: 'HTTP',
    storedProc: 'Stored procedure',
  },
  fields: {
    commandWhitelistSize: 'Allowed commands',
    dialect: 'Database dialect',
    enforceAllowlist: 'Enforce outbound allowlist',
    enforceAllowlistSource: 'Allowlist policy source',
    allowlistHostsSize: 'Allowed host rules',
    allowedSchemasSize: 'Allowed schemas',
  },
  sources: {
    explicit: 'Explicit configuration',
    'prod-default': 'Production default',
    'dev-default': 'Development default',
    absent: 'Not installed',
  },
  unavailable: {
    disabled:
      'The Atomic Worker reverse query channel is disabled. Effective gate status is unavailable.',
    unreachable: 'Cannot reach the Atomic Worker. Effective gate status is unavailable.',
    empty: 'The Atomic Worker returned an empty response. Effective gate status is unavailable.',
    other: 'Effective gate status is unavailable. Static defaults are not shown as runtime state.',
  },
}
