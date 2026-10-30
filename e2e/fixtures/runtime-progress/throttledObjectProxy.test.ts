import { createServer, request, type Server } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { ThrottledObjectProxy } from './throttledObjectProxy'

const servers: Server[] = []
const proxies: ThrottledObjectProxy[] = []

afterEach(async () => {
  await Promise.all(proxies.splice(0).map((proxy) => proxy.stop()))
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()))
        }),
    ),
  )
})

async function listen(server: Server): Promise<number> {
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('missing address')
  return address.port
}

async function get(port: number, path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path }, (response) => {
      response.resume()
      response.on('end', () => resolve(response.statusCode ?? 0))
    })
    req.on('error', reject)
    req.end()
  })
}

describe('ThrottledObjectProxy', () => {
  it('keeps forwarding on the configured upstream and rejects absolute targets', async () => {
    let upstreamCalls = 0
    let unexpectedCalls = 0
    const upstreamPort = await listen(
      createServer((_request, response) => {
        upstreamCalls++
        response.end('object')
      }),
    )
    const unexpectedPort = await listen(
      createServer((_request, response) => {
        unexpectedCalls++
        response.end('unexpected')
      }),
    )
    const proxy = new ThrottledObjectProxy(`http://127.0.0.1:${upstreamPort}`, 'bucket/object')
    proxies.push(proxy)
    const proxyPort = Number(new URL(await proxy.start()).port)

    expect(await get(proxyPort, '/bucket/object?x=1')).toBe(200)
    expect(await get(proxyPort, `http://127.0.0.1:${unexpectedPort}/target`)).toBe(400)
    expect(await get(proxyPort, `//127.0.0.1:${unexpectedPort}/target`)).toBe(400)
    expect(await get(proxyPort, '/%xx')).toBe(400)
    expect(upstreamCalls).toBe(1)
    expect(unexpectedCalls).toBe(0)
  })
})
