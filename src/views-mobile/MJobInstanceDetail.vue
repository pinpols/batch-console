<template>
  <MPullRefresh :on-refresh="load">
    <div class="m-page">
      <div class="m-page__header">
        <button class="m-page__back" @click="goBack()">
          <el-icon><ArrowLeft /></el-icon>
          <span>{{ t('common.backToPrev') }}</span>
        </button>
      </div>

      <el-alert
        v-if="!notificationContextAllowed"
        type="warning"
        show-icon
        :closable="false"
        :title="t('mobile.jobDetail.notificationTenantMismatch')"
      />
      <div v-else-if="loading && !row" class="m-loading">{{ t('mobile.common.loading') }}</div>
      <div v-else-if="!row || !hasCurrentRow" class="m-empty">
        {{ t('mobile.jobDetail.empty') }}
      </div>

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
            <div>
              <span class="m-card__meta-key">{{ t('mobile.jobs.queue') }}</span>
              {{ row.queueCode || '—' }}
            </div>
            <div>
              <span class="m-card__meta-key">{{ t('mobile.jobs.worker') }}</span>
              {{ row.workerGroup || '—' }}
            </div>
            <div>
              <span class="m-card__meta-key">{{ t('mobile.jobs.startedAt') }}</span>
              {{ fmt(row.startedAt) }}
            </div>
            <div>
              <span class="m-card__meta-key">{{ t('mobile.jobs.finishedAt') }}</span>
              {{ fmt(row.finishedAt) }}
            </div>
            <div>
              <span class="m-card__meta-key">{{ t('mobile.jobs.traceId') }}</span>
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
              v-if="canWriteSystem && row.instanceStatus === 'FAILED'"
              class="m-btn m-btn--primary"
              @click="retry"
            >
              {{ t('mobile.jobs.retry') }}
            </button>
            <button
              v-if="canWriteSystem && row.instanceStatus === 'RUNNING'"
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
                <div>{{ t('mobile.jobDetail.stepRetryCount') }} · {{ s.retryCount }}</div>
                <div v-if="s.startedAt">
                  {{ t('mobile.jobDetail.stepStartedAt') }} · {{ fmt(s.startedAt) }}
                </div>
                <div v-if="s.finishedAt">
                  {{ t('mobile.jobDetail.stepFinishedAt') }} · {{ fmt(s.finishedAt) }}
                </div>
              </div>
              <div v-if="s.errorCode || s.errorMessage" class="m-step__err">
                <span v-if="s.errorCode" class="m-step__err-code">[{{ s.errorCode }}]</span>
                {{ s.errorMessage }}
              </div>
            </div>
          </div>
        </div>

        <div v-if="heartbeatTaskId" class="m-card">
          <div class="m-card__row">
            <div class="m-card__title">{{ t('mJobDetail.heartbeatTitle') }}</div>
            <span v-if="heartbeatLoading" class="m-card__sub">{{
              t('mobile.common.loading')
            }}</span>
          </div>
          <div v-if="heartbeatNotFound" class="m-card__sub">
            {{ t('heartbeatPanel.notFoundBody') }}
          </div>
          <template v-else-if="heartbeatLatest">
            <div v-if="heartbeatPercent !== null" class="m-progress">
              <div class="m-progress__bar" :style="{ width: heartbeatPercent + '%' }" />
              <span class="m-progress__label">{{ heartbeatPercent }}%</span>
            </div>
            <div class="m-card__meta">
              <div>
                <span class="m-card__meta-key">{{ t('heartbeatPanel.heartbeatAt') }}</span>
                {{ heartbeatLatest.heartbeatAt ? fmt(heartbeatLatest.heartbeatAt) : '—' }}
              </div>
              <div v-if="heartbeatLatest.cancelRequested">
                <span class="m-card__meta-key">{{ t('heartbeatPanel.cancelRequested') }}</span>
                ✓
              </div>
            </div>
            <details v-if="heartbeatLatest.details" class="m-details">
              <summary>{{ t('mJobDetail.heartbeatRaw') }}</summary>
              <JsonPreview :data="heartbeatLatest.details" />
            </details>
            <div v-else class="m-card__sub">{{ t('heartbeatPanel.noDetailsBody') }}</div>
          </template>
        </div>

        <div class="m-card">
          <div class="m-card__title" style="margin-bottom: 6px">
            {{ t('jobInstanceDetail.paramsSnapshot') }}
          </div>
          <JsonPreview :data="row.paramsSnapshot" />
        </div>

        <div class="m-card">
          <div class="m-card__title" style="margin-bottom: 6px">
            {{ t('jobInstanceDetail.resultSummary') }}
          </div>
          <JsonPreview :data="row.resultSummary" />
        </div>
      </template>
    </div>
  </MPullRefresh>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { usePermission } from '@/composables/usePermission'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { ArrowLeft, RefreshCw as Refresh } from '@lucide/vue'
  import { ElMessage } from 'element-plus'
  import { confirmActionSheet } from '@/layout-mobile/MActionSheet'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useAutoRefresh } from '@/composables/useAutoRefresh'
  import { useSmartBack } from '@/composables/useSmartBack'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { instanceApi } from '@/api/instance'
  import {
    getTaskHeartbeatDetails,
    extractProgressPercent,
    type TaskHeartbeatDetails,
  } from '@/api/taskHeartbeat'
  import MPullRefresh from '@/layout-mobile/MPullRefresh.vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'
  import type {
    ConsoleJobInstanceResponse,
    ConsoleJobStepInstanceResponse,
  } from '@/types/console-api'
  import { fmtDatetime } from '@/utils/datetime'
  import { notificationTenantMatches } from './mobileJobTarget'

  const { t, te } = useI18n({ useScope: 'global' })
  const route = useRoute()
  const router = useRouter()
  const tenant = useTenantStore()
  const { canWriteSystem } = usePermission()
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
  const notificationContextAllowed = computed(() =>
    notificationTenantMatches(route.query.tenantId, tenant.tenantId),
  )
  let loadGeneration = 0
  const loadedTenant = ref('')
  const hasCurrentRow = computed(() => currentTarget() !== null)

  function currentTarget() {
    const detail = row.value
    if (!detail) return null
    const currentDetailMatchesRoute =
      notificationContextAllowed.value &&
      loadedTenant.value === tenant.tenantId &&
      typeof detail.id === 'number' &&
      detail.id === instanceId()
    if (!currentDetailMatchesRoute) return null
    return {
      id: detail.id,
      tenantId: loadedTenant.value,
      instanceNo: detail.instanceNo,
      jobCode: detail.jobCode,
      bizDate: detail.bizDate,
    }
  }
  function isTargetCurrent(target: { id: number; tenantId: string }) {
    const current = currentTarget()
    return !!current && current.id === target.id && current.tenantId === target.tenantId
  }
  function isCurrentLoad(id: number, expectedTenant: string, generation: number) {
    return (
      generation === loadGeneration &&
      id === instanceId() &&
      expectedTenant === tenant.tenantId &&
      notificationContextAllowed.value
    )
  }

  function fmt(ts?: string | null) {
    return fmtDatetime(ts)
  }

  function pretty(raw?: string | null): string {
    if (!raw) return ''
    try {
      const parsedValue: unknown = JSON.parse(raw)
      return JSON.stringify(parsedValue, null, 2)
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

  async function loadSteps(id: number, expectedTenant: string, generation: number) {
    stepsLoading.value = true
    try {
      const list = (await instanceApi.partitions(
        id,
        expectedTenant,
      )) as unknown as ConsoleJobStepInstanceResponse[]
      if (isCurrentLoad(id, expectedTenant, generation))
        steps.value = Array.isArray(list) ? list : []
    } catch {
      if (isCurrentLoad(id, expectedTenant, generation)) steps.value = []
    } finally {
      if (isCurrentLoad(id, expectedTenant, generation)) stepsLoading.value = false
    }
  }

  async function load() {
    const generation = ++loadGeneration
    const id = instanceId()
    const expectedTenant = tenant.tenantId
    row.value = null
    steps.value = []
    stepsLoading.value = false
    loadedTenant.value = ''
    loading.value = false
    const instanceIdIsValid = Number.isSafeInteger(id) && id > 0
    if (!instanceIdIsValid || !notificationContextAllowed.value) return
    loading.value = true
    try {
      const detail = await instanceApi.detail(id, expectedTenant)
      if (!isCurrentLoad(id, expectedTenant, generation)) return
      const hasTenantMismatch = Boolean(
        detail && detail.tenantId && detail.tenantId !== expectedTenant,
      )
      if (!detail || hasTenantMismatch) throw new Error('Job tenant mismatch')
      row.value = detail
      loadedTenant.value = expectedTenant
      await loadSteps(id, expectedTenant, generation)
    } catch {
      if (isCurrentLoad(id, expectedTenant, generation)) {
        row.value = null
        loadedTenant.value = ''
        ElMessage.error(t('mobile.common.loadFail'))
      }
    } finally {
      if (isCurrentLoad(id, expectedTenant, generation)) loading.value = false
    }
  }

  async function retry() {
    if (!canWriteSystem.value) return
    const target = currentTarget()
    if (!target) return
    try {
      await confirmActionSheet(
        `${t('mobile.jobs.retry')} ${target.instanceNo}?`,
        t('mobile.jobs.retry'),
        {
          type: 'warning',
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
        },
      )
      if (!isTargetCurrent(target) || !canWriteSystem.value) return
      await instanceApi.retry(target.instanceNo, target.tenantId, target.jobCode, target.bizDate)
      if (!isTargetCurrent(target)) return
      ElMessage.success(t('mobile.jobDetail.retrySuccess'))
      goBack()
    } catch {
      /* cancelled */
    }
  }

  async function terminate() {
    if (!canWriteSystem.value) return
    const target = currentTarget()
    if (!target) return
    try {
      await confirmActionSheet(
        `${t('mobile.jobs.terminate')} ${target.instanceNo}?`,
        t('mobile.jobs.terminate'),
        {
          type: 'warning',
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
        },
      )
      if (!isTargetCurrent(target) || !canWriteSystem.value) return
      await instanceApi.terminate(target.id, target.tenantId)
      if (!isTargetCurrent(target)) return
      ElMessage.success(t('mobile.jobDetail.terminateSuccess'))
      await load()
    } catch {
      /* cancelled */
    }
  }

  // useTenantReload: setup 时 + 切租户 时 load(取代手写 onMounted + watch tenantId)
  useTenantReload(load)
  // 详情页 URL 变化(/m/jobs/123 → /m/jobs/456)也要重拉
  watch(() => [route.params.id, route.query.tenantId], load)
  // 实例非终态时短轮询 5s,看后端状态翻转。终态(SUCCESS/FAILED/...)轮询自动停。
  // useAutoRefresh 自身会处理 tab 不可见时暂停。
  const TERMINAL = new Set([
    'SUCCESS',
    'FAILED',
    'CANCELLED',
    'TERMINATED',
    'SKIPPED',
    'PARTIAL_FAILED',
    'SUCCESS_DRY_RUN',
    'FAILED_DRY_RUN',
  ])
  const isRunning = computed(() => !!row.value && !TERMINAL.has(row.value.instanceStatus || ''))
  useAutoRefresh(() => {
    if (isRunning.value) void load()
  }, 5_000)

  // C 区(SDK Phase 4 / FE 2-C):优先取 RUNNING 步骤的 jobTaskId,否则取最后一个(序号最大)
  const heartbeatTaskId = computed<number | null>(() => {
    const opts = steps.value.filter(
      (s) => typeof s.jobTaskId === 'number' && (s.jobTaskId as number) > 0,
    )
    if (opts.length === 0) return null
    const running = opts.find((s) => s.stepStatus === 'RUNNING')
    return (running?.jobTaskId ?? opts[opts.length - 1].jobTaskId) as number
  })
  const heartbeatLatest = ref<TaskHeartbeatDetails | null>(null)
  const heartbeatLoading = ref(false)
  const heartbeatNotFound = ref(false)
  const heartbeatPercent = computed(() => extractProgressPercent(heartbeatLatest.value?.details))

  let heartbeatGeneration = 0
  async function loadHeartbeat() {
    const generation = ++heartbeatGeneration
    const target = currentTarget()
    const id = heartbeatTaskId.value
    if (!id || !target) {
      heartbeatLatest.value = null
      heartbeatNotFound.value = false
      heartbeatLoading.value = false
      return
    }
    const current = () =>
      generation === heartbeatGeneration && id === heartbeatTaskId.value && isTargetCurrent(target)
    heartbeatLoading.value = true
    try {
      const result = await getTaskHeartbeatDetails(id, target.tenantId)
      if (!current()) return
      heartbeatNotFound.value = result === null
      heartbeatLatest.value = result
    } catch {
      if (current()) heartbeatLatest.value = null
    } finally {
      if (current()) heartbeatLoading.value = false
    }
  }

  watch(heartbeatTaskId, () => void loadHeartbeat(), { immediate: true })
  // 心跳跟随实例自动刷新一起拉(实例终态时也会跟随停)
  useAutoRefresh(() => {
    if (isRunning.value && heartbeatTaskId.value) void loadHeartbeat()
  }, 10_000)
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

  .m-progress {
    position: relative;
    height: 14px;
    border-radius: 999px;
    background: var(--el-fill-color);
    overflow: hidden;
    margin: 8px 0 6px;
  }

  .m-progress__bar {
    height: 100%;
    background: linear-gradient(
      90deg,
      var(--color-primary, #1677ff),
      color-mix(in srgb, var(--color-primary, #1677ff) 70%, white)
    );
    transition: width 0.3s ease;
  }

  .m-progress__label {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: 10px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .m-details {
    margin-top: 6px;
  }

  .m-details summary {
    cursor: pointer;
    font-size: 12px;
    color: var(--color-text-secondary);
    padding: 4px 0;
  }
</style>
