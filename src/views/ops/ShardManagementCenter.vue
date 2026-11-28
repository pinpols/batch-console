<template>
  <PageContainer>
    <PageHeader />

    <el-tabs v-model="activeTab" class="pill-tabs">
      <el-tab-pane :label="t('shardManagementCenter.tabCatalog')" name="catalog" lazy>
        <ShardCatalogList embedded />
      </el-tab-pane>
      <el-tab-pane :label="t('shardManagementCenter.tabPlacements')" name="placements" lazy>
        <TenantPlacementList embedded />
      </el-tab-pane>
    </el-tabs>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import ShardCatalogList from './ShardCatalogList.vue'
  import TenantPlacementList from './TenantPlacementList.vue'

  type ShardTab = 'catalog' | 'placements'
  const TABS: readonly ShardTab[] = ['catalog', 'placements']

  const { t } = useI18n({ useScope: 'global' })
  const route = useRoute()
  const router = useRouter()

  function resolveTab(value: unknown): ShardTab {
    return TABS.includes(value as ShardTab) ? (value as ShardTab) : 'catalog'
  }

  const activeTab = ref<ShardTab>(resolveTab(route.query.tab))

  watch(
    () => route.query.tab,
    (tab) => {
      const next = resolveTab(tab)
      if (next !== activeTab.value) activeTab.value = next
    },
  )

  watch(activeTab, (tab) => {
    if (route.query.tab !== tab) void router.replace({ query: { ...route.query, tab } })
  })
</script>
