import { createReadStream } from 'node:fs'
import { realpath, stat } from 'node:fs/promises'
import { extname, join, relative, resolve, sep } from 'node:path'

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.csv': 'text/csv; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.yaml': 'text/yaml; charset=utf-8',
  '.yml': 'text/yaml; charset=utf-8',
}

function inside(root, file) {
  const path = relative(root, file)
  return path !== '..' && !path.startsWith(`..${sep}`) && !path.startsWith(sep)
}

/** 挂载 VitePress 构建目录；未命中文档不能落入控制台 SPA fallback。 */
export function docsStaticMiddleware(directory) {
  const root = resolve(directory)
  return async (req, res, next) => {
    const [rawPath, ...query] = (req.url || '/').split('?')
    if (rawPath === '/fe-docs' || rawPath.startsWith('/fe-docs/')) {
      res.writeHead(410)
      return res.end()
    }
    if (rawPath !== '/docs' && !rawPath.startsWith('/docs/')) return next()
    if (rawPath === '/docs') {
      res.writeHead(301, { Location: `/docs/${query.length ? `?${query.join('?')}` : ''}` })
      return res.end()
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' })
      return res.end()
    }
    let path
    try {
      path = decodeURIComponent(rawPath.slice('/docs/'.length))
      if (path.includes('\0') || path.split(/[\\/]/).some((part) => part === '..'))
        throw new Error()
    } catch {
      res.writeHead(400)
      return res.end('Bad request')
    }
    try {
      const realRoot = await realpath(root)
      await stat(join(realRoot, 'index.html'))
      let file = resolve(realRoot, path)
      if (!inside(realRoot, file)) throw new Error('outside root')
      let info = await stat(file).catch(() => null)
      // VitePress clean URL 对应 .html 可能与同名素材目录并存，页面应优先。
      if (!rawPath.endsWith('/') && !extname(file)) {
        const htmlFile = `${file}.html`
        const htmlInfo = await stat(htmlFile).catch(() => null)
        if (htmlInfo?.isFile()) {
          file = htmlFile
          info = htmlInfo
        }
      }
      if (info?.isDirectory()) {
        if (!rawPath.endsWith('/')) {
          res.writeHead(301, {
            Location: `${rawPath}/${query.length ? `?${query.join('?')}` : ''}`,
          })
          return res.end()
        }
        file = join(file, 'index.html')
        info = await stat(file).catch(() => null)
      }
      if (!info?.isFile() || !inside(realRoot, await realpath(file))) {
        res.writeHead(404)
        return res.end('Document not found')
      }
      res.writeHead(200, {
        'Content-Type': contentTypes[extname(file).toLowerCase()] || 'application/octet-stream',
        'Content-Length': info.size,
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      })
      if (req.method === 'HEAD') return res.end()
      const stream = createReadStream(file)
      stream.on('error', () => res.destroy())
      return stream.pipe(res)
    } catch (error) {
      if (error?.code === 'ENOENT') {
        res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' })
        return res.end('Documentation is not built. Run npm run docs:build and retry.')
      }
      res.writeHead(404)
      return res.end('Document not found')
    }
  }
}
