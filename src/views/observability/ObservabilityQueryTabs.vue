<template>
  <PageContainer>
    <PageHeader />

    <SectionCard>
      <el-tabs v-model="activeTab" v-hover-tab-activate="true" class="pill-tabs">
        <el-tab-pane :label="t('observability.tabDeadLetters')" name="deadLetters">
          <DeadLettersTab />
        </el-tab-pane>
        <el-tab-pane :label="t('observability.tabRetries')" name="retries" lazy>
          <RetriesTab />
        </el-tab-pane>
        <el-tab-pane :label="t('observability.tabExecLogs')" name="executionLogs" lazy>
          <ExecutionLogsTab />
        </el-tab-pane>
        <el-tab-pane :label="t('observability.tabChannelReceipts')" name="channelReceipts" lazy>
          <ChannelReceiptsTab />
        </el-tab-pane>
      </el-tabs>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'

  const { t } = useI18n({ useScope: 'global' })
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import DeadLettersTab from './components/DeadLettersTab.vue'
  import RetriesTab from './components/RetriesTab.vue'
  import ExecutionLogsTab from './components/ExecutionLogsTab.vue'
  import ChannelReceiptsTab from './components/ChannelReceiptsTab.vue'

  type Tab = 'deadLetters' | 'retries' | 'executionLogs' | 'channelReceipts'
  const VALID = new Set<Tab>(['deadLetters', 'retries', 'executionLogs', 'channelReceipts'])

  const route = useRoute()
  const router = useRouter()
  const activeTab = ref<Tab>(
    VALID.has(route.query.tab as Tab) ? (route.query.tab as Tab) : 'deadLetters',
  )

  watch(activeTab, (tab) => {
    void router.replace({ query: { ...route.query, tab } })
  })
</script>
