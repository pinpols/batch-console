<template>
  <MPullRefresh :on-refresh="load">
    <div class="m-page">
      <div class="m-page__header">
        <div>
          <div class="m-page__title">{{ t('mobile.executionLog.title') }}</div>
          <div v-if="!loadError || rows.length" class="m-page__subtitle">
            {{ t('mobile.executionLog.summary', { total }) }}
          </div>
        </div>
      </div>

      <div class="m-page__header u-gap-8">
        <el-input
          v-model="traceDraft"
          :placeholder="t('mobile.executionLog.placeholderTrace')"
          :aria-label="t('mobile.executionLog.placeholderTrace')"
          clearable
          size="small"
          class="u-w-full"
          @change="onTraceChange"
          @keydown.enter="onTraceEnterDown"
          @keyup.enter="onTraceEnterUp"
          @compositionstart="traceComposing = true"
          @compositionend="onTraceCompositionEnd"
          @blur="onTraceBlur"
        />
      </div>

      <MSkeleton v-if="loading && rows.length === 0" :count="3" />
      <div v-else-if="!loadError && rows.length === 0" class="m-empty">
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
          <button class="m-btn" type="button" @click="copyDecodedDetailSummary(row.detailSummary)">
            {{ t('common.copy') }}
          </button>
        </details>
      </div>
      <div
        v-if="loadError"
        class="m-load-error"
        :class="rows.length ? 'm-load-error--inline' : 'm-empty'"
        role="alert"
      >
        <div>{{ t('mobile.common.loadFail') }}</div>
        <button class="m-btn" type="button" @click="retryLoad">{{ t('common.retry') }}</button>
      </div>
      <div v-if="rows.length > 0 && !loadError" class="m-load-more">
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
  const loadError = ref(false)
  const failedMore = ref(false)
  const rows = ref<ConsoleAuditLogResponse[]>([])
  const page = ref(1)
  const pageSize = 30
  const total = ref(0)
  const hasMore = ref(false)
  let requestSequence = 0
  const traceDraft = ref<string>((route.query.traceId as string) ?? '')
  const traceComposing = ref(false)
  // 文本变更后的 Enter 会先触发 change，再触发 keyup；只跳过同一次按键的重复提交。
  let traceEnterPhase: 'idle' | 'normal' | 'composing' = 'idle'
  let traceChangedOnEnter = false
  let pendingTraceChange: string | null = null
  let traceBlurredDuringComposition = false

  function fmt(ts?: string | null) {
    return fmtDatetime(ts)
  }

  function copyDecodedDetailSummary(summary: string) {
    const decodedSummary = decodeHtmlEntities(summary)
    return copy(decodedSummary, 'detailSummary')
  }

  function resultChipClass(r?: string) {
    if (r === 'SUCCESS') return 'm-chip--success'
    if (r === 'FAILURE') return 'm-chip--danger'
    return 'm-chip--info'
  }

  async function load(reset = true) {
    const sequence = ++requestSequence
    const tenantId = tenant.tenantId
    if (!tenantId) return
    loading.value = true
    loadError.value = false
    const requestedPage = reset ? 1 : page.value + 1
    if (reset) {
      rows.value = []
      total.value = 0
      hasMore.value = false
    }
    try {
      const trace = traceDraft.value.trim()
      const result = await queryAuditsPage(
        tenantId,
        requestedPage,
        pageSize,
        trace ? { traceId: trace } : undefined,
      )
      if (sequence !== requestSequence) return
      const next = result.items ?? []
      rows.value = reset ? next : [...rows.value, ...next]
      page.value = requestedPage
      total.value = result.total ?? rows.value.length
      hasMore.value = rows.value.length < total.value
    } catch {
      if (sequence !== requestSequence) return
      failedMore.value = !reset
      loadError.value = true
    } finally {
      if (sequence === requestSequence) loading.value = false
    }
  }

  async function loadMore() {
    if (loading.value || !hasMore.value) return
    await load(false)
  }

  function retryLoad() {
    void load(!failedMore.value)
  }

  function onTraceChange(value: string) {
    if (traceComposing.value || traceEnterPhase === 'composing') {
      pendingTraceChange = value
      traceDraft.value = value
      return
    }
    if (traceEnterPhase === 'normal') traceChangedOnEnter = true
    submitTrace()
  }

  function onTraceEnterDown(event: Event | KeyboardEvent) {
    if (!(event instanceof KeyboardEvent)) return
    if (event.repeat) return
    traceEnterPhase = event.isComposing || traceComposing.value ? 'composing' : 'normal'
    traceChangedOnEnter = false
  }

  function resetTraceEnter() {
    traceEnterPhase = 'idle'
    traceChangedOnEnter = false
  }

  function onTraceCompositionEnd(event: CompositionEvent) {
    traceComposing.value = false
    if (pendingTraceChange !== null && event.target instanceof HTMLInputElement) {
      pendingTraceChange = event.target.value
    }
    if (traceBlurredDuringComposition && pendingTraceChange !== null) {
      traceDraft.value = pendingTraceChange
      submitTrace()
    }
    traceBlurredDuringComposition = false
  }

  function onTraceBlur() {
    resetTraceEnter()
    if (pendingTraceChange === null) return
    if (traceComposing.value) {
      traceBlurredDuringComposition = true
      return
    }
    traceDraft.value = pendingTraceChange
    submitTrace()
  }

  function onTraceEnterUp(event: KeyboardEvent) {
    const shouldSubmit =
      !event.isComposing &&
      !traceComposing.value &&
      traceEnterPhase !== 'composing' &&
      !traceChangedOnEnter
    resetTraceEnter()
    if (shouldSubmit) submitTrace()
  }

  function submitTrace() {
    pendingTraceChange = null
    traceBlurredDuringComposition = false
    const trace = traceDraft.value.trim()
    if (traceDraft.value !== trace) traceDraft.value = trace
    void router.replace({
      path: '/m/logs',
      query: trace ? { traceId: trace } : {},
    })
    void load(true)
  }
  watch(
    () => tenant.tenantId,
    () => {
      requestSequence += 1
      rows.value = []
      total.value = 0
      page.value = 1
      hasMore.value = false
      loading.value = false
      loadError.value = false
      failedMore.value = false
      pendingTraceChange = null
      traceBlurredDuringComposition = false
      traceEnterPhase = traceComposing.value ? 'composing' : 'idle'
      traceChangedOnEnter = false
    },
    { flush: 'sync' },
  )
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

<style scoped>
  .m-load-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .m-load-error--inline {
    padding: 12px;
    color: var(--ios-label-secondary);
  }
</style>
