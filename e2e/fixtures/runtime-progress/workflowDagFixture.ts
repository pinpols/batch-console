import { randomUUID } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import type { APIRequestContext } from '@playwright/test'
import { WorkflowReplayFixture } from './workflowReplayFixture'

/** 实际HTTP执行入口；仅控制外部响应时机，运行状态仍由Worker和调度器产生。 */
export class WorkflowDagFixture extends WorkflowReplayFixture {
  private dagServer?: Server
  private readonly pending = new Map<string, () => void>()
  private readonly released = new Set<string>()
  private routeKeys: string[] = []
  readonly requests: Array<{ key: string; status: number }> = []

  get pendingKeys() {
    return [...this.pending.keys()].sort()
  }

  release(key: string) {
    this.released.add(key)
    this.pending.get(key)?.()
  }

  async startDagServer(routes: Record<string, { status: number; held?: boolean }>) {
    this.routeKeys = Object.keys(routes)
    const prefix = `/dag-${randomUUID()}/`
    const server = createServer((request, response) => {
      const key = request.url?.startsWith(prefix) ? request.url.slice(prefix.length) : ''
      const route = routes[key]
      if (request.method !== 'GET' || !route) {
        response.writeHead(404).end()
        return
      }
      let deadline: ReturnType<typeof setTimeout> | undefined
      const finish = () => {
        clearTimeout(deadline)
        this.pending.delete(key)
        this.requests.push({ key, status: route.status })
        response.writeHead(route.status, { 'Content-Type': 'text/plain' }).end(key)
      }
      if (route.held && !this.released.has(key)) {
        this.pending.set(key, finish)
        deadline = setTimeout(() => {
          this.pending.delete(key)
          response.writeHead(504).end('DAG observation deadline exceeded')
        }, 25_000)
        response.once('close', () => {
          clearTimeout(deadline)
          this.pending.delete(key)
        })
      } else finish()
    })
    this.dagServer = server
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('DAG业务HTTP端口未绑定')
    return Object.fromEntries(
      Object.keys(routes).map((key) => [key, `http://127.0.0.1:${address.port}${prefix}${key}`]),
    )
  }

  override async finish(request: APIRequestContext, reader?: APIRequestContext) {
    for (const key of this.routeKeys) this.release(key)
    try {
      return await super.finish(request, reader)
    } finally {
      this.dagServer?.closeAllConnections()
      if (this.dagServer)
        await new Promise<void>((resolve) => this.dagServer!.close(() => resolve()))
    }
  }
}
