<template>
  <PageContainer>
    <PageHeader />

    <SectionCard>
      <el-tabs v-model="activeTab" v-hover-tab-activate="true" class="pill-tabs">
        <el-tab-pane :label="t('configManagement.tabLogs')" name="logs">
          <ConfigChangeLogsTab />
        </el-tab-pane>
        <el-tab-pane label="Secrets" name="secrets">
          <ConfigSecretsTab />
        </el-tab-pane>
        <el-tab-pane :label="t('configManagement.tabSync')" name="sync">
          <ConfigSyncTab />
        </el-tab-pane>
        <el-tab-pane :label="t('configManagement.tabSyncLogs')" name="syncLogs">
          <ConfigSyncLogsTab />
        </el-tab-pane>
      </el-tabs>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ConfigChangeLogsTab from './components/ConfigChangeLogsTab.vue'
  import ConfigSecretsTab from './components/ConfigSecretsTab.vue'
  import ConfigSyncTab from './components/ConfigSyncTab.vue'
  import ConfigSyncLogsTab from './components/ConfigSyncLogsTab.vue'

  const { t } = useI18n({ useScope: 'global' })
  const activeTab = ref('logs')
</script>
