let fallbackCounter = 0

/** 为控制台写接口生成幂等键，详见 console-api-protocol。 */
export function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  fallbackCounter = (fallbackCounter + 1) % 0x7fffffff
  const timestamp = Date.now()
  const randomValue = Math.random()
  const randomText = randomValue.toString(36)
  const randomSuffix = randomText.slice(2, 12)
  return `${timestamp}-${fallbackCounter}-${randomSuffix}`
}
