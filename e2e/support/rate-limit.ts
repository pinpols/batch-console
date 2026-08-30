import { spawnSync } from 'node:child_process'

const REDIS_CONTAINER =
  process.env.REDIS_CONTAINER || process.env.VALKEY_CONTAINER || 'batch-valkey'

export function clearConsoleRateLimitKeys() {
  const scan = spawnSync(
    'docker',
    ['exec', REDIS_CONTAINER, 'redis-cli', '--raw', 'KEYS', 'rate_limit:*'],
    { encoding: 'utf8' },
  )
  if (scan.status !== 0) return

  const keys = scan.stdout
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
  if (keys.length === 0) return

  spawnSync('docker', ['exec', REDIS_CONTAINER, 'redis-cli', 'DEL', ...keys], {
    encoding: 'utf8',
  })
}
