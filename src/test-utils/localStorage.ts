import { vi } from 'vitest'

export function stubLocalStorage() {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, String(value)),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  } satisfies Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'>)

  return values
}
