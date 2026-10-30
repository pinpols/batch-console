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
  const applicabilityText = appliesTo.join(' ')
  const normalizedApplicabilityText = applicabilityText.toUpperCase()
  const applicabilityParts = normalizedApplicabilityText.split(/[^A-Z0-9_]+/)
  const tokens = applicabilityParts.filter(Boolean)

  return tokens.includes('ALL') || tokens.includes(category)
}
