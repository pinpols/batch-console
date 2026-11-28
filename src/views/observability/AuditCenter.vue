<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button
          v-if="canOpenPath('/observability/queries')"
          :icon="ScrollText"
          @click="router.push({ path: '/observability/queries', query: { tab: 'executionLogs' } })"
        >
          {{ t('page.logs.title') }}
        </el-button>
        <el-button
          v-if="canOpenPath('/observability/usage')"
          :icon="ChartNoAxesCombined"
          @click="router.push('/observability/usage')"
        >
          {{ t('page.observabilityUsage.title') }}
        </el-button>
      </template>
    </PageHeader>

    <el-tabs v-model="activeTab" class="pill-tabs">
      <el-tab-pane :label="t('page.observabilityOperationAudits.title')" name="operation" lazy>
        <OperationAuditList embedded />
      </el-tab-pane>
      <el-tab-pane :label="t('page.observabilityAudits.title')" name="file" lazy>
        <AuditList embedded />
      </el-tab-pane>
    </el-tabs>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { ChartNoAxesCombined, ScrollText } from '@lucide/vue'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import OperationAuditList from './OperationAuditList.vue'
  import AuditList from './AuditList.vue'
  import { useRouteAccess } from '@/composables/useRouteAccess'

  type AuditTab = 'operation' | 'file'
  const TABS: readonly AuditTab[] = ['operation', 'file']

  const { t } = useI18n({ useScope: 'global' })
  const route = useRoute()
  const router = useRouter()
  const { canOpenPath } = useRouteAccess()

  function resolveTab(value: unknown): AuditTab {
    return TABS.includes(value as AuditTab) ? (value as AuditTab) : 'operation'
  }

  const activeTab = ref<AuditTab>(resolveTab(route.query.tab))

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
