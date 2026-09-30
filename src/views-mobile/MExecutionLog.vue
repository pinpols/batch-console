<template>
  <MPullRefresh :on-refresh="load">
    <div class="m-page">
      <div class="m-page__header">
        <div>
          <div class="m-page__title">{{ t('mobile.executionLog.title') }}</div>
          <div class="m-page__subtitle">
            {{ t('mobile.executionLog.summary', { total }) }}
          </div>
        </div>
      </div>

      <div class="m-page__header u-gap-8">
        <el-input
          v-model="traceDraft"
          :placeholder="t('mobile.executionLog.placeholderTrace')"
          clearable
          size="small"
          class="u-w-full"
          @change="onTraceChange"
          @keyup.enter="onTraceChange"
        />
      </div>

      <MSkeleton v-if="loading && rows.length === 0" :count="3" />
      <div v-else-if="rows.length === 0" class="m-empty">
        {{ t('mobile.executionLog.empty') }}
      </div>

      <div v-for="row in rows" :key="row.id" class="m-card">
        <div class="m-card__row">
          <div class="m-card__title">{{ row.operationType }}</div>
          <span :class="['m-chip', resultChipClass(row.operationResult)]">
            {{ resolveEnumLabel('operationResult', row.operationResult) }}
          </span>
        </div>
        <div class="m-card__sub">{{ row.traceId }}</div>
        <div class="m-card__meta">
          <div>
            <span class="m-card__meta-key">{{ t('mobile.executionLog.operator') }}</span>
            {{ row.operatorId }} ({{ row.operatorType }})
          </div>
          <div>
            <span class="m-card__meta-key">{{ t('mobile.executionLog.time') }}</span>
            {{ fmt(row.createdAt) }}
          </div>
          <div v-if="row.detailSummary">
            <span class="m-card__meta-key">{{ t('mobile.executionLog.summaryColon') }}</span>
            {{ structuredSummary(row.detailSummary) }}
          </div>
        </div>
        <details v-if="row.detailSummary" class="m-details">
          <summary>{{ t('mobile.executionLog.fullDetail') }}</summary>
          <pre>{{ decodeHtmlEntities(row.detailSummary) }}</pre>
          <button
            class="m-btn"
            type="button"
            @click="copy(decodeHtmlEntities(row.detailSummary), 'detailSummary')"
          >
            {{ t('common.copy') }}
          </button>
        </details>
      </div>
      <div v-if="rows.length > 0" class="m-load-more">
        <button v-if="hasMore" class="m-btn" :disabled="loading" @click="loadMore">
          {{ loading ? t('mobile.common.loadingMore') : t('mobile.common.loadMore') }}
        </button>
        <span v-else>{{ t('mobile.common.noMore') }}</span>
      </div>
    </div>
  </MPullRefresh>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { useTenantStore } from '@/stores/tenant'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import MPullRefresh from '@/layout-mobile/MPullRefresh.vue'
  import MSkeleton from '@/layout-mobile/MSkeleton.vue'
  import { queryAuditsPage } from '@/api/observabilityQueries'
  import type { ConsoleAuditLogResponse } from '@/types/console-api'
  import { fmtDatetime } from '@/utils/datetime'
  import { decodeHtmlEntities, structuredSummary } from '@/utils/structuredSummary'
  import { useCopy } from '@/composables/useCopy'

  const { t, te } = useI18n({ useScope: 'global' })
  const route = useRoute()
  const router = useRouter()
  const tenant = useTenantStore()
  const { data: metaEnums } = useConsoleMetaEnumsQuery()
  const { copy } = useCopy()

  function resolveEnumLabel(group: string, value?: string | null): string {
    if (!value) return '—'
    const key = `enum.${group}.${value}`
    if (te(key)) return t(key)
    return metaEnums.value?.[group]?.find((o) => o.value === value)?.label ?? value
  }

  const loading = ref(false)
  const rows = ref<ConsoleAuditLogResponse[]>([])
  const page = ref(1)
  const pageSize = 30
  const total = ref(0)
  const hasMore = ref(false)
  const traceDraft = ref<string>((route.query.traceId as string) ?? '')

  function fmt(ts?: string | null) {
    return fmtDatetime(ts)
  }

  function resultChipClass(r?: string) {
    if (r === 'SUCCESS') return 'm-chip--success'
    if (r === 'FAILURE') return 'm-chip--danger'
    return 'm-chip--info'
  }

  async function load(reset = true) {
    loading.value = true
    try {
      if (reset) page.value = 1
      const trace = traceDraft.value.trim()
      const result = await queryAuditsPage(
        tenant.tenantId,
        page.value,
        pageSize,
        trace ? { traceId: trace } : undefined,
      )
      const next = result.items ?? []
      rows.value = reset ? next : [...rows.value, ...next]
      total.value = result.total ?? rows.value.length
      hasMore.value = rows.value.length < total.value
    } catch {
      rows.value = []
      ElMessage.error(t('mobile.common.loadFail'))
    } finally {
      loading.value = false
    }
  }

  async function loadMore() {
    if (loading.value || !hasMore.value) return
    page.value += 1
    await load(false)
  }

  function onTraceChange() {
    const trace = traceDraft.value.trim()
    void router.replace({
      path: '/m/logs',
      query: trace ? { traceId: trace } : {},
    })
    void load(true)
  }
  useTenantReload(() => load(true))
  watch(
    () => route.query.traceId,
    (v) => {
      const next = (v as string) || ''
      if (next !== traceDraft.value) {
        traceDraft.value = next
        void load(true)
      }
    },
  )
</script>
