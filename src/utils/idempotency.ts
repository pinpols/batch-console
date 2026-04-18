let fallbackCounter = 0

/** Per-request idempotency key for console write APIs (see console-api-protocol). */
export function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  fallbackCounter = (fallbackCounter + 1) % 0x7fffffff
  return `${Date.now()}-${fallbackCounter}-${Math.random().toString(36).slice(2, 12)}`
}
