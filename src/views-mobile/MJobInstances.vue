<template>
  <MPullRefresh :on-refresh="load">
    <div class="m-page">
      <div class="m-page__header">
        <div>
          <div class="m-page__title">{{ t('mobile.jobs.title') }}</div>
          <div class="m-page__subtitle">
            {{ t('mobile.jobs.summary', { total, page }) }}
          </div>
        </div>
      </div>

      <!-- 4 状态 tab + jobCode 搜索栏,跟 告警/Worker/审批 一致 -->
      <div class="m-tabs" role="tablist">
        <button
          v-for="opt in statusTabs"
          :key="opt.value"
          type="button"
          role="tab"
          :aria-selected="(query.instanceStatus || '') === opt.value"
          class="m-tab"
          :class="{ 'm-tab--active': (query.instanceStatus || '') === opt.value }"
          @click="onStatusTab(opt.value)"
        >
          <span class="m-tab__label">{{ opt.label }}</span>
          <span v-if="opt.badge != null" class="m-tab__badge" :class="badgeToneFor(opt.value)">
            {{ opt.badge }}
          </span>
        </button>
      </div>

      <MSearchBar
        :model-value="query.jobCode ?? ''"
        :placeholder="t('mobile.jobs.placeholderJobCode')"
        @update:model-value="onJobCodeInput"
      />

      <!-- SLA 违约筛选指示条:服务端按 deadline_at<now AND active status 过滤 -->
      <div v-if="slaBreachedOnly" class="m-filter-chip">
        <span class="m-filter-chip__label">
          {{ t('mobile.jobs.slaFilterChip', { total }) }}
        </span>
        <button type="button" class="m-filter-chip__clear" @click="clearSlaFilter">
          {{ t('mobile.common.clear') }}
        </button>
      </div>

      <MSkeleton v-if="loading && rows.length === 0" :count="4" />
      <div v-else-if="rows.length === 0" class="m-empty">
        {{ slaBreachedOnly ? t('mobile.jobs.slaEmpty') : t('mobile.jobs.empty') }}
      </div>

      <div
        v-for="row in rows"
        :key="row.id"
        class="m-card m-card--clickable"
        @click="openDetail(row)"
      >
        <div class="m-card__row">
          <div class="m-card__title">
            {{ row.jobCode }}
          </div>
          <span :class="['m-chip', statusChipClass(row.instanceStatus)]">
            {{ resolveEnumLabel('instanceStatus', row.instanceStatus) }}
          </span>
        </div>
        <div class="m-card__sub">{{ row.instanceNo }}</div>
        <div class="m-card__meta">
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
            <span class="m-card__meta-key">{{ t('mobile.jobs.startedAt') }}</span>
            {{ fmt(row.startedAt) }}
          </div>
          <div v-if="row.finishedAt">
            <span class="m-card__meta-key">{{ t('mobile.jobs.finishedAt') }}</span>
            {{ fmt(row.finishedAt) }}
          </div>
        </div>
        <div
          v-if="row.instanceStatus === 'RUNNING' || row.instanceStatus === 'FAILED'"
          class="m-card__actions"
          @click.stop
        >
          <button
            v-if="row.instanceStatus === 'FAILED'"
            class="m-btn m-btn--primary"
            @click="retry(row)"
          >
            {{ t('mobile.jobs.retry') }}
          </button>
          <button
            v-if="row.instanceStatus === 'RUNNING'"
            class="m-btn m-btn--danger"
            @click="terminate(row)"
          >
            {{ t('mobile.jobs.terminate') }}
          </button>
        </div>
      </div>

      <div v-if="total > query.pageSize" class="m-page__header" style="justify-content: center">
        <el-pagination
          small
          background
          layout="prev, pager, next"
          :total="total"
          :current-page="page"
          :page-size="query.pageSize"
          @current-change="onPageChange"
        />
      </div>
    </div>
  </MPullRefresh>
</template>

