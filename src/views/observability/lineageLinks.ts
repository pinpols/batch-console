/**
 * 作业产出的结果版本业务键，格式由后端 result_version 约定（`job:{jobCode}:{bizDate}`）。
 */
export function jobResultBusinessKey(jobCode: string, bizDate: string): string {
  return `job:${jobCode}:${bizDate}`
}

/** 作业实例链到血缘证据页；缺作业编码或业务日时无法定位结果版本，不给链接。 */
export function jobLineageEvidenceLink(jobCode?: string | null, bizDate?: string | null) {
  if (!jobCode || !bizDate) return null
  const businessKey = encodeURIComponent(jobResultBusinessKey(jobCode, bizDate))
  return `/observability/lineage?businessKey=${businessKey}`
}
