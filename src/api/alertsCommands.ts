import { post } from '@/api/client'
import type { components } from '@/types/api.generated'

export type AlertActionRequest = components['schemas']['AlertActionRequest']
export type ConsoleAlertActionResponse = components['schemas']['ConsoleAlertActionResponse']

function actionUrl(alertId: number, suffix: 'ack' | 'silence' | 'close') {
  return `/api/console/alerts/${alertId}/${suffix}`
}

export function acknowledgeAlert(alertId: number, body: AlertActionRequest) {
  return post<ConsoleAlertActionResponse>(actionUrl(alertId, 'ack'), body)
}

export function silenceAlert(alertId: number, body: AlertActionRequest) {
  return post<ConsoleAlertActionResponse>(actionUrl(alertId, 'silence'), body)
}

export function closeAlert(alertId: number, body: AlertActionRequest) {
  return post<ConsoleAlertActionResponse>(actionUrl(alertId, 'close'), body)
}
