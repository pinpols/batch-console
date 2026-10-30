import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, writeFile, chmod, rm, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const root = fileURLToPath(new URL('../../', import.meta.url))
const portInContainer = 8080
const upstreamPort = 18081
const spaMarker = 'WDI_ROUTING_SPA'
const docsMarker = 'WDI_ROUTING_DOCS'

async function docker(args) {
  const { stdout } = await exec('docker', args, { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 })
  return stdout.trim()
}

async function removeOwnedContainer(name, owner) {
  let registeredOwner
  try {
    registeredOwner = await docker([
      'inspect',
      '--format',
      '{{ index .Config.Labels "wdi.nginx-routing-owner" }}',
      name,
    ])
  } catch (error) {
    if (/No such (object|container)/i.test(error.stderr ?? '')) return
    throw error
  }
  assert.equal(registeredOwner, owner, '仅清理本例创建的容器')
  await docker(['rm', '-f', name])
}

test('真实Nginx保留前端路由，并按静态制品存在性返回状态', { timeout: 180_000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'wdi-nginx-routing-'))
  const owner = `${process.pid}-${basename(directory)}`
  const container = `wdi-nginx-routing-${owner}`
  try {
    // 使用Dockerfile声明的不可变基础镜像和仓库配置；不启动或写入共享应用环境。
    const dockerfile = await readFile(join(root, 'Dockerfile'), 'utf8')
    const image = dockerfile.match(/^FROM (nginx:\S+@sha256:[a-f0-9]{64}) AS runtime$/m)?.[1]
    assert.ok(image, 'Dockerfile必须声明带摘要的Nginx运行镜像')
    t.diagnostic(`Nginx镜像: ${image}`)
    await chmod(directory, 0o755)
    await mkdir(join(directory, 'html/assets'), { recursive: true })
    await mkdir(join(directory, 'html/icons'), { recursive: true })
    await mkdir(join(directory, 'docs'), { recursive: true })
    await writeFile(
      join(directory, 'html/index.html'),
      `<!doctype html><title>${spaMarker}</title>`,
    )
    await writeFile(join(directory, 'html/assets/present.js'), 'export const ready = true;')
    await writeFile(join(directory, 'html/icons/present.png'), 'PNG-FIXTURE')
    await writeFile(join(directory, 'html/manifest.webmanifest'), '{"name":"WDI_ROUTING_MANIFEST"}')
    await writeFile(
      join(directory, 'docs/index.html'),
      `<!doctype html><title>${docsMarker}</title>`,
    )
    const template = await readFile(join(root, 'nginx/default.conf.template'), 'utf8')
    const rendered = template
      .replaceAll('${NGINX_PORT}', String(portInContainer))
      .replaceAll('${BACKEND_UPSTREAM_HOST}', `127.0.0.1:${upstreamPort}`)
    await writeFile(join(directory, 'default.conf'), rendered)
    // 鉴权替身只支撑文档路由检查，不能作为真实登录或权限验收。
    await writeFile(
      join(directory, 'backend.conf'),
      `server {
      listen 127.0.0.1:${upstreamPort};
      location = /api/console/auth/check { return 204; }
      location / { return 404; }
    }`,
    )
    const args = [
      'run',
      '-d',
      '--name',
      container,
      '--label',
      `wdi.nginx-routing-owner=${owner}`,
      '-p',
      `127.0.0.1::${portInContainer}`,
    ]
    const mounts = [
      [join(root, 'nginx/nginx.conf'), '/etc/nginx/nginx.conf'],
      [join(root, 'nginx/snippets'), '/etc/nginx/snippets'],
      [join(directory, 'default.conf'), '/etc/nginx/conf.d/default.conf'],
      [join(directory, 'backend.conf'), '/etc/nginx/conf.d/backend.conf'],
      [join(directory, 'html'), '/usr/share/nginx/html'],
      [join(directory, 'docs'), '/var/www/batch-docs'],
    ]
    for (const [source, target] of mounts) {
      args.push('--mount', `type=bind,src=${source},target=${target},readonly`)
    }
    args.push(image)
    await docker(args)
    const binding = await docker(['port', container, `${portInContainer}/tcp`])
    const port = binding.match(/^127\.0\.0\.1:(\d+)$/)?.[1]
    assert.ok(port, '本例仅发布随机本机回环端口')
    const baseUrl = `http://127.0.0.1:${port}`
    const request = (path) =>
      fetch(`${baseUrl}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(3000) })
    const deadline = Date.now() + 10_000
    while (true) {
      try {
        const response = await request('/healthz')
        await response.text()
        if (response.status === 200) break
      } catch {
        // 仅等待本例新容器监听；超时后保留实际容器日志作为诊断。
      }
      if (Date.now() >= deadline) throw new Error(await docker(['logs', container]))
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    await docker(['exec', container, 'nginx', '-t'])
    const cases = [
      ['/healthz', 200, 'ok'],
      ['/workflow/example', 200, spaMarker],
      ['/assets/present.js', 200, 'export const ready'],
      ['/icons/present.png', 200, 'PNG-FIXTURE'],
      ['/assets/missing.js', 404],
      ['/fonts/missing.woff2', 404],
      ['/img/missing.png', 404],
      ['/icons/missing.png', 404],
      ['/version.json', 404],
      ['/docs/', 200, docsMarker],
      ['/docs/missing', 404],
      ['/api/missing', 404],
      ['/docs', 301],
      ['/manifest.webmanifest', 200, 'WDI_ROUTING_MANIFEST'],
      ['/manifest.webmanifest', 404],
    ]
    for (const [path, expected, marker] of cases) {
      await t.test(`${path} 返回 ${expected}`, async () => {
        if (path === '/manifest.webmanifest' && expected === 404) {
          await unlink(join(directory, 'html/manifest.webmanifest'))
        }
        const response = await request(path)
        const body = await response.text()
        assert.equal(response.status, expected, `${path} 的HTTP状态`)
        if (marker) assert.ok(body.includes(marker), `${path} 的制品内容`)
        if (expected === 404) {
          assert.ok(!body.includes(spaMarker), '缺失制品不能返回SPA入口')
          assert.ok(
            !response.headers.get('cache-control')?.includes('immutable'),
            '错误响应不能按不可变资源缓存',
          )
        }
        if (path === '/docs') assert.equal(response.headers.get('location'), '/docs/')
        if (
          path === '/icons/present.png' ||
          (path === '/manifest.webmanifest' && expected === 200)
        ) {
          assert.ok(
            response.headers.get('cache-control')?.includes('no-cache'),
            '固定名称资源保留更新校验',
          )
        }
      })
    }
  } finally {
    // 清理先核对本例标签；失败时保留临时挂载来源，便于诊断和后续精确清理。
    await removeOwnedContainer(container, owner)
    await rm(directory, { recursive: true, force: true })
  }
})
