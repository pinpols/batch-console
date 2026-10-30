import { createServer, request as httpRequest, type ClientRequest, type Server } from 'node:http'
import { setTimeout as delay } from 'node:timers/promises'

/** 透传真实对象存储，仅限本例对象GET有界限速；不保存签名头或替换对象内容。 */
export class ThrottledObjectProxy {
  private server?: Server
  private readonly upstreamRequests = new Set<ClientRequest>()
  readonly transfers: Array<{ bytes: number; complete: boolean; status: number }> = []

  constructor(
    private readonly upstream: string,
    private readonly ownedObjectPath: string,
  ) {
    const url = new URL(upstream)
    if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname))
      throw new Error('真实对象代理仅允许本地HTTP对象存储')
    if (!ownedObjectPath || ownedObjectPath.includes('..'))
      throw new Error('对象代理必须限定本例完整对象路径')
  }

  async start() {
    this.server = createServer((request, response) => {
      const url = new URL(request.url ?? '/', this.upstream)
      const throttle =
        request.method === 'GET' &&
        decodeURIComponent(url.pathname).endsWith(`/${this.ownedObjectPath}`)
      const transfer = { bytes: 0, complete: false, status: 0 }
      if (throttle) this.transfers.push(transfer)
      // 保留原Host供S3签名校验；只更换TCP目的地址，凭据不进入证据或日志。
      const upstream = httpRequest(
        url,
        { method: request.method, headers: request.headers },
        (source) => {
          transfer.status = source.statusCode ?? 502
          source.once('error', () => response.destroy())
          response.writeHead(transfer.status, source.headers)
          if (!throttle) {
            source.pipe(response)
            return
          }
          void (async () => {
            try {
              for await (const buffer of source) {
                const chunk = Buffer.from(buffer)
                for (let offset = 0; offset < chunk.length; offset += 65536) {
                  const part = chunk.subarray(offset, offset + 65536)
                  await new Promise<void>((resolve, reject) => {
                    response.write(part, (error) => (error ? reject(error) : resolve()))
                  })
                  transfer.bytes += part.length
                  await delay(150)
                }
              }
              transfer.complete = true
              response.end()
            } catch {
              response.destroy()
            }
          })()
        },
      )
      this.upstreamRequests.add(upstream)
      upstream.once('close', () => this.upstreamRequests.delete(upstream))
      upstream.once('error', () => response.destroy())
      upstream.setTimeout(90_000, () => upstream.destroy())
      response.once('close', () => upstream.destroy())
      request.pipe(upstream)
    })
    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject)
      this.server!.listen(0, '127.0.0.1', resolve)
    })
    const address = this.server.address()
    if (!address || typeof address === 'string') throw new Error('对象代理未绑定TCP端口')
    return `http://127.0.0.1:${address.port}`
  }

  async stop() {
    for (const request of this.upstreamRequests) request.destroy()
    const server = this.server
    this.server = undefined
    if (!server) return
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  }
}
