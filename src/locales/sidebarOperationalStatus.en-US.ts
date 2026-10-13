export default {
  operationalStatus: {
    normal: 'No maintenance/degradation',
    scheduled: 'Scheduled maintenance',
    readOnly: 'Read-only maintenance',
    maintenance: 'System maintenance',
    adminBypass: 'Maintenance (admin diagnostics)',
    degraded: 'Service degraded',
    unknown: 'Status unknown',
  },
  operationalStatusDescription: {
    normal:
      'Maintenance status synced successfully; no maintenance or known degradation is active.',
    scheduled: 'A maintenance notice is active, but its scheduled start time has not arrived.',
    readOnly: 'Read-only maintenance is active; write operations are restricted.',
    maintenance: 'Full-freeze maintenance is active; ordinary business requests are restricted.',
    adminBypass:
      'Admins may perform limited diagnostic reads during maintenance; business writes remain protected.',
    degraded:
      'A backend degradation signal was recently received; some data or features may be limited.',
    unknown: 'Maintenance status has not synced, is stale, or could not be refreshed.',
  },
}
