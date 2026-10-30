import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { useTenantStore } from '@/stores/tenant'
import { stubLocalStorage } from '@/test-utils/localStorage'
import { useInstanceNoSearch } from './useInstanceNoSearch'

const { queryJobInstances } = vi.hoisted(() => ({ queryJobInstances: vi.fn() }))
vi.mock('@/api/queries/instances', () => ({ queryJobInstances }))

const storage = stubLocalStorage()

describe('useInstanceNoSearch', () => {
  beforeEach(() => {
    storage.clear()
    setActivePinia(createPinia())
    queryJobInstances.mockReset()
    useTenantStore().setTenantId('tenant-a')
  })

  it('clears the selected instance when its job or business date changes', async () => {
    const jobCode = ref('JOB_A')
    const bizDate = ref('2026-10-12')
    const selectedInstanceNo = ref('instance-a-20261012')
    const scope = effectScope()
    scope.run(() => useInstanceNoSearch(jobCode, bizDate, selectedInstanceNo))

    jobCode.value = 'JOB_B'
    await nextTick()
    expect(selectedInstanceNo.value).toBe('')

    selectedInstanceNo.value = 'instance-b-20261012'
    bizDate.value = '2026-10-13'
    await nextTick()
    expect(selectedInstanceNo.value).toBe('')
    scope.stop()
  })

  it('does not repopulate candidates from a request for the previous job/date', async () => {
    let resolveRequest: ((value: { records: Array<Record<string, string>> }) => void) | undefined
    queryJobInstances.mockImplementationOnce(
      () => new Promise((resolve) => (resolveRequest = resolve)),
    )
    const jobCode = ref('JOB_A')
    const bizDate = ref('2026-10-12')
    const selectedInstanceNo = ref('')
    const scope = effectScope()
    const search = scope.run(() => useInstanceNoSearch(jobCode, bizDate, selectedInstanceNo))!

    const pending = search.loadInstances()
    jobCode.value = 'JOB_B'
    await nextTick()
    resolveRequest?.({ records: [{ instanceNo: 'instance-a', instanceStatus: 'FAILED' }] })
    await pending

    expect(search.instanceOptions.value).toEqual([])
    expect(selectedInstanceNo.value).toBe('')
    scope.stop()
  })

  it('invalidates candidates and the selected instance after a tenant switch', async () => {
    let resolveRequest: ((value: { records: Array<Record<string, string>> }) => void) | undefined
    queryJobInstances.mockImplementationOnce(
      () => new Promise((resolve) => (resolveRequest = resolve)),
    )
    const jobCode = ref('JOB_A')
    const bizDate = ref('2026-10-12')
    const selectedInstanceNo = ref('instance-a')
    const scope = effectScope()
    const search = scope.run(() => useInstanceNoSearch(jobCode, bizDate, selectedInstanceNo))!

    const pending = search.loadInstances()
    useTenantStore().setTenantId('tenant-b')
    await nextTick()
    resolveRequest?.({ records: [{ instanceNo: 'instance-a', instanceStatus: 'FAILED' }] })
    await pending

    expect(search.instanceOptions.value).toEqual([])
    expect(selectedInstanceNo.value).toBe('')
    scope.stop()
  })
})
