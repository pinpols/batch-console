const defaults = require('./test-config.json')

const isStagingTarget = process.env.E2E_TARGET_ENV === 'staging'
const frontendBaseUrl =
  process.env.E2E_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || defaults.frontendBaseUrl
const apiBaseUrl = process.env.BC_API_BASE || (isStagingTarget ? '' : defaults.apiBaseUrl)

function validateStagingTarget() {
  if (!isStagingTarget) return

  for (const [name, value] of [
    ['E2E_BASE_URL/PLAYWRIGHT_BASE_URL', frontendBaseUrl],
    ['BC_API_BASE', apiBaseUrl],
    ['E2E_USERNAME', process.env.E2E_USERNAME],
    ['E2E_PASSWORD', process.env.E2E_PASSWORD],
  ]) {
    if (!value) throw new Error(`[staging-e2e] ${name} must be explicitly configured`)
  }

  for (const [name, value] of [
    ['frontend', frontendBaseUrl],
    ['API', apiBaseUrl],
  ]) {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error(`[staging-e2e] ${name} URL must use HTTP(S)`)
    }
    const hostname = url.hostname
      .replace(/^\[|\]$/g, '')
      .toLowerCase()
      .replace(/\.$/, '')
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname === '::1' ||
      hostname === '0.0.0.0' ||
      hostname === '::' ||
      /^127(?:\.\d{1,3}){3}$/.test(hostname)
    ) {
      throw new Error(`[staging-e2e] ${name} URL must not target loopback`)
    }
  }
}

validateStagingTarget()

module.exports = {
  FRONTEND_BASE_URL: frontendBaseUrl,
  FRONTEND_ORIGIN: new URL(frontendBaseUrl).origin,
  API_BASE_URL: apiBaseUrl,
  ORCHESTRATOR_BASE_URL: process.env.BATCH_ORCHESTRATOR_BASE_URL || defaults.orchestratorBaseUrl,
  MOCKSERVER_BASE_URL: process.env.MOCKSERVER_BASE_URL || defaults.mockServerBaseUrl,
  PROMETHEUS_BASE_URL: process.env.E2E_PROMETHEUS_URL || defaults.prometheusBaseUrl,
  ALERTMANAGER_BASE_URL: process.env.E2E_ALERTMANAGER_URL || defaults.alertmanagerBaseUrl,
}
