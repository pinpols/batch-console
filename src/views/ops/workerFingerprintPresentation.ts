import type { WorkerFingerprint, WorkerFingerprintSummary } from '@/api/workerFingerprint'

export function summarizeWorkerFingerprints(
  rows: WorkerFingerprint[],
  summary: WorkerFingerprintSummary[],
) {
  const activeRows = rows.filter((row) => row.status === 'ONLINE' || row.status === 'DRAINING')
  const dominant = [...summary].sort((a, b) => Number(b.count) - Number(a.count))[0] ?? null
  const drifted = dominant
    ? activeRows.filter(
        (row) => row.buildId !== dominant.buildId || row.sdkVersion !== dominant.sdkVersion,
      ).length
    : 0
  return {
    total: rows.length,
    online: rows.filter((row) => row.status === 'ONLINE').length,
    draining: rows.filter((row) => row.status === 'DRAINING').length,
    offline: rows.filter((row) => row.status === 'OFFLINE' || row.status === 'DECOMMISSIONED')
      .length,
    versions: summary.length,
    dominantBuild: dominant?.buildId || '—',
    dominantSdk: dominant?.sdkVersion || '—',
    drifted,
  }
}
