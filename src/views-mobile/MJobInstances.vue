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
        <button class="m-page__refresh" :disabled="loading" @click="load">
          <el-icon><Refresh /></el-icon>
          {{ loading ? t('mobile.common.loading') : t('mobile.common.refresh') }}
        </button>
      </div>

      <div class="m-page__header u-gap-8">
        <el-select
          v-model="query.instanceStatus"
          :placeholder="t('mobile.jobs.placeholderStatus')"
          clearable
          size="small"
          class="u-flex-1"
          @change="onFilterChange"
        >
          <el-option
            v-for="s in statuses"
            :key="s"
            :label="resolveEnumLabel('instanceStatus', s)"
            :value="s"
          />
        </el-select>
        <el-input
          v-model="query.jobCode"
          :placeholder="t('mobile.jobs.placeholderJobCode')"
          clearable
          size="small"
          class="u-flex-1"
          @change="onFilterChange"
        />
      </div>

      <MSkeleton v-if="loading && rows.length === 0" :count="4" />
      <div v-else-if="rows.length === 0" class="m-empty">{{ t('mobile.jobs.empty') }}</div>

      <div
        v-for="row in rows"
        :key="row.id"
        class="m-card m-card--clickable"
        @click="openDetail(row)"
      >
        <div class="m-card__row">
          <div class="m-card__title">{{ row.jobCode }}</div>
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
  import { onMounted, reactive, ref, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { Refresh } from '@element-plus/icons-vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { useTenantStore } from '@/stores/tenant'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import MPullRefresh from '@/layout-mobile/MPullRefresh.vue'
  import MSkeleton from '@/layout-mobile/MSkeleton.vue'
  import { instanceApi } from '@/api/instance'
  import type { ConsoleJobInstanceResponse } from '@/types/console-api'

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

  const statuses = ['CREATED', 'WAITING', 'RUNNING', 'COMPLETED', 'SUCCESS', 'FAILED', 'CANCELLED']

  const query = reactive({
    tenantId: tenant.tenantId,
    jobCode: '',
    instanceStatus: '',
    startDate: '',
    endDate: '',
    page: 1,
    pageSize: 20,
  })

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

  function onFilterChange() {
    page.value = 1
    load()
  }

  function onPageChange(p: number) {
    page.value = p
    load()
  }

  async function retry(row: ConsoleJobInstanceResponse) {
    try {
      await ElMessageBox.confirm(
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
      await ElMessageBox.confirm(
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

  onMounted(load)
  watch(() => tenant.tenantId, load)
</script>
