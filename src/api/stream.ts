/**
 * Log / status streaming — add endpoint to console-api OpenAPI, then wire URL here.
 */
export function createLogStream(
  _instanceId: number,
  _onMessage: (log: string) => void,
  _onError?: (e: Event) => void,
): EventSource {
  const token = localStorage.getItem('token') ?? ''
  const base =
    typeof import.meta.env.VITE_API_BASE_URL === 'string' ? import.meta.env.VITE_API_BASE_URL : ''
  const url = `${base}/api/console/instances/${_instanceId}/logs/stream?token=${encodeURIComponent(token)}`
  const es = new EventSource(url)
  es.onmessage = (e) => _onMessage(e.data)
  es.onerror = (e) => {
    _onError?.(e)
    es.close()
  }
  return es
}
