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
        <button class="m-page__refresh" :disabled="loading" @click="load">
          <el-icon><Refresh /></el-icon>
          {{ loading ? t('mobile.common.loading') : t('mobile.common.refresh') }}
        </button>
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
          v-if="row.retryStatus === 'FAILED' || row.retryStatus === 'GIVE_UP'"
          class="m-card__actions"
        >
          <button
            class="m-btn m-btn--primary"
            :disabled="busyId === row.id"
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
  import { computed, ref } from 'vue'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useI18n } from 'vue-i18n'
  import { Refresh } from '@element-plus/icons-vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { useTenantStore } from '@/stores/tenant'
  import { useAutoRefresh } from '@/composables/useAutoRefresh'
  import { REFRESH_INTERVAL_COLD_MS } from '@/layout-mobile/composables/refreshIntervals'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import MPullRefresh from '@/layout-mobile/MPullRefresh.vue'
  import MSkeleton from '@/layout-mobile/MSkeleton.vue'
  import { queryOutboxRetries } from '@/api/observabilityQueries'
  import { republishOutbox } from '@/api/ops'
  import type { ConsoleOutboxRetryLogResponse } from '@/types/console-api'

  const { t, te } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()
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
    if (filter.value === 'giveup') return rows.value.filter((r) => r.retryStatus === 'GIVE_UP')
    if (filter.value === 'pending') return rows.value.filter((r) => r.retryStatus === 'PENDING')
    if (filter.value === 'published') return rows.value.filter((r) => r.retryStatus === 'PUBLISHED')
    return rows.value
  })

  function statusChipClass(s?: string) {
    if (s === 'FAILED' || s === 'GIVE_UP') return 'm-chip--danger'
    if (s === 'PUBLISHED') return 'm-chip--success'
    if (s === 'PENDING') return 'm-chip--warning'
    return 'm-chip--info'
  }

  async function load() {
    loading.value = true
    try {
      rows.value = await queryOutboxRetries(tenant.tenantId)
    } catch {
      rows.value = []
      ElMessage.error(t('mobile.common.loadFail'))
    } finally {
      loading.value = false
    }
  }

  async function doRepublish(row: ConsoleOutboxRetryLogResponse) {
    try {
      await ElMessageBox.confirm(
        t('mobile.outbox.republishConfirmText', { id: row.id }),
        t('mobile.outbox.republishConfirmTitle'),
        {
          type: 'warning',
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
        },
      )
    } catch {
      return
    }
    busyId.value = row.id
    try {
      await republishOutbox(tenant.tenantId, [row.id])
      ElMessage.success(t('mobile.outbox.republishDoneToast'))
      await load()
    } finally {
      busyId.value = null
    }
  }
  useTenantReload(load)
  useAutoRefresh(load, REFRESH_INTERVAL_COLD_MS)
</script>
