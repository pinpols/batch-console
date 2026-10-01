let fallbackCounter = 0

/** 为控制台写接口生成幂等键，详见 console-api-protocol。 */
export function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  fallbackCounter = (fallbackCounter + 1) % 0x7fffffff
  return `${Date.now()}-${fallbackCounter}-${Math.random().toString(36).slice(2, 12)}`
}
