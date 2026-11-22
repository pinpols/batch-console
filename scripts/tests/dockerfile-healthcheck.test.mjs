// 用途：锁定容器 HEALTHCHECK 为 JSON exec 形式，并在运行时展开 NGINX_PORT。
// 用法：在仓库根目录执行 node --test scripts/tests/dockerfile-healthcheck.test.mjs。
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const dockerfileUrl = new URL('../../Dockerfile', import.meta.url)

export function parseHealthcheckArgv(dockerfile) {
  const lines = dockerfile.split('\n')
  const start = lines.findIndex((line) => line.trimStart().startsWith('HEALTHCHECK'))
  assert.ok(start >= 0, 'Dockerfile 必须声明 HEALTHCHECK')
  const block = []
  for (let index = start; index < lines.length; index += 1) {
    block.push(lines[index])
    if (!lines[index].trimEnd().endsWith('\\')) break
  }
  const text = block.join('\n')
  assert.doesNotMatch(text, /hadolint ignore=DL3025/, '不能用忽略注释压掉 DL3025')
  const command = text.match(/\bCMD\s+(\[[\s\S]*\])\s*$/)
  assert.ok(command, 'HEALTHCHECK 必须使用 JSON exec 形式')
  const argv = JSON.parse(command[1])
  assert.ok(
    Array.isArray(argv) && argv.length > 0 && argv.every((item) => typeof item === 'string'),
    'HEALTHCHECK JSON 必须是非空字符串数组',
  )
  return argv
}

function runArgv(argv, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(argv[0], argv.slice(1), {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', reject)
    child.on('close', (code) => resolve({ code, stdout, stderr }))
  })
}

function listen(handler) {
  const server = createServer(handler)
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      assert.ok(address && typeof address === 'object')
      resolve({ server, port: address.port })
    })
  })
}

test('HEALTHCHECK 使用 JSON，并按运行时 NGINX_PORT 访问 /healthz', async () => {
  const dockerfile = await readFile(dockerfileUrl, 'utf8')
  const argv = parseHealthcheckArgv(dockerfile)
  const script = argv.join('\n')
  assert.match(script, /\$\{NGINX_PORT\}/)
  assert.match(script, /curl\b/)
  assert.match(script, /\/healthz/)
  assert.match(dockerfile, /^USER batch:batch$/m)

  const { server, port } = await listen((request, response) => {
    if (request.url === '/healthz') {
      response.writeHead(200, { 'content-type': 'text/plain' })
      response.end('ok\n')
      return
    }
    response.writeHead(404)
    response.end()
  })
  const closed = await listen((_request, response) => {
    response.writeHead(500)
    response.end()
  })
  await new Promise((resolve, reject) =>
    closed.server.close((error) => (error ? reject(error) : resolve())),
  )
  try {
    const healthy = await runArgv(argv, { NGINX_PORT: String(port) })
    assert.equal(healthy.code, 0, healthy.stderr)
    assert.equal(healthy.stdout, 'ok\n')

    const wrongPort = await runArgv(argv, { NGINX_PORT: String(closed.port) })
    assert.notEqual(wrongPort.code, 0, '端口不匹配时健康检查必须失败，证明命令没有写死端口')
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  }
})
