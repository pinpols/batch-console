<template>
  <PageContainer>
    <PageHeader />

    <SectionCard>
      <el-tabs v-model="activeTab" v-hover-tab-activate="true" class="pill-tabs">
        <el-tab-pane :label="t('selfServicePanel.tabQuota')" name="quota">
          <SelfServiceQuotaTab />
        </el-tab-pane>
        <el-tab-pane :label="t('selfServicePanel.tabQuotaChange')" name="quotaChange">
          <SelfServiceQuotaChangeTab />
        </el-tab-pane>
        <el-tab-pane :label="t('selfServicePanel.tabRerun')" name="rerun">
          <SelfServiceRerunTab />
        </el-tab-pane>
        <el-tab-pane :label="t('selfServicePanel.tabCompensation')" name="compensation">
          <SelfServiceCompensationTab />
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
  import SelfServiceQuotaTab from './components/SelfServiceQuotaTab.vue'
  import SelfServiceQuotaChangeTab from './components/SelfServiceQuotaChangeTab.vue'
  import SelfServiceRerunTab from './components/SelfServiceRerunTab.vue'
  import SelfServiceCompensationTab from './components/SelfServiceCompensationTab.vue'

  const { t } = useI18n({ useScope: 'global' })
  const activeTab = ref('quota')
</script>
