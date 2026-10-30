// @vitest-environment jsdom
import axios, { type AxiosAdapter } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ElMessage } from 'element-plus'
import { applyApiInterceptors, isMaintenanceWriteAllowed } from './interceptors'
import { useAppStore } from '@/stores/app'

const adapter = vi.fn<AxiosAdapter>(async (config) => ({
  data: { code: '0', message: 'ok', data: {} },
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
}))

function createClient() {
  const client = axios.create({ adapter })
  applyApiInterceptors(client)
  return client
}

describe('maintenance write guard', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    })
    setActivePinia(createPinia())
    adapter.mockClear()
    vi.spyOn(ElMessage, 'warning').mockImplementation(() => undefined as never)
    localStorage.clear()
  })

  it('blocks business mutations before they leave the browser', async () => {
    useAppStore().setMaintenance({ enabled: true, readOnly: true })
    const client = createClient()

    await expect(client.post('/api/console/jobs', {})).rejects.toMatchObject({
      code: 'ERR_MAINTENANCE_WRITE_FROZEN',
      maintenance: true,
    })
    expect(adapter).not.toHaveBeenCalled()
    expect(ElMessage.warning).toHaveBeenCalledOnce()
  })

  it('keeps reads and maintenance recovery endpoint available', async () => {
    useAppStore().setMaintenance({ enabled: true, readOnly: true })
    const client = createClient()

    await client.get('/api/console/jobs')
    await client.put('/api/console/admin/system/maintenance', { enabled: false })

    expect(adapter).toHaveBeenCalledTimes(2)
  })

  it('keeps administrator business mutations blocked during maintenance', async () => {
    useAppStore().setMaintenance({ enabled: true, readOnly: false, adminBypass: true })
    const client = createClient()

    await expect(client.post('/api/console/jobs', {})).rejects.toMatchObject({
      code: 'ERR_MAINTENANCE_WRITE_FROZEN',
      maintenance: true,
    })

    expect(adapter).not.toHaveBeenCalled()
    expect(ElMessage.warning).toHaveBeenCalledOnce()
  })

  it('allows writes before a scheduled start and blocks them once the server marks it active', async () => {
    const app = useAppStore()
    app.setMaintenance({ enabled: true, active: false, startsAt: '2099-01-01T00:00:00Z' })
    const client = createClient()

    await client.post('/api/console/jobs', {})
    expect(adapter).toHaveBeenCalledOnce()

    app.setMaintenance({ active: true })
    await expect(client.post('/api/console/jobs', {})).rejects.toMatchObject({
      code: 'ERR_MAINTENANCE_WRITE_FROZEN',
    })
    expect(adapter).toHaveBeenCalledOnce()
  })

  it('keeps the current write freeze when an older maintenance response arrives', async () => {
    const app = useAppStore()
    app.setMaintenance({ enabled: true, active: true, version: 9 })
    app.setMaintenance({ enabled: false, active: false, version: 8 })
    const client = createClient()

    await expect(client.post('/api/console/jobs', {})).rejects.toMatchObject({
      code: 'ERR_MAINTENANCE_WRITE_FROZEN',
    })
    expect(app.maintenance.version).toBe(9)
    expect(adapter).not.toHaveBeenCalled()
  })

  it('does not reactivate maintenance from an older response after recovery', () => {
    const app = useAppStore()
    app.setMaintenance({ enabled: false, active: false, version: 10 })
    app.setMaintenance({ enabled: true, active: true, version: 9 })
    expect(app.writesFrozen).toBe(false)
  })

  it('accepts scheduled activation within the same configuration version', () => {
    const app = useAppStore()
    app.setMaintenance({ enabled: true, active: false, version: 9 })
    app.setMaintenance({ enabled: true, active: true, version: 9 })
    expect(app.writesFrozen).toBe(true)
  })

  it('does not undo scheduled activation with an earlier poll from the same version', () => {
    const app = useAppStore()
    app.setMaintenance({ enabled: true, active: true, version: 9 })
    app.setMaintenance({ enabled: true, active: false, version: 9 })
    expect(app.writesFrozen).toBe(true)
  })

  it('allowlist only covers authentication and maintenance administration', () => {
    expect(isMaintenanceWriteAllowed('/api/console/auth/login')).toBe(true)
    expect(isMaintenanceWriteAllowed('/api/console/admin/system/maintenance')).toBe(true)
    expect(isMaintenanceWriteAllowed('/api/console/approvals/A-1/approve')).toBe(false)
  })
})
