type SummaryTranslator = (key: string, params: Record<string, unknown>) => string

export function createOpsDiagnosticSummaries(translate: SummaryTranslator) {
  // ──────────────────────────────────────────────
  // 摘要工具(保留原有 summary 函数)
  // ──────────────────────────────────────────────
  type Obj = Record<string, unknown>
  const ok = (s: string | number) => `<strong style="color:var(--color-success)">${s}</strong>`
  const bad = (s: string | number) => `<strong style="color:var(--color-danger)">${s}</strong>`
  const dim = (s: string | number) => `<span style="color:var(--color-text-tertiary)">${s}</span>`
  const n = (v: unknown) => (typeof v === 'number' ? v : 0)
  const SEP = ' &nbsp;·&nbsp; '
  const tx = (k: string, p?: Record<string, unknown>) => translate(`opsDiagnostic.${k}`, p ?? {})

  function summarizeOutbox(data: unknown): string {
    if (!data || typeof data !== 'object') return ''
    const d = data as Obj
    const breakdown = Array.isArray(d.statusBreakdown) ? (d.statusBreakdown as Obj[]) : []
    const total = breakdown.reduce((s, x) => s + n(x.count), 0)
    const failedBreakdown = breakdown.filter((x) => {
      const publishStatus = String(x.publishStatus ?? '')
      return /FAIL|ERROR|GIVE_UP/i.test(publishStatus)
    })
    const failed = failedBreakdown.reduce((s, x) => s + n(x.count), 0)
    const pendingBreakdown = breakdown.filter((x) => {
      const publishStatus = String(x.publishStatus ?? '')
      return /PENDING|NEW|PUBLISHING/i.test(publishStatus)
    })
    const pending = pendingBreakdown.reduce((s, x) => s + n(x.count), 0)
    const totalLabel = tx('sumTotal', { n: total })
    const pendingLabel = tx('sumPendingOrPublishing')
    const pendingDisplay = pending > 0 ? bad(pending) : ok(0)
    const failedLabel = tx('sumFailedOrAbandoned')
    const failedDisplay = failed > 0 ? bad(failed) : ok(0)
    return [
      totalLabel,
      `${pendingLabel} ${pendingDisplay}`,
      `${failedLabel} ${failedDisplay}`,
    ].join(SEP)
  }

  function summarizeCluster(data: unknown): string {
    if (!data || typeof data !== 'object') return ''
    const d = data as Obj
    const sl = (d.shedLock as Obj) ?? {}
    const wk = (d.workers as Obj) ?? {}
    const ob = (d.outbox as Obj) ?? {}
    const parts: string[] = []
    const activeLockLabel = tx('sumShedLockActive')
    const activeLockCount = n(sl.activeLocks)
    const activeLockDisplay = ok(activeLockCount)
    const totalLockCount = n(sl.totalLocks)
    parts.push(`${activeLockLabel} ${activeLockDisplay}/${totalLockCount}`)
    const wkIssues =
      n(wk.staleOnlineWorkers) +
      n(wk.drainingPastDeadlineWorkers) +
      n(wk.decommissionedWorkersWithActiveTasks) +
      n(wk.invalidCapabilityTags)
    if (wkIssues > 0) {
      const healthyWorkerLabel = tx('sumWorkerHealthy')
      const onlineWorkerCount = n(wk.onlineWorkers)
      const onlineWorkerDisplay = ok(onlineWorkerCount)
      const abnormalWorkerLabel = tx('sumWorkerAbnormal')
      const abnormalWorkerDisplay = bad(wkIssues)
      parts.push(
        `${healthyWorkerLabel} ${onlineWorkerDisplay} · ${abnormalWorkerLabel} ${abnormalWorkerDisplay}`,
      )
    } else {
      const healthyWorkerLabel = tx('sumWorkerHealthy')
      const onlineWorkerCount = n(wk.onlineWorkers)
      const onlineWorkerDisplay = ok(onlineWorkerCount)
      parts.push(`${healthyWorkerLabel} ${onlineWorkerDisplay}`)
    }
    if (wk.healthy === false && n(wk.onlineWorkers) === 0 && n(wk.runningInstances) > 0) {
      parts.push(bad(tx('sumWorkerUnavailable')))
    }
    const obIssues = n(ob.pendingEvents) + n(ob.stalePublishingEvents)
    if (obIssues > 0) {
      const pendingOutboxLabel = tx('sumOutboxPending')
      const pendingOutboxDisplay = bad(obIssues)
      parts.push(`${pendingOutboxLabel} ${pendingOutboxDisplay}`)
    } else {
      const healthyOutboxLabel = tx('sumOutboxOk')
      const healthyOutboxDisplay = ok(healthyOutboxLabel)
      parts.push(healthyOutboxDisplay)
    }
    return parts.join(SEP)
  }

  function summarizeWorker(data: unknown): string {
    if (!data || typeof data !== 'object') return ''
    const d = data as Obj
    const online = n(d.onlineWorkers)
    const stale = n(d.staleOnlineWorkers)
    const drainingOverdue = n(d.drainingPastDeadlineWorkers)
    const decomActive = n(d.decommissionedWorkersWithActiveTasks)
    const invalidTags = n(d.invalidCapabilityTags)
    const draining = n(d.drainingWorkers)
    const running = n(d.runningInstances)
    const onlineLabel = tx('sumOnline')
    const onlineDisplay = ok(online)
    const parts: string[] = [`${onlineLabel} ${onlineDisplay}`]
    if (draining > 0) {
      const drainingLabel = tx('sumDraining')
      const drainingDisplay = dim(draining)
      parts.push(`${drainingLabel} ${drainingDisplay}`)
    }
    if (running > 0) {
      const runningLabel = tx('sumRunning')
      const runningDisplay = dim(running)
      parts.push(`${runningLabel} ${runningDisplay}`)
    }
    const issues: string[] = []
    if (d.healthy === false && online === 0 && running > 0) {
      issues.push(bad(tx('sumWorkerUnavailable')))
    }
    if (stale > 0) {
      const staleLabel = tx('sumStaleHeartbeat')
      const staleDisplay = bad(stale)
      issues.push(`${staleLabel} ${staleDisplay}`)
    }
    if (drainingOverdue > 0) {
      const drainingOverdueLabel = tx('sumDrainingOverdue')
      const drainingOverdueDisplay = bad(drainingOverdue)
      issues.push(`${drainingOverdueLabel} ${drainingOverdueDisplay}`)
    }
    if (decomActive > 0) {
      const decommissionedLabel = tx('sumDecomActive')
      const decommissionedDisplay = bad(decomActive)
      issues.push(`${decommissionedLabel} ${decommissionedDisplay}`)
    }
    if (invalidTags > 0) {
      const invalidTagsLabel = tx('sumInvalidTags')
      const invalidTagsDisplay = bad(invalidTags)
      issues.push(`${invalidTagsLabel} ${invalidTagsDisplay}`)
    }
    if (issues.length === 0) {
      const consistencyLabel = tx('sumConsistencyOk')
      const consistencyDisplay = ok('✓')
      parts.push(`${consistencyLabel} ${consistencyDisplay}`)
    } else {
      parts.push(...issues)
    }
    return parts.join(SEP)
  }

  function summarizeOutboxHealth(data: unknown): string {
    if (!data || typeof data !== 'object') return ''
    const d = data as Obj
    const pending = n(d.pendingEvents)
    const active = n(d.activeEvents)
    const stale = n(d.stalePublishingEvents)
    const pendingLabel = tx('sumPending')
    const pendingDisplay = pending > 0 ? bad(pending) : ok(0)
    const activeLabel = tx('sumActive')
    const activeDisplay = dim(active)
    const stuckLabel = tx('sumStuck')
    const stuckDisplay = stale > 0 ? bad(stale) : ok(0)
    return [
      `${pendingLabel} ${pendingDisplay}`,
      `${activeLabel} ${activeDisplay}`,
      `${stuckLabel} ${stuckDisplay}`,
    ].join(SEP)
  }

  function summarizeTerminalChildrenHealth(data: unknown): string {
    if (!data || typeof data !== 'object') return ''
    const summary = data as Obj
    const activeChildInstances = n(summary.terminalInstancesWithActiveChildren)
    const healthLabel = summary.healthy === true ? tx('sumConsistencyOk') : tx('sumInconsistent')
    const countLabel = tx('sumTerminalChildren', { n: activeChildInstances })
    return `${healthLabel} · ${countLabel}`
  }

  return {
    summarizeOutbox,
    summarizeCluster,
    summarizeWorker,
    summarizeOutboxHealth,
    summarizeTerminalChildrenHealth,
  }
}
