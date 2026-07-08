<template>
  <PageContainer>
    <PageHeader />

    <!-- 照设计 proto-approvals dump:pill 双 tab(通用/补跑)+ mono 计数;
         搜索/筛选保留在各 tab 内的查询条(功能比 dump 顶部单搜索框更全) -->
    <div class="ap-tabs">
      <div class="ap-tabs__group">
        <button
          type="button"
          class="ap-tab"
          :class="{ 'is-active': activeTab === 'general' }"
          @click="activeTab = 'general'"
        >
          {{ t('approvals.tabGeneral') }}
          <span v-if="generalCount !== null" class="ap-tab__count">{{ generalCount }}</span>
        </button>
        <button
          type="button"
          class="ap-tab"
          :class="{ 'is-active': activeTab === 'catch-up' }"
          @click="activeTab = 'catch-up'"
        >
          {{ t('approvals.tabCatchUp') }}
          <span v-if="catchUpCount !== null" class="ap-tab__count">{{ catchUpCount }}</span>
        </button>
      </div>
    </div>

    <div v-show="activeTab === 'general'">
      <GeneralApprovalsTab />
    </div>
    <div v-show="activeTab === 'catch-up'">
      <CatchUpApprovalsTab />
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'

  const { t } = useI18n({ useScope: 'global' })
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import GeneralApprovalsTab from './components/GeneralApprovalsTab.vue'
  import CatchUpApprovalsTab from './components/CatchUpApprovalsTab.vue'
  import { queryApprovalsPage, queryCatchUpApprovalsPage } from '@/api/approvals'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'

  const route = useRoute()
  const router = useRouter()
  const tenant = useTenantStore()
  const VALID = new Set(['general', 'catch-up'])
  const activeTab = ref<'general' | 'catch-up'>(
    VALID.has(String(route.query.tab)) ? (route.query.tab as 'general' | 'catch-up') : 'general',
  )

  watch(activeTab, (tab) => {
    void router.replace({ query: { ...route.query, tab } })
  })

  // tab 计数(dump 的 mono pill):通用 = 待审批数;补跑 = 待处理 catch-up 数。
  // 拉 pageSize=1 只取 total,失败时不显示计数(不编数字)。
  const generalCount = ref<number | null>(null)
  const catchUpCount = ref<number | null>(null)

  async function loadCounts() {
    if (!tenant.tenantId) return
    const [g, c] = await Promise.allSettled([
      queryApprovalsPage(tenant.tenantId, 1, 1, { approvalStatus: 'PENDING' }),
      queryCatchUpApprovalsPage(tenant.tenantId, 1, 1),
    ])
    generalCount.value = g.status === 'fulfilled' ? Number(g.value.total ?? 0) : null
    catchUpCount.value = c.status === 'fulfilled' ? Number(c.value.total ?? 0) : null
  }

  useTenantReload(loadCounts)
</script>

<style scoped>
  /* ── 照 proto-approvals dump 1:1(docs/redesign/proto-approvals.html) ── */
  .ap-tabs {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 14px;
  }

  .ap-tabs__group {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 10px;
  }

  .ap-tab {
    height: 30px;
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 0 16px;
    border: none;
    border-radius: 7px;
    cursor: pointer;
    font-size: 13px;
    font-family: inherit;
    color: var(--color-text-secondary);
    background: transparent;
    font-weight: 400;
  }

  .ap-tab.is-active {
    color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 12%, transparent);
    font-weight: 600;
  }

  .ap-tab__count {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-text-secondary);
  }

  .ap-tab.is-active .ap-tab__count {
    color: var(--color-primary);
  }
</style>
