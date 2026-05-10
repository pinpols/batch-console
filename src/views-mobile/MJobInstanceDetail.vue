<template>
  <div class="m-page">
    <div class="m-page__header">
      <div>
        <button class="m-page__refresh" @click="$router.back()">
          <el-icon><ArrowLeft /></el-icon>
          {{ t('common.backToPrev') }}
        </button>
      </div>
      <button class="m-page__refresh" :disabled="loading" @click="load">
        <el-icon><Refresh /></el-icon>
        {{ loading ? t('mobile.common.loading') : t('mobile.common.refresh') }}
      </button>
    </div>

    <div v-if="loading && !row" class="m-loading">{{ t('mobile.common.loading') }}</div>
    <div v-else-if="!row" class="m-empty">{{ t('mobile.jobDetail.empty') }}</div>

    <template v-else>
      <div class="m-card">
        <div class="m-card__row">
          <div class="m-card__title">{{ row.jobCode }}</div>
          <span :class="['m-chip', statusChipClass(row.instanceStatus)]">
            {{ resolveEnumLabel('instanceStatus', row.instanceStatus) }}
          </span>
        </div>
        <div class="m-card__sub">{{ row.instanceNo }}</div>
        <div class="m-card__meta">
          <div><span class="m-card__meta-key">ID</span>{{ row.id }}</div>
          <div>
            <span class="m-card__meta-key">{{ t('mobile.jobs.bizDate') }}</span
            >{{ row.bizDate }}
          </div>
          <div>
            <span class="m-card__meta-key">{{ t('mobile.jobs.trigger') }}</span>
            {{ resolveEnumLabel('triggerType', row.triggerType) }}
          </div>
          <div>
            <span class="m-card__meta-key">{{ t('mobile.jobs.priority') }}</span
            >{{ row.priority }}
          </div>
          <div><span class="m-card__meta-key">queue</span>{{ row.queueCode || '—' }}</div>
          <div><span class="m-card__meta-key">Worker</span>{{ row.workerGroup || '—' }}</div>
          <div>
            <span class="m-card__meta-key">{{ t('mobile.jobs.startedAt') }}</span>
            {{ fmt(row.startedAt) }}
          </div>
          <div>
            <span class="m-card__meta-key">{{ t('mobile.jobs.finishedAt') }}</span>
            {{ fmt(row.finishedAt) }}
          </div>
          <div><span class="m-card__meta-key">traceId</span>{{ row.traceId }}</div>
        </div>
        <div
          v-if="row.instanceStatus === 'RUNNING' || row.instanceStatus === 'FAILED'"
          class="m-card__actions"
        >
          <button
            v-if="row.instanceStatus === 'FAILED'"
            class="m-btn m-btn--primary"
            @click="retry"
          >
            {{ t('mobile.jobs.retry') }}
          </button>
          <button
            v-if="row.instanceStatus === 'RUNNING'"
            class="m-btn m-btn--danger"
            @click="terminate"
          >
            {{ t('mobile.jobs.terminate') }}
          </button>
        </div>
      </div>

      <div class="m-card">
        <div class="m-card__title" style="margin-bottom: 6px">paramsSnapshot</div>
        <pre class="m-pre">{{ pretty(row.paramsSnapshot) || '—' }}</pre>
      </div>

      <div class="m-card">
        <div class="m-card__title" style="margin-bottom: 6px">resultSummary</div>
        <pre class="m-pre">{{ pretty(row.resultSummary) || '—' }}</pre>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { ArrowLeft, Refresh } from '@element-plus/icons-vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { useTenantStore } from '@/stores/tenant'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { instanceApi } from '@/api/instance'
  import type { ConsoleJobInstanceResponse } from '@/types/console-api'

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
  const row = ref<ConsoleJobInstanceResponse | null>(null)

  const instanceId = () => Number(route.params.id)

  function fmt(ts?: string | null) {
    if (!ts) return '—'
    try {
      return new Date(ts).toLocaleString('zh-CN', { hour12: false })
    } catch {
      return ts
    }
  }

  function pretty(raw?: string | null): string {
    if (!raw) return ''
    try {
      return JSON.stringify(JSON.parse(raw), null, 2)
    } catch {
      return raw
    }
  }

  function statusChipClass(s?: string) {
    switch (s) {
      case 'SUCCESS':
      case 'COMPLETED':
        return 'm-chip--success'
      case 'RUNNING':
        return 'm-chip--info'
      case 'FAILED':
      case 'CANCELLED':
        return 'm-chip--danger'
      case 'WAITING':
      case 'CREATED':
        return 'm-chip--warning'
      default:
        return ''
    }
  }

  async function load() {
    const id = instanceId()
    if (!id) return
    loading.value = true
    try {
      row.value = await instanceApi.detail(id, tenant.tenantId)
    } catch {
      row.value = null
      ElMessage.error(t('mobile.common.loadFail'))
    } finally {
      loading.value = false
    }
  }

  async function retry() {
    if (!row.value) return
    try {
      await ElMessageBox.confirm(
        `${t('mobile.jobs.retry')} ${row.value.instanceNo}?`,
        t('mobile.jobs.retry'),
        {
          type: 'warning',
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
        },
      )
      await instanceApi.retry(
        row.value.instanceNo,
        tenant.tenantId,
        row.value.jobCode,
        row.value.bizDate,
      )
      ElMessage.success(t('mobile.jobDetail.retrySuccess'))
      router.back()
    } catch {
      /* cancelled */
    }
  }

  async function terminate() {
    if (!row.value) return
    try {
      await ElMessageBox.confirm(
        `${t('mobile.jobs.terminate')} ${row.value.instanceNo}?`,
        t('mobile.jobs.terminate'),
        {
          type: 'warning',
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
        },
      )
      await instanceApi.terminate(row.value.id, tenant.tenantId)
      ElMessage.success(t('mobile.jobDetail.terminateSuccess'))
      await load()
    } catch {
      /* cancelled */
    }
  }

  onMounted(load)
  watch(() => route.params.id, load)
  watch(() => tenant.tenantId, load)
</script>

<style scoped>
  .m-pre {
    max-height: 400px;
    overflow: auto;
    padding: 10px;
    background: var(--el-fill-color-lighter);
    border-radius: 8px;
    font:
      11px/1.5 'SF Mono',
      Menlo,
      monospace;
    color: var(--color-text-secondary);
    white-space: pre-wrap;
    word-break: break-all;
  }
</style>
