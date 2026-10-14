export default {
  operationalStatus: {
    normal: 'Service healthy',
    scheduled: 'Scheduled maintenance',
    readOnly: 'Read-only maintenance',
    maintenance: 'System maintenance',
    adminBypass: 'Maintenance (admin diagnostics)',
    degraded: 'Service degraded',
    unknown: 'Status unknown',
  },
  operationalStatusDescription: {
    normal:
      'The service is operating normally; maintenance status is synced, with no active maintenance or known degradation.',
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
