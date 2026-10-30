export type SlaAttainmentJob = {
  jobCode?: string
  jobName?: string | null
  slaOnTime?: number
  slaTotalWithSla?: number
}

export function slaAttainmentRows(
  rows: SlaAttainmentJob[],
): Array<{ name: string; value: number }> {
  return rows.flatMap((row) => {
    const totalWithSla = Number(row.slaTotalWithSla) || 0
    if (totalWithSla <= 0) return []
    const onTime = Number(row.slaOnTime) || 0
    return [
      {
        name: row.jobName || row.jobCode || '-',
        value: Math.round((onTime / totalWithSla) * 1000) / 10,
      },
    ]
  })
}
