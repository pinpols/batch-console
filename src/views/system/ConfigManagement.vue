<template>
  <PageContainer>
    <PageHeader />

    <SectionCard>
      <el-tabs v-model="activeTab" v-hover-tab-activate="true" class="pill-tabs">
        <el-tab-pane label="变更日志" name="logs">
          <ConfigChangeLogsTab />
        </el-tab-pane>
        <el-tab-pane label="Secrets" name="secrets">
          <ConfigSecretsTab />
        </el-tab-pane>
        <el-tab-pane label="配置同步" name="sync">
          <ConfigSyncTab />
        </el-tab-pane>
        <el-tab-pane label="同步日志" name="syncLogs">
          <ConfigSyncLogsTab />
        </el-tab-pane>
      </el-tabs>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ConfigChangeLogsTab from './components/ConfigChangeLogsTab.vue'
  import ConfigSecretsTab from './components/ConfigSecretsTab.vue'
  import ConfigSyncTab from './components/ConfigSyncTab.vue'
  import ConfigSyncLogsTab from './components/ConfigSyncLogsTab.vue'

  const activeTab = ref('logs')
</script>
