<template>
  <MPullRefresh :on-refresh="onPullRefresh">
    <div class="m-page">
      <div class="m-page__header">
        <div>
          <div class="m-page__title">{{ t('mobile.files.title') }}</div>
          <div class="m-page__subtitle">
            {{ t('mobile.files.subtitle', { total: total || rows.length }) }}
          </div>
        </div>
        <button class="m-page__refresh" :disabled="loading" @click="onPullRefresh">
          <el-icon><Refresh /></el-icon>
          {{ loading ? t('common.loading') : t('common.refresh') }}
        </button>
      </div>

      <div class="m-page__header">
        <el-segmented
          v-model="statusFilter"
          :options="statusOptions"
          size="small"
          class="u-w-full"
        />
      </div>

      <MSkeleton v-if="loading && rows.length === 0" :count="4" />
      <div v-else-if="!loading && rows.length === 0" class="m-empty">
        {{ t('empty.default') }}
      </div>

      <div v-for="row in rows" :key="row.id" class="m-card">
        <div class="m-card__row">
          <div class="m-card__title">{{ row.fileName ?? '—' }}</div>
          <span :class="['m-chip', statusChipClass(row.fileStatus)]">
            {{ resolveEnumLabel('fileStatus', row.fileStatus) }}
          </span>
        </div>
        <div class="m-card__sub">{{ row.bizType ?? '—' }}</div>
        <div class="m-card__meta">
          <div>
            <span class="m-card__meta-key">{{ t('mobile.files.bizDate') }}</span>
            {{ row.bizDate ?? '—' }}
          </div>
          <div>
            <span class="m-card__meta-key">{{ t('mobile.files.size') }}</span>
            {{ formatSize(row.fileSize) }}
          </div>
          <div>
            <span class="m-card__meta-key">{{ t('mobile.files.received') }}</span>
            {{ fmt(row.receivedAt) }}
          </div>
          <div v-if="row.traceId">
            <span class="m-card__meta-key">trace</span>
            {{ String(row.traceId).slice(0, 8) }}
          </div>
        </div>
      </div>

      <!-- IntersectionObserver 哨兵:进入视口前 200px 自动加载下一页 -->
      <div v-if="rows.length > 0" ref="sentinel" class="m-sentinel">
        <span v-if="loading">{{ t('common.loading') }}</span>
        <span v-else-if="!hasMore">{{ t('mobile.files.allLoaded') }}</span>
        <button v-else class="m-btn" @click="loadMore">{{ t('mobile.files.loadMore') }}</button>
      </div>
    </div>
  </MPullRefresh>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { Refresh } from '@element-plus/icons-vue'
  import MPullRefresh from '@/layout-mobile/MPullRefresh.vue'
  import MSkeleton from '@/layout-mobile/MSkeleton.vue'
  import { useTenantStore } from '@/stores/tenant'
  import { useInfiniteList } from '@/composables/useInfiniteList'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { fileApi, type FileQuery } from '@/api/file'
  import type { ConsoleFileRecordResponse } from '@/types/console-api'

  const { t, te } = useI18n()
  const tenant = useTenantStore()
  const sentinel = ref<HTMLElement | null>(null)
  const statusFilter = ref<string>('')

  const statusOptions = computed(() => [
    { value: '', label: t('mobile.files.statusAll') },
    { value: 'RECEIVED', label: resolveEnumLabel('fileStatus', 'RECEIVED') },
    { value: 'PROCESSING', label: resolveEnumLabel('fileStatus', 'PROCESSING') },
    { value: 'COMPLETED', label: resolveEnumLabel('fileStatus', 'COMPLETED') },
    { value: 'FAILED', label: resolveEnumLabel('fileStatus', 'FAILED') },
  ])

  const { data: metaEnums } = useConsoleMetaEnumsQuery()

  function resolveEnumLabel(group: string, value?: string | null): string {
    if (!value) return '—'
    const i18nKey = `enum.${group}.${value}`
    if (te(i18nKey)) return t(i18nKey)
    const fromMeta = metaEnums.value?.[group]?.find((o) => o.value === value)?.label
    return fromMeta ?? value
  }

  const list = useInfiniteList<ConsoleFileRecordResponse>({
    pageSize: 20,
    fetchPage: async (page, pageSize) => {
      const q: FileQuery = {
        tenantId: tenant.tenantId,
        page,
        pageSize,
        ...(statusFilter.value ? { fileStatus: statusFilter.value } : {}),
      }
      const result = await fileApi.list(q)
      return { rows: result.records, total: result.total }
    },
  })

  const { rows, total, hasMore, loading, loadMore, reset, attach } = list

  // 在哨兵 DOM 就绪 / 重新挂载时绑定 IntersectionObserver
  watch(
    sentinel,
    (el) => {
      attach(el)
    },
    { flush: 'post' },
  )

  // 切租户 / 改筛选 → 整个列表重置
  watch([() => tenant.tenantId, statusFilter], () => {
    void reset(true)
  })

  async function onPullRefresh() {
    await reset(true)
  }

  function fmt(ts?: string | null) {
    if (!ts) return '—'
    try {
      return new Date(ts).toLocaleString(undefined, { hour12: false })
    } catch {
      return ts
    }
  }

  function formatSize(bytes?: number | null) {
    if (bytes == null) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  function statusChipClass(status?: string | null): string {
    switch (status) {
      case 'COMPLETED':
        return 'm-chip--success'
      case 'PROCESSING':
      case 'DISPATCHED':
        return 'm-chip--info'
      case 'FAILED':
        return 'm-chip--danger'
      default:
        return ''
    }
  }
</script>

<style scoped>
  .m-sentinel {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 20px 0 32px;
    color: var(--color-text-tertiary);
    font-size: 13px;
  }
</style>
