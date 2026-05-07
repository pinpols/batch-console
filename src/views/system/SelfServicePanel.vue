<template>
  <PageContainer>
    <PageHeader title="自助服务" description="查看租户配额与用量，申请配额变更、Job 重跑与补偿。" />

    <SectionCard>
      <el-tabs v-model="activeTab" v-hover-tab-activate="true" class="pill-tabs">
        <el-tab-pane label="配额与用量" name="quota">
          <SelfServiceQuotaTab />
        </el-tab-pane>
        <el-tab-pane label="配额变更" name="quotaChange">
          <SelfServiceQuotaChangeTab />
        </el-tab-pane>
        <el-tab-pane label="重跑申请" name="rerun">
          <SelfServiceRerunTab />
        </el-tab-pane>
        <el-tab-pane label="补偿申请" name="compensation">
          <SelfServiceCompensationTab />
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
  import SelfServiceQuotaTab from './components/SelfServiceQuotaTab.vue'
  import SelfServiceQuotaChangeTab from './components/SelfServiceQuotaChangeTab.vue'
  import SelfServiceRerunTab from './components/SelfServiceRerunTab.vue'
  import SelfServiceCompensationTab from './components/SelfServiceCompensationTab.vue'

  const activeTab = ref('quota')
</script>
