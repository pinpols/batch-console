<template>
  <MPullRefresh :on-refresh="load">
    <div class="m-page">
      <div class="m-page__header">
        <div>
          <button class="m-page__refresh" @click="goBack()">
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
            <div>
              <span class="m-card__meta-key">traceId</span>
              <button
                v-if="row.traceId"
                class="m-link"
                @click="
                  $router.push({ path: '/observability/trace', query: { traceId: row.traceId } })
                "
              >
                {{ row.traceId }}
              </button>
              <span v-else>—</span>
            </div>
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
            <button
              v-if="row.traceId"
              class="m-btn"
              @click="
                $router.push({ path: '/observability/trace', query: { traceId: row.traceId } })
              "
            >
              {{ t('mobile.jobDetail.viewLogs') }}
            </button>
          </div>
        </div>

        <div class="m-card">
          <div class="m-card__title" style="margin-bottom: 6px">
            {{ t('mobile.jobDetail.sectionSteps') }}
          </div>
          <div v-if="stepsLoading" class="m-loading">{{ t('mobile.common.loading') }}</div>
          <div v-else-if="steps.length === 0" class="m-empty">
            {{ t('mobile.jobDetail.stepEmpty') }}
          </div>
          <div v-else class="m-step-list">
            <div v-for="s in steps" :key="s.id" class="m-step">
              <div class="m-card__row">
                <div class="m-step__title">{{ s.stepCode }}</div>
                <span :class="['m-chip', stepChipClass(s.stepStatus)]">
                  {{ resolveEnumLabel('partitionStatus', s.stepStatus) }}
                </span>
              </div>
              <div class="m-card__meta">
                <div>retry · {{ s.retryCount }}</div>
                <div v-if="s.startedAt">start · {{ fmt(s.startedAt) }}</div>
                <div v-if="s.finishedAt">finish · {{ fmt(s.finishedAt) }}</div>
              </div>
              <div v-if="s.errorCode || s.errorMessage" class="m-step__err">
                <span v-if="s.errorCode" class="m-step__err-code">[{{ s.errorCode }}]</span>
                {{ s.errorMessage }}
              </div>
            </div>
          </div>
        </div>

        <div class="m-card">
          <div class="m-card__title" style="margin-bottom: 6px">paramsSnapshot</div>
          <JsonPreview :data="row.paramsSnapshot" />
        </div>

        <div class="m-card">
          <div class="m-card__title" style="margin-bottom: 6px">resultSummary</div>
          <JsonPreview :data="row.resultSummary" />
        </div>
      </template>
    </div>
  </MPullRefresh>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { ArrowLeft, Refresh } from '@element-plus/icons-vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useAutoRefresh } from '@/composables/useAutoRefresh'
  import { useSmartBack } from '@/composables/useSmartBack'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { instanceApi } from '@/api/instance'
  import MPullRefresh from '@/layout-mobile/MPullRefresh.vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'
  import type {
    ConsoleJobInstanceResponse,
    ConsoleJobStepInstanceResponse,
  } from '@/types/console-api'

  const { t, te } = useI18n({ useScope: 'global' })
  const route = useRoute()
  const router = useRouter()
  const tenant = useTenantStore()
  const goBack = useSmartBack('/m/jobs')

  const { data: metaEnums } = useConsoleMetaEnumsQuery()
  function resolveEnumLabel(group: string, value?: string | null): string {
    if (!value) return '—'
    const key = `enum.${group}.${value}`
    if (te(key)) return t(key)
    return metaEnums.value?.[group]?.find((o) => o.value === value)?.label ?? value
  }
  const loading = ref(false)
  const row = ref<ConsoleJobInstanceResponse | null>(null)
  const steps = ref<ConsoleJobStepInstanceResponse[]>([])
  const stepsLoading = ref(false)

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

  function stepChipClass(s?: string) {
    if (s === 'SUCCESS' || s === 'COMPLETED') return 'm-chip--success'
    if (s === 'RUNNING') return 'm-chip--info'
    if (s === 'FAILED' || s === 'CANCELLED') return 'm-chip--danger'
    if (s === 'WAITING' || s === 'READY' || s === 'RETRYING') return 'm-chip--warning'
    return ''
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

  async function loadSteps(id: number) {
    stepsLoading.value = true
    try {
      // partitions API 实际返回 step instances(命名沿用桌面端 instanceApi)
      const list = (await instanceApi.partitions(
        id,
        tenant.tenantId,
      )) as unknown as ConsoleJobStepInstanceResponse[]
      steps.value = Array.isArray(list) ? list : []
    } catch {
      steps.value = []
    } finally {
      stepsLoading.value = false
    }
  }

  async function load() {
    const id = instanceId()
    if (!id) return
    loading.value = true
    try {
      row.value = await instanceApi.detail(id, tenant.tenantId)
      await loadSteps(id)
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
      goBack()
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

  // useTenantReload: setup 时 + 切租户 时 load(取代手写 onMounted + watch tenantId)
  useTenantReload(load)
  // 详情页 URL 变化(/m/jobs/123 → /m/jobs/456)也要重拉
  watch(() => route.params.id, load)
  // 实例非终态时短轮询 5s,看后端状态翻转。终态(SUCCESS/FAILED/...)轮询自动停。
  // useAutoRefresh 自身会处理 tab 不可见时暂停。
  const TERMINAL = new Set(['SUCCESS', 'FAILED', 'CANCELLED', 'TERMINATED', 'SKIPPED'])
  const isRunning = computed(() => !!row.value && !TERMINAL.has(row.value.instanceStatus || ''))
  useAutoRefresh(() => {
    if (isRunning.value) void load()
  }, 5_000)
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

  .m-link {
    display: inline;
    margin: 0;
    padding: 0;
    border: none;
    background: none;
    color: var(--color-primary);
    text-decoration: underline;
    cursor: pointer;
    word-break: break-all;
    font: inherit;
  }

  .m-step-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .m-step {
    padding: 8px 10px;
    border-radius: 8px;
    background: var(--el-fill-color-lighter);
  }

  .m-step__title {
    font-weight: 600;
    font-size: 13px;
  }

  .m-step__err {
    margin-top: 4px;
    padding: 6px 8px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--el-color-danger) 8%, transparent);
    color: var(--el-color-danger);
    font-size: 12px;
    word-break: break-all;
  }

  .m-step__err-code {
    font-weight: 700;
    margin-right: 4px;
  }
</style>
