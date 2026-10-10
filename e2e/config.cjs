const defaults = require('./test-config.json')

const frontendBaseUrl = process.env.E2E_BASE_URL || defaults.frontendBaseUrl

module.exports = {
  FRONTEND_BASE_URL: frontendBaseUrl,
  FRONTEND_ORIGIN: new URL(frontendBaseUrl).origin,
  API_BASE_URL: process.env.BC_API_BASE || defaults.apiBaseUrl,
  ORCHESTRATOR_BASE_URL: process.env.BATCH_ORCHESTRATOR_BASE_URL || defaults.orchestratorBaseUrl,
  MOCKSERVER_BASE_URL: process.env.MOCKSERVER_BASE_URL || defaults.mockServerBaseUrl,
  PROMETHEUS_BASE_URL: process.env.E2E_PROMETHEUS_URL || defaults.prometheusBaseUrl,
  ALERTMANAGER_BASE_URL: process.env.E2E_ALERTMANAGER_URL || defaults.alertmanagerBaseUrl,
}
