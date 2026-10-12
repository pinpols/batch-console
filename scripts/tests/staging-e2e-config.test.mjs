import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

const configPath = new URL('../../e2e/config.cjs', import.meta.url).pathname
const playwrightConfigPath = new URL('../../playwright.config.cjs', import.meta.url).pathname

function loadConfig(env) {
  return spawnSync(
    process.execPath,
    [
      '-e',
      `try { const config = require(${JSON.stringify(configPath)}); process.stdout.write(JSON.stringify(config)) } catch (error) { process.stderr.write(error.message); process.exit(1) }`,
    ],
    { encoding: 'utf8', env: { ...process.env, ...env } },
  )
}

function loadPlaywrightConfig(env) {
  return spawnSync(
    process.execPath,
    [
      '-e',
      `try { const config = require(${JSON.stringify(playwrightConfigPath)}); process.stdout.write(JSON.stringify({ webServer: config.webServer })) } catch (error) { process.stderr.write(error.message); process.exit(1) }`,
    ],
    { encoding: 'utf8', env: { ...process.env, ...env } },
  )
}

test('staging E2E rejects missing explicit API target and credentials', () => {
  const result = loadConfig({
    E2E_TARGET_ENV: 'staging',
    E2E_BASE_URL: 'https://console.staging.example.test',
    BC_API_BASE: '',
    E2E_USERNAME: '',
    E2E_PASSWORD: '',
  })

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /BC_API_BASE must be explicitly configured/)
})

test('staging E2E rejects loopback instead of falling back to local defaults', () => {
  const result = loadConfig({
    E2E_TARGET_ENV: 'staging',
    E2E_BASE_URL: 'https://console.staging.example.test',
    BC_API_BASE: 'http://127.0.0.1:18080',
    E2E_USERNAME: 'staging-user',
    E2E_PASSWORD: 'secret',
  })

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /API URL must not target loopback/)
})

test('staging E2E rejects IPv6 and alternate IPv4 loopback targets', () => {
  for (const apiUrl of [
    'http://[::1]:18080',
    'http://127.0.0.2:18080',
    'http://localhost.:18080',
  ]) {
    const result = loadConfig({
      E2E_TARGET_ENV: 'staging',
      E2E_BASE_URL: 'https://console.staging.example.test',
      BC_API_BASE: apiUrl,
      E2E_USERNAME: 'staging-user',
      E2E_PASSWORD: 'secret',
    })

    assert.notEqual(result.status, 0, `${apiUrl} must be rejected`)
    assert.match(result.stderr, /API URL must not target loopback/)
  }
})

test('staging E2E rejects missing credentials before global setup', () => {
  const result = loadConfig({
    E2E_TARGET_ENV: 'staging',
    E2E_BASE_URL: 'https://console.staging.example.test',
    BC_API_BASE: 'https://api.staging.example.test',
    E2E_USERNAME: '',
    E2E_PASSWORD: '',
  })

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /E2E_USERNAME must be explicitly configured/)
})

test('staging E2E uses explicit frontend and API targets', () => {
  const result = loadConfig({
    E2E_TARGET_ENV: 'staging',
    E2E_BASE_URL: 'https://console.staging.example.test',
    PLAYWRIGHT_BASE_URL: 'http://localhost:5173',
    BC_API_BASE: 'https://api.staging.example.test',
    E2E_USERNAME: 'staging-user',
    E2E_PASSWORD: 'secret',
  })

  assert.equal(result.status, 0, result.stderr)
  const config = JSON.parse(result.stdout)
  assert.equal(config.FRONTEND_BASE_URL, 'https://console.staging.example.test')
  assert.equal(config.API_BASE_URL, 'https://api.staging.example.test')
})

test('PLAYWRIGHT_BASE_URL remains a supported frontend URL alias', () => {
  const result = loadConfig({
    E2E_TARGET_ENV: '',
    E2E_BASE_URL: '',
    PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:5178',
    BC_API_BASE: 'http://127.0.0.1:18089',
  })

  assert.equal(result.status, 0, result.stderr)
  const config = JSON.parse(result.stdout)
  assert.equal(config.FRONTEND_BASE_URL, 'http://127.0.0.1:5178')
})

test('staging Playwright does not start a local Vite server', () => {
  const result = loadPlaywrightConfig({
    E2E_TARGET_ENV: 'staging',
    E2E_BASE_URL: 'https://console.staging.example.test',
    BC_API_BASE: 'https://api.staging.example.test',
    E2E_USERNAME: 'staging-user',
    E2E_PASSWORD: 'secret',
  })

  assert.equal(result.status, 0, result.stderr)
  assert.equal(JSON.parse(result.stdout).webServer, undefined)
})
