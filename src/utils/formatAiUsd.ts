export function formatAiUsd(value: number): string {
  if (value === 0 || Math.abs(value) >= 0.01) return value.toFixed(2)
  if (value > 0 && value < 0.000001) return '<0.000001'
  return value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')
}