<script setup lang="ts">
  import { computed, reactive, ref } from 'vue'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { Refresh } from '@element-plus/icons-vue'
  import { ElMessage } from 'element-plus'
  import { confirmActionSheet } from '@/layout-mobile/MActionSheet'
  import { useTenantStore } from '@/stores/tenant'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import MPullRefresh from '@/layout-mobile/MPullRefresh.vue'
  import MSkeleton from '@/layout-mobile/MSkeleton.vue'
  import MSearchBar from '@/layout-mobile/MSearchBar.vue'
  import { instanceApi } from '@/api/instance'
  import type { ConsoleJobInstanceResponse } from '@/types/console-api'

  const route = useRoute()
  const router = useRouter()
  const { t, te } = useI18n({ useScope: 'global' })

  const { data: metaEnums } = useConsoleMetaEnumsQuery()
  function resolveEnumLabel(group: string, value?: string | null): string {
    if (!value) return '—'
    const key = `enum.${group}.${value}`
    if (te(key)) return t(key)
    return metaEnums.value?.[group]?.find((o) => o.value === value)?.label ?? value
  }

  const tenant = useTenantStore()
  const loading = ref(false)
  const rows = ref<ConsoleJobInstanceResponse[]>([])
  const total = ref(0)
  const page = ref(1)

  // 4 状态 tab — '' = 全部。tab 用单数 status,跟后端 query.instanceStatus 直接对应。
  // RUNNING/FAILED/COMPLETED 是 oncall 三大高频档,其它细分状态压在「全部」里。
  const statusTabs = computed<Array<{ value: string; label: string; badge?: number | null }>>(
    () => [
      { value: '', label: t('mobile.jobs.filterAll') },
      { value: 'RUNNING', label: t('mobile.jobs.filterRunning') },
      { value: 'FAILED', label: t('mobile.jobs.filterFailed') },
      { value: 'SUCCESS', label: t('mobile.jobs.filterCompleted') },
    ],
  )

  function badgeToneFor(statusValue: string) {
    if (statusValue === 'RUNNING') return 'm-tab__badge--info'
    if (statusValue === 'FAILED') return 'm-tab__badge--danger'
    if (statusValue === 'SUCCESS') return 'm-tab__badge--success'
    return ''
  }

  // SLA 违约筛选:BE 已支持 slaBreached=true 服务端过滤 (deadline_at<now AND active)
  const slaBreachedOnly = computed(() => route.query.slaBreached === '1')

  const query = reactive({
    tenantId: tenant.tenantId,
    jobCode: '',
    instanceStatus: (route.query.status as string) || '',
    startDate: '',
    endDate: '',
    slaBreached: slaBreachedOnly.value,
    page: 1,
    pageSize: 15,
  })

  function clearSlaFilter() {
    const q = { ...route.query }
    delete q.slaBreached
    router.replace({ path: route.path, query: q })
    query.slaBreached = false
    page.value = 1
    load()
  }

  function fmt(ts?: string | null) {
    if (!ts) return '—'
    try {
      return new Date(ts).toLocaleString('zh-CN', { hour12: false })
    } catch {
      return ts
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
    loading.value = true
    try {
      query.tenantId = tenant.tenantId
      query.page = page.value
      const res = await instanceApi.list(query)
      rows.value = res.records
      total.value = res.total
    } catch {
      ElMessage.error(t('mobile.common.loadFail'))
    } finally {
      loading.value = false
    }
  }

  function openDetail(row: ConsoleJobInstanceResponse) {
    router.push(`/m/jobs/${row.id}`)
  }

  function onStatusTab(status: string) {
    query.instanceStatus = status
    page.value = 1
    load()
  }

  let kwTimer: ReturnType<typeof setTimeout> | null = null
  function onJobCodeInput(v: string) {
    query.jobCode = v
    // 250ms 防抖,避免每个字符都请求
    if (kwTimer) clearTimeout(kwTimer)
    kwTimer = setTimeout(() => {
      page.value = 1
      load()
    }, 250)
  }

  function onPageChange(p: number) {
    page.value = p
    load()
  }

  async function retry(row: ConsoleJobInstanceResponse) {
    try {
      await confirmActionSheet(
        `${t('mobile.jobs.retry')} ${row.instanceNo}?`,
        t('mobile.jobs.retry'),
        {
          type: 'warning',
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
        },
      )
      await instanceApi.retry(row.instanceNo, tenant.tenantId, row.jobCode, row.bizDate)
      ElMessage.success(t('mobile.jobs.retryToast'))
      await load()
    } catch {
      /* cancelled */
    }
  }

  async function terminate(row: ConsoleJobInstanceResponse) {
    try {
      await confirmActionSheet(
        `${t('mobile.jobs.terminate')} ${row.instanceNo}?`,
        t('mobile.jobs.terminate'),
        {
          type: 'warning',
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
        },
      )
      await instanceApi.terminate(row.id, tenant.tenantId)
      ElMessage.success(t('mobile.jobs.terminateToast'))
      await load()
    } catch {
      /* cancelled */
    }
  }

  useTenantReload(load)
</script>

<style scoped>
  .m-filter-chip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin: 4px 0 8px;
    padding: 8px 12px;
    border-radius: 10px;
    background: var(--color-warning-light, rgba(245, 158, 11, 0.12));
    color: var(--color-warning, #b45309);
    font-size: 13px;
    line-height: 1.4;
  }
  .m-filter-chip__label {
    flex: 1;
    min-width: 0;
  }
  .m-filter-chip__clear {
    flex-shrink: 0;
    padding: 4px 10px;
    border: none;
    border-radius: 8px;
    background: rgb(0 0 0 / 6%);
    color: inherit;
    font-size: 12px;
    cursor: pointer;
  }
</style>
