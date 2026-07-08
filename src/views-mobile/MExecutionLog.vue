<template>
  <MPullRefresh :on-refresh="load">
    <div class="m-page">
      <div class="m-page__header">
        <div>
          <div class="m-page__title">{{ t('mobile.executionLog.title') }}</div>
          <div class="m-page__subtitle">
            {{ t('mobile.executionLog.summary', { total: rows.length }) }}
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
            {{ row.detailSummary }}
          </div>
        </div>
      </div>
    </div>
  </MPullRefresh>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { RefreshCw as Refresh } from 'lucide-vue-next'
  import { ElMessage } from 'element-plus'
  import { useTenantStore } from '@/stores/tenant'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import MPullRefresh from '@/layout-mobile/MPullRefresh.vue'
  import MSkeleton from '@/layout-mobile/MSkeleton.vue'
  import { queryAudits } from '@/api/observabilityQueries'
  import type { ConsoleAuditLogResponse } from '@/types/console-api'

  const { t, te } = useI18n({ useScope: 'global' })
  const route = useRoute()
  const router = useRouter()
  const tenant = useTenantStore()
  const { data: metaEnums } = useConsoleMetaEnumsQuery()

  function resolveEnumLabel(group: string, value?: string | null): string {
    if (!value) return '—'
    const key = `enum.${group}.${value}`
    if (te(key)) return t(key)
    return metaEnums.value?.[group]?.find((o) => o.value === value)?.label ?? value
  }

  const loading = ref(false)
  const rows = ref<ConsoleAuditLogResponse[]>([])
  const traceDraft = ref<string>((route.query.traceId as string) ?? '')

  function fmt(ts?: string | null) {
    if (!ts) return '—'
    try {
      return new Date(ts).toLocaleString('zh-CN', { hour12: false })
    } catch {
      return ts
    }
  }

  function resultChipClass(r?: string) {
    if (r === 'SUCCESS') return 'm-chip--success'
    if (r === 'FAILURE') return 'm-chip--danger'
    return 'm-chip--info'
  }

  async function load() {
    loading.value = true
    try {
      const trace = traceDraft.value.trim()
      rows.value = await queryAudits(tenant.tenantId, trace ? { traceId: trace } : undefined)
    } catch {
      rows.value = []
      ElMessage.error(t('mobile.common.loadFail'))
    } finally {
      loading.value = false
    }
  }

  function onTraceChange() {
    const trace = traceDraft.value.trim()
    void router.replace({
      path: '/m/logs',
      query: trace ? { traceId: trace } : {},
    })
    void load()
  }
  useTenantReload(load)
  watch(
    () => route.query.traceId,
    (v) => {
      const next = (v as string) || ''
      if (next !== traceDraft.value) {
        traceDraft.value = next
        void load()
      }
    },
  )
</script>
