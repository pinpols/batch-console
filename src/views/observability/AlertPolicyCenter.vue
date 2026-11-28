<template>
  <PageContainer>
    <PageHeader />

    <el-tabs v-model="activeTab" class="pill-tabs">
      <el-tab-pane
        v-if="canViewJobMonitoring"
        :label="t('alertPolicyCenter.tabJobMonitoring')"
        name="job-monitoring"
        lazy
      >
        <JobMonitoringPolicies embedded />
      </el-tab-pane>
      <el-tab-pane
        v-if="canViewFreshness"
        :label="t('alertPolicyCenter.tabFreshness')"
        name="freshness"
        lazy
      >
        <AssetFreshnessPolicies embedded />
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
  import JobMonitoringPolicies from './JobMonitoringPolicies.vue'
  import AssetFreshnessPolicies from '@/views/ops/AssetFreshnessPolicies.vue'
  import { useAuthStore } from '@/stores/auth'
  import { usePermissionStore } from '@/stores/permission'

  type AlertPolicyTab = 'job-monitoring' | 'freshness'

  const { t } = useI18n({ useScope: 'global' })
  const route = useRoute()
  const router = useRouter()
  const auth = useAuthStore()
  const permission = usePermissionStore()

  // 两个页签保留原页面权限：作业监控策略限平台/租户管理员，资产新鲜度沿用 OPERATOR
  const canViewJobMonitoring = computed(
    () => auth.hasPermission('ROLE_ADMIN') || auth.hasPermission('ROLE_TENANT_ADMIN'),
  )
  const canViewFreshness = computed(() => permission.canAccessRole('OPERATOR'))

  const availableTabs = computed<AlertPolicyTab[]>(() => {
    const tabs: AlertPolicyTab[] = []
    if (canViewJobMonitoring.value) tabs.push('job-monitoring')
    if (canViewFreshness.value) tabs.push('freshness')
    return tabs
  })

  function resolveTab(value: unknown): AlertPolicyTab {
    const tabs = availableTabs.value
    if (tabs.includes(value as AlertPolicyTab)) return value as AlertPolicyTab
    return tabs[0] ?? 'job-monitoring'
  }

  const activeTab = ref<AlertPolicyTab>(resolveTab(route.query.tab))

  watch([() => route.query.tab, availableTabs], ([tab]) => {
    const next = resolveTab(tab)
    if (next !== activeTab.value) activeTab.value = next
  })

  watch(activeTab, (tab) => {
    if (route.query.tab !== tab) void router.replace({ query: { ...route.query, tab } })
  })
</script>
