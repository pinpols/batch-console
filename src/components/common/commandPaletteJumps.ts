export type CommandPaletteJump = {
  kind: 'job' | 'file' | 'trace'
  value: string
  path: string
}

export function parseCommandPaletteJump(raw: string): CommandPaletteJump | null {
  const term = raw.trim()
  const prefixed = /^(job|file|trace)\s*:\s*(.+)$/i.exec(term)
  if (prefixed) {
    const kind = prefixed[1].toLowerCase() as CommandPaletteJump['kind']
    const value = prefixed[2].trim()
    if ((kind === 'job' || kind === 'file') && !/^\d+$/.test(value)) return null
    if (kind === 'trace' && !/^[a-z0-9._:-]{8,128}$/i.test(value)) return null
    return {
      kind,
      value,
      path:
        kind === 'job'
          ? `/monitor/job-instances/${value}`
          : kind === 'file'
            ? `/files/list?fileId=${encodeURIComponent(value)}`
            : `/observability/trace?traceId=${encodeURIComponent(value)}`,
    }
  }
  if (/^\d+$/.test(term)) {
    return { kind: 'job', value: term, path: `/monitor/job-instances/${term}` }
  }
  if (/^[a-f0-9]{16,64}$/i.test(term)) {
    return {
      kind: 'trace',
      value: term,
      path: `/observability/trace?traceId=${encodeURIComponent(term)}`,
    }
  }
  return null
}
