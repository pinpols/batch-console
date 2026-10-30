<template>
  <MPullRefresh :on-refresh="load">
    <div class="m-page">
      <div class="m-page__header">
        <div>
          <div class="m-page__title">{{ t('mobile.outbox.title') }}</div>
          <div class="m-page__subtitle">
            {{ t('mobile.outbox.summary', { total: rows.length }) }}
          </div>
        </div>
      </div>

      <div class="m-page__header u-gap-8">
        <el-segmented v-model="filter" :options="filterOptions" size="small" class="u-w-full" />
      </div>

      <MSkeleton v-if="loading && filtered.length === 0" :count="3" />
      <div v-else-if="filtered.length === 0" class="m-empty">
        {{ t('mobile.outbox.empty') }}
      </div>

      <div v-for="row in filtered" :key="row.id" class="m-card">
        <div class="m-card__row">
          <div class="m-card__title">#{{ row.id }} · {{ row.eventType }}</div>
          <span :class="['m-chip', statusChipClass(row.retryStatus)]">
            {{ resolveEnumLabel('outboxRetryStatus', row.retryStatus) }}
          </span>
        </div>
        <div class="m-card__sub">{{ row.eventKey }}</div>
        <div class="m-card__meta">
          <div>
            <span class="m-card__meta-key">{{ t('mobile.outbox.retryCount') }}</span>
            {{ row.retryCount }} · {{ row.retryPolicy }}
          </div>
          <div>
            <span class="m-card__meta-key">{{ t('mobile.outbox.eventType') }}</span>
            {{ row.eventType }}
          </div>
        </div>
        <div
          v-if="
            canMutateConfig && (row.retryStatus === 'FAILED' || row.retryStatus === 'EXHAUSTED')
          "
          class="m-card__actions"
        >
          <button
            class="m-btn m-btn--primary"
            data-track="outbox.republish"
            :disabled="busyId !== null || !positiveLongId(row.outboxEventId)"
            @click="doRepublish(row)"
          >
            {{ t('mobile.outbox.republish') }}
          </button>
        </div>
      </div>
    </div>
  </MPullRefresh>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useI18n } from 'vue-i18n'
  import { RefreshCw as Refresh } from '@lucide/vue'
  import { ElMessage } from 'element-plus'
  import { useTenantStore } from '@/stores/tenant'
  import { useAutoRefresh } from '@/composables/useAutoRefresh'
  import { REFRESH_INTERVAL_COLD_MS } from '@/layout-mobile/composables/refreshIntervals'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import MPullRefresh from '@/layout-mobile/MPullRefresh.vue'
  import MSkeleton from '@/layout-mobile/MSkeleton.vue'
  import { queryOutboxRetries } from '@/api/observabilityQueries'
  import { republishOutbox } from '@/api/ops'
  import type { ConsoleOutboxRetryLogResponse } from '@/types/console-api'
  import { usePermission } from '@/composables/usePermission'
  import { positiveLongId } from '@/utils/positiveLongId'

  const { t, te } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()
  const { canMutateConfig } = usePermission()
  const { data: metaEnums } = useConsoleMetaEnumsQuery()
  function resolveEnumLabel(group: string, value?: string | null): string {
    if (!value) return '—'
    const key = `enum.${group}.${value}`
    if (te(key)) return t(key)
    return metaEnums.value?.[group]?.find((o) => o.value === value)?.label ?? value
  }

  const loading = ref(false)
  const rows = ref<ConsoleOutboxRetryLogResponse[]>([])
  const busyId = ref<number | null>(null)
  let requestSequence = 0
  let tenantRevision = 0
  watch(
    () => tenant.tenantId,
    () => {
      tenantRevision += 1
      requestSequence += 1
      rows.value = []
      loading.value = false
    },
    { flush: 'sync' },
  )
  const filter = ref<'all' | 'failed' | 'giveup' | 'pending' | 'published'>('failed')

  const filterOptions = computed(() => [
    { value: 'failed', label: t('mobile.outbox.filterFailed') },
    { value: 'giveup', label: t('mobile.outbox.filterGiveUp') },
    { value: 'pending', label: t('mobile.outbox.filterPending') },
    { value: 'published', label: t('mobile.outbox.filterPublished') },
    { value: 'all', label: t('mobile.outbox.filterAll') },
  ])

  const filtered = computed(() => {
    if (filter.value === 'all') return rows.value
    if (filter.value === 'failed') return rows.value.filter((r) => r.retryStatus === 'FAILED')
    if (filter.value === 'giveup') return rows.value.filter((r) => r.retryStatus === 'EXHAUSTED')
    if (filter.value === 'pending') return rows.value.filter((r) => r.retryStatus === 'WAITING')
    if (filter.value === 'published') return rows.value.filter((r) => r.retryStatus === 'SUCCESS')
    return rows.value
  })

  function statusChipClass(s?: string) {
    if (s === 'FAILED' || s === 'EXHAUSTED') return 'm-chip--danger'
    if (s === 'SUCCESS') return 'm-chip--success'
    if (s === 'WAITING') return 'm-chip--warning'
    return 'm-chip--info'
  }

  async function load() {
    const tenantId = tenant.tenantId
    if (!tenantId) return
    const sequence = ++requestSequence
    loading.value = true
    try {
      const result = await queryOutboxRetries(tenantId)
      if (sequence === requestSequence && tenant.tenantId === tenantId) rows.value = result
    } catch {
      if (sequence === requestSequence && tenant.tenantId === tenantId) {
        rows.value = []
        ElMessage.error(t('mobile.common.loadFail'))
      }
    } finally {
      if (sequence === requestSequence) loading.value = false
    }
  }

  async function doRepublish(row: ConsoleOutboxRetryLogResponse) {
    const tenantId = tenant.tenantId
    const revision = tenantRevision
    if (
      !tenantId ||
      row.tenantId !== tenantId ||
      !canMutateConfig.value ||
      busyId.value !== null ||
      !positiveLongId(row.outboxEventId)
    )
      return
    busyId.value = row.id
    try {
      const result = await republishOutbox(tenantId, [row.outboxEventId])
      if (revision !== tenantRevision) return
      if (result.resetCount === 1) ElMessage.success(t('mobile.outbox.republishDoneToast'))
      else ElMessage.warning(t('mobile.outbox.republishNotReset'))
      await load()
    } finally {
      busyId.value = null
    }
  }
  useTenantReload(load)
  useAutoRefresh(load, REFRESH_INTERVAL_COLD_MS)
</script>
