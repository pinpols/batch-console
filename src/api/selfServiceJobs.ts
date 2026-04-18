import { post } from '@/api/client'

/** POST /api/console/self-service/jobs/rerun-request */
export function selfServiceRerunRequest(body: {
  tenantId: string
  jobCode: string
  bizDate: string
  targetInstanceNo?: string
  reason?: string
}) {
  return post<string>('/api/console/self-service/jobs/rerun-request', body)
}

/** POST /api/console/self-service/jobs/compensation-request */
export function selfServiceCompensationRequest(body: {
  tenantId: string
  jobCode: string
  bizDate: string
  compensationType?: string
  targetInstanceNo?: string
  reason?: string
}) {
  return post<string>('/api/console/self-service/jobs/compensation-request', body)
}
