<template>
  <MPullRefresh :on-refresh="onPullRefresh">
    <div class="m-page">
      <div class="m-page__header">
        <div>
          <div class="m-page__title">{{ t('mobile.files.title') }}</div>
          <div v-if="!error || rows.length" class="m-page__subtitle">
            {{ t('mobile.files.subtitle', { total: total || rows.length }) }}
          </div>
        </div>
      </div>

      <div class="m-page__header">
        <el-select
          v-model="statusFilter"
          :aria-label="t('mobile.files.statusFilter')"
          :placeholder="t('mobile.files.statusAll')"
          size="small"
          class="u-w-full"
        >
          <el-option
            v-for="option in statusOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </div>

      <MSkeleton v-if="loading && rows.length === 0" :count="4" />
      <div v-else-if="!loading && !error && rows.length === 0" class="m-empty">
        {{ t(statusFilter ? 'mobile.common.emptyForSearch' : 'empty.default') }}
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
            {{ fileSizeLabel(row) }}
          </div>
          <div>
            <span class="m-card__meta-key">{{ t('mobile.files.received') }}</span>
            {{ receivedAtLabel(row) }}
          </div>
          <div v-if="row.traceId">
            <span class="m-card__meta-key">{{ t('common.trace') }}</span>
            <CopyableText class="m-file-trace" :text="String(row.traceId)" :copyable="false">
              <span>{{ String(row.traceId).slice(0, 8) }}</span>
            </CopyableText>
          </div>
        </div>
      </div>

      <div v-if="error" class="m-file-error" :class="{ 'm-empty': rows.length === 0 }" role="alert">
        <div>{{ t('mobile.common.loadFail') }}</div>
        <button class="m-btn" type="button" @click="loadMore">{{ t('common.retry') }}</button>
      </div>

      <!-- IntersectionObserver 哨兵:进入视口前 200px 自动加载下一页 -->
      <div v-if="rows.length > 0 && !error" ref="sentinel" class="m-sentinel">
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
  import { RefreshCw as Refresh } from '@lucide/vue'
  import MPullRefresh from '@/layout-mobile/MPullRefresh.vue'
  import MSkeleton from '@/layout-mobile/MSkeleton.vue'
  import CopyableText from '@/components/common/CopyableText.vue'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useInfiniteList } from '@/composables/useInfiniteList'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { fileApi, type FileQuery } from '@/api/file'
  import { fileStatusColor } from '@/constants/status'
  import type { FileStatus } from '@/types'
  import type { ConsoleFileRecordResponse } from '@/types/console-api'
  import { fmtDatetime } from '@/utils/datetime'

  const { t, te } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()
  const sentinel = ref<HTMLElement | null>(null)
  const statusFilter = ref<string>('')

  const statusOptions = computed(() => [
    { value: '', label: t('mobile.files.statusAll') },
    ...(
      metaEnums.value?.fileStatus?.map((option) => option.value) ?? Object.keys(fileStatusColor)
    ).map((value) => ({
      value,
      label: resolveEnumLabel('fileStatus', value),
    })),
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
    pageSize: 15,
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

  const { rows, total, hasMore, loading, error, loadMore, reset, attach } = list

  // 在哨兵 DOM 就绪 / 重新挂载时绑定 IntersectionObserver
  watch(
    sentinel,
    (el) => {
      attach(el)
    },
    { flush: 'post' },
  )

  // 切租户(走 useTenantReload,setup 时也执行一次) / 改筛选 → 整个列表重置
  useTenantReload(() => reset(true))
  watch(statusFilter, () => {
    void reset(true)
  })

  async function onPullRefresh() {
    await reset(true)
  }

  /**
   * 后端可能返回 ConsoleFileRecordResponse 之外的字段(fileSize / receivedAt),OpenAPI
   * schema 未声明。模板里渲染时通过这个 helper 把 row 转成允许任意字段的 view 类型,
   * 既不破坏严格类型,又允许 UI 渐进展示。
   */
  function extraOf(row: unknown): { fileSize?: number | null; receivedAt?: string | null } {
    return (row as { fileSize?: number | null; receivedAt?: string | null }) ?? {}
  }

  function fileSizeLabel(row: unknown): string {
    const fileSize = extraOf(row).fileSize
    return formatSize(fileSize)
  }

  function receivedAtLabel(row: unknown): string {
    const receivedAt = extraOf(row).receivedAt
    return fmt(receivedAt)
  }

  function fmt(ts?: string | null) {
    return fmtDatetime(ts)
  }

  function formatSize(bytes?: number | null) {
    if (bytes == null) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) {
      const kilobytes = bytes / 1024
      return `${kilobytes.toFixed(1)} KB`
    }
    if (bytes < 1024 * 1024 * 1024) {
      const megabytes = bytes / (1024 * 1024)
      return `${megabytes.toFixed(1)} MB`
    }
    const gigabytes = bytes / (1024 * 1024 * 1024)
    return `${gigabytes.toFixed(2)} GB`
  }

  function statusChipClass(status?: string | null): string {
    const color = status ? fileStatusColor[status as FileStatus] : undefined
    switch (color) {
      case 'success':
        return 'm-chip--success'
      case 'primary':
        return 'm-chip--info'
      case 'warning':
        return 'm-chip--warning'
      case 'danger':
        return 'm-chip--danger'
      default:
        return ''
    }
  }
</script>

<style scoped>
  .m-file-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding-block: 24px;
  }

  .m-file-trace :deep(.copyable-text__inspect) {
    min-width: 44px;
    min-height: 44px;
  }

  .m-sentinel {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 20px 0 32px;
    color: var(--color-text-tertiary);
    font-size: 13px;
  }
</style>
