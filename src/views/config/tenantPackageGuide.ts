import type { TenantPackageSampleScenario } from '@/api/tenantPackageExcel'

export function guideMatchesScenario(
  appliesTo: string[],
  scenario: TenantPackageSampleScenario,
): boolean {
  if (scenario === 'ALL') return true

  const category = scenario.startsWith('IMPORT_')
    ? 'IMPORT'
    : scenario.startsWith('EXPORT_')
      ? 'EXPORT'
      : scenario
  const tokens = appliesTo
    .join(' ')
    .toUpperCase()
    .split(/[^A-Z0-9_]+/)
    .filter(Boolean)

  return tokens.includes('ALL') || tokens.includes(category)
}
