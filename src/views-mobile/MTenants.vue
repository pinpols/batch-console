<template>
  <MPullRefresh :on-refresh="onPullRefresh">
    <div class="m-page">
      <div class="m-page__header">
        <div>
          <div class="m-page__title">{{ t('mobile.tenants.title') }}</div>
          <div class="m-page__subtitle">
            {{ t('mobile.tenants.subtitle', { total: total || rows.length }) }}
          </div>
        </div>
        <button class="m-page__refresh" :disabled="loading" @click="onPullRefresh">
          <el-icon><Refresh /></el-icon>
          {{ loading ? t('common.loading') : t('common.refresh') }}
        </button>
      </div>

      <div class="m-page__header u-gap-8">
        <el-input
          v-model="keyword"
          :placeholder="t('common.search')"
          clearable
          size="small"
          class="u-flex-1"
        />
        <el-segmented
          v-model="statusFilter"
          :options="statusOptions"
          size="small"
          class="u-flex-1"
        />
      </div>

      <MSkeleton v-if="loading && rows.length === 0" :count="4" />
      <div v-else-if="!loading && rows.length === 0" class="m-empty">
        {{ t('empty.default') }}
      </div>

      <div v-for="row in rows" :key="row.tenantId" class="m-card">
        <div class="m-card__row">
          <div class="m-card__title">{{ row.tenantName }}</div>
          <span :class="['m-chip', statusChipClass(row.status)]">
            {{ resolveEnumLabel('tenantStatus', row.status) }}
          </span>
        </div>
        <div class="m-card__sub">{{ row.tenantId }}</div>
        <div class="m-card__meta">
          <div v-if="row.description">
            <span class="m-card__meta-key">desc</span>
            {{ row.description }}
          </div>
          <div v-if="row.createdAt">
            <span class="m-card__meta-key">{{ t('mobile.tenants.created') }}</span>
            {{ fmt(row.createdAt) }}
          </div>
          <div v-if="row.createdBy">
            <span class="m-card__meta-key">by</span>
            {{ row.createdBy }}
          </div>
        </div>
      </div>

      <div v-if="rows.length > 0" ref="sentinel" class="m-sentinel">
        <span v-if="loading">{{ t('common.loading') }}</span>
        <span v-else-if="!hasMore">{{ t('mobile.tenants.allLoaded') }}</span>
        <button v-else class="m-btn" @click="loadMore">{{ t('mobile.tenants.loadMore') }}</button>
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
  import { useInfiniteList } from '@/composables/useInfiniteList'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { listTenants, type Tenant, type TenantListQuery } from '@/api/tenants'

  const { t, te } = useI18n()
  const sentinel = ref<HTMLElement | null>(null)
  const keyword = ref('')
  const statusFilter = ref<string>('')

  const statusOptions = computed(() => [
    { value: '', label: t('mobile.tenants.statusAll') },
    { value: 'ACTIVE', label: resolveEnumLabel('tenantStatus', 'ACTIVE') },
    { value: 'SUSPENDED', label: resolveEnumLabel('tenantStatus', 'SUSPENDED') },
    { value: 'ARCHIVED', label: resolveEnumLabel('tenantStatus', 'ARCHIVED') },
  ])

  const { data: metaEnums } = useConsoleMetaEnumsQuery()

  function resolveEnumLabel(group: string, value?: string | null): string {
    if (!value) return '—'
    const i18nKey = `enum.${group}.${value}`
    if (te(i18nKey)) return t(i18nKey)
    return metaEnums.value?.[group]?.find((o) => o.value === value)?.label ?? value
  }

  const list = useInfiniteList<Tenant>({
    pageSize: 20,
    fetchPage: async (page, pageSize) => {
      const q: TenantListQuery = {
        pageNo: page,
        pageSize,
        ...(keyword.value ? { keyword: keyword.value } : {}),
        ...(statusFilter.value ? { status: statusFilter.value as TenantListQuery['status'] } : {}),
      }
      const result = await listTenants(q)
      return { rows: result.items ?? [], total: result.total }
    },
  })

  const { rows, total, hasMore, loading, loadMore, reset, attach } = list

  watch(
    sentinel,
    (el) => {
      attach(el)
    },
    { flush: 'post' },
  )

  // 关键字防抖 400ms,避免每次按键都请求
  let kwTimer: ReturnType<typeof setTimeout> | null = null
  watch(keyword, () => {
    if (kwTimer) clearTimeout(kwTimer)
    kwTimer = setTimeout(() => {
      void reset(true)
    }, 400)
  })

  watch(statusFilter, () => {
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

  function statusChipClass(status?: string | null): string {
    switch (status) {
      case 'ACTIVE':
        return 'm-chip--success'
      case 'SUSPENDED':
        return 'm-chip--warning'
      case 'ARCHIVED':
        return ''
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
