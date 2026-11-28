<template>
  <PageContainer>
    <PageHeader />
    <RelatedPageLinks :paths="['/reports']" />

    <el-tabs v-model="activeTab" class="pill-tabs">
      <el-tab-pane
        v-if="canViewUsage"
        :label="t('page.observabilityUsage.title')"
        name="usage"
        lazy
      >
        <UsageSummary embedded />
      </el-tab-pane>
      <el-tab-pane
        v-if="canViewCapacity"
        :label="t('page.opsCapacityProfile.title')"
        name="capacity"
        lazy
      >
        <CapacityProfile embedded />
      </el-tab-pane>
    </el-tabs>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import RelatedPageLinks from '@/components/common/RelatedPageLinks.vue'
  import UsageSummary from './UsageSummary.vue'
  import CapacityProfile from '@/views/ops/CapacityProfile.vue'
  import { useAuthStore } from '@/stores/auth'
  import { usePermissionStore } from '@/stores/permission'

  type UsageAnalyticsTab = 'usage' | 'capacity'

  const { t } = useI18n({ useScope: 'global' })
  const route = useRoute()
  const router = useRouter()
  const auth = useAuthStore()
  const permission = usePermissionStore()

  // 使用统计限平台管理员/租户管理员/审计员，容量画像沿用 VIEWER 权限
  const canViewUsage = computed(
    () =>
      auth.hasPermission('ROLE_ADMIN') ||
      auth.hasPermission('ROLE_TENANT_ADMIN') ||
      auth.hasPermission('ROLE_AUDITOR'),
  )
  const canViewCapacity = computed(() => permission.canAccessRole('VIEWER'))

  const availableTabs = computed<UsageAnalyticsTab[]>(() => {
    const tabs: UsageAnalyticsTab[] = []
    if (canViewUsage.value) tabs.push('usage')
    if (canViewCapacity.value) tabs.push('capacity')
    return tabs
  })

  function resolveTab(value: unknown): UsageAnalyticsTab {
    const tabs = availableTabs.value
    if (tabs.includes(value as UsageAnalyticsTab)) return value as UsageAnalyticsTab
    return tabs[0] ?? 'capacity'
  }

  const activeTab = ref<UsageAnalyticsTab>(resolveTab(route.query.tab))

  watch([() => route.query.tab, availableTabs], ([tab]) => {
    const next = resolveTab(tab)
    if (next !== activeTab.value) activeTab.value = next
  })

  watch(activeTab, (tab) => {
    if (route.query.tab !== tab) void router.replace({ query: { ...route.query, tab } })
  })
</script>
