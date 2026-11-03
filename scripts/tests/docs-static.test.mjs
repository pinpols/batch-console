import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { docsStaticMiddleware } from '../lib/docs-static.mjs'

let root, server, base
before(async () => {
  root = await mkdtemp(join(tmpdir(), 'batch-docs-static-'))
  await mkdir(join(root, 'frontend'), { recursive: true })
  await mkdir(join(root, 'backend'), { recursive: true })
  await mkdir(join(root, 'assets'), { recursive: true })
  await mkdir(join(root, 'backend', 'gallery'), { recursive: true })
  await writeFile(join(root, 'index.html'), 'docs home')
  await writeFile(join(root, 'frontend', 'index.html'), 'frontend docs')
  await writeFile(join(root, 'backend', 'guide.html'), 'backend guide')
  await writeFile(join(root, 'backend', 'gallery.html'), 'gallery page')
  await writeFile(join(root, 'backend', 'gallery', 'figure.svg'), '<svg/>')
  await writeFile(join(root, 'assets', 'theme.js'), 'export default 1')
  const serve = docsStaticMiddleware(root)
  server = createServer((req, res) => serve(req, res, () => res.end('spa home')))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})
after(async () => {
  await new Promise((resolve) => server.close(resolve))
  await rm(root, { recursive: true, force: true })
})

test('same origin docs home, directory, clean URL and static JS', async () => {
  for (const [path, content, mime] of [
    ['/docs/', 'docs home', 'text/html'],
    ['/docs/frontend/', 'frontend docs', 'text/html'],
    ['/docs/backend/guide?x=1', 'backend guide', 'text/html'],
    ['/docs/assets/theme.js', 'export default 1', 'text/javascript'],
  ]) {
    const response = await fetch(base + path)
    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type'), new RegExp(mime))
    assert.equal(await response.text(), content)
  }
})
test('clean URL prefers same-name HTML page over asset directory', async () => {
  const response = await fetch(base + '/docs/backend/gallery?theme=dark', { redirect: 'manual' })
  assert.equal(response.status, 200)
  assert.equal(await response.text(), 'gallery page')
  const head = await fetch(base + '/docs/backend/gallery?theme=dark', {
    method: 'HEAD',
    redirect: 'manual',
  })
  assert.equal(head.status, 200)
  assert.equal(head.headers.get('content-type'), 'text/html; charset=utf-8')
  assert.equal(await head.text(), '')
  const asset = await fetch(base + '/docs/backend/gallery/figure.svg')
  assert.equal(asset.status, 200)
  assert.equal(await asset.text(), '<svg/>')
  assert.equal((await fetch(base + '/docs/backend/gallery/')).status, 404)
})

test('directory without a matching page redirects with query intact', async () => {
  const response = await fetch(base + '/docs/frontend?theme=dark', { redirect: 'manual' })
  assert.equal(response.status, 301)
  assert.equal(response.headers.get('location'), '/docs/frontend/?theme=dark')
})

test('missing docs do not fall through to SPA and unrelated routes still do', async () => {
  for (const path of ['/docs/missing', '/docs/assets/missing.js']) {
    const response = await fetch(base + path)
    assert.equal(response.status, 404)
    assert.notEqual(await response.text(), 'spa home')
  }
  assert.equal(await (await fetch(base + '/system/me')).text(), 'spa home')
})
test('docs root without slash redirects while keeping query', async () => {
  const response = await fetch(base + '/docs?theme=dark', { redirect: 'manual' })
  assert.equal(response.status, 301)
  assert.equal(response.headers.get('location'), '/docs/?theme=dark')
})
test('supports HEAD and rejects document writes and retired routes', async () => {
  const head = await fetch(base + '/docs/frontend/', { method: 'HEAD' })
  assert.equal(head.status, 200)
  assert.equal(await head.text(), '')
  const post = await fetch(base + '/docs/', { method: 'POST' })
  assert.equal(post.status, 405)
  assert.equal(post.headers.get('allow'), 'GET, HEAD')
  assert.equal((await fetch(base + '/fe-docs/')).status, 410)
})

test('missing built site fails clearly, without SPA fallback', async () => {
  const serve = docsStaticMiddleware(join(root, 'not-built'))
  const result = await new Promise((resolve) => {
    const response = {
      writeHead(status) {
        this.statusCode = status
        return this
      },
      end(body) {
        resolve({ status: this.statusCode, body })
      },
    }
    serve({ url: '/docs/', method: 'GET' }, response, () => resolve({ status: 200 }))
  })
  assert.equal(result.status, 503)
  assert.match(result.body, /npm run docs:build/)
})
