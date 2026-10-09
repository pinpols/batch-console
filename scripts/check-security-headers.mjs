const baseUrl = process.env.FRONTEND_BASE_URL

if (!baseUrl) {
  throw new Error('FRONTEND_BASE_URL is required')
}

const origin = new URL(baseUrl)
if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password) {
  throw new Error('FRONTEND_BASE_URL must be an HTTP(S) URL without embedded credentials')
}

function parseDirectives(value) {
  return new Map(
    value
      .split(';')
      .map((part) => part.trim().split(/\s+/))
      .filter(([name]) => name)
      .map(([name, ...values]) => [name.toLowerCase(), values.map((item) => item.toLowerCase())]),
  )
}

function includesDirective(directives, name, requiredValue) {
  return directives.get(name)?.includes(requiredValue) ?? false
}

function assertHeaders(response, path) {
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`)
  if (new URL(response.url).origin !== origin.origin) {
    throw new Error(`${path} redirected outside the configured origin`)
  }

  const headers = response.headers
  const required = [
    ['x-content-type-options', 'nosniff'],
    ['x-frame-options', /^(deny|sameorigin)$/i],
    ['referrer-policy', 'strict-origin-when-cross-origin'],
    ['permissions-policy', /geolocation=\(\).*camera=\(\)/i],
  ]

  for (const [name, expected] of required) {
    const value = headers.get(name)
    if (
      !value ||
      (typeof expected === 'string' ? value.toLowerCase() !== expected : !expected.test(value))
    ) {
      throw new Error(`${path} is missing the expected ${name} response header`)
    }
  }

  const csp = headers.get('content-security-policy')
  if (!csp) throw new Error(`${path} is missing the Content-Security-Policy response header`)
  const directives = parseDirectives(csp)
  const requiredCsp = [
    ['default-src', "'self'"],
    ['base-uri', "'self'"],
    ['object-src', "'none'"],
    ['frame-ancestors', "'self'"],
    ['form-action', "'self'"],
    ['script-src', "'self'"],
  ]
  for (const [name, value] of requiredCsp) {
    if (!includesDirective(directives, name, value)) {
      throw new Error(`${path} has an unexpected Content-Security-Policy ${name} directive`)
    }
  }

  if (new URL(response.url).protocol === 'https:') {
    const hsts = headers.get('strict-transport-security')
    if (!hsts || !/max-age=[1-9]\d*/i.test(hsts)) {
      throw new Error(`${path} is missing a valid Strict-Transport-Security response header`)
    }
  }
}

for (const path of ['/', '/login', '/healthz']) {
  const url = new URL(path, origin)
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(10_000),
  })
  assertHeaders(response, path)
  console.log(`[security-headers] PASS ${path} HTTP ${response.status}`)
}
