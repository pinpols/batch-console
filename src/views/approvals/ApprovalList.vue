<template>
  <PageContainer>
    <PageHeader title="审批中心" description="通用审批与 Catch-up 审批的统一处理入口。" />

    <SectionCard>
      <el-tabs v-model="activeTab" v-hover-tab-activate="true" class="pill-tabs">
        <el-tab-pane label="通用审批" name="general">
          <GeneralApprovalsTab />
        </el-tab-pane>
        <el-tab-pane label="Catch-up 审批" name="catch-up">
          <CatchUpApprovalsTab />
        </el-tab-pane>
      </el-tabs>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import GeneralApprovalsTab from './components/GeneralApprovalsTab.vue'
  import CatchUpApprovalsTab from './components/CatchUpApprovalsTab.vue'

  const route = useRoute()
  const router = useRouter()
  const VALID = new Set(['general', 'catch-up'])
  const activeTab = ref<'general' | 'catch-up'>(
    VALID.has(String(route.query.tab)) ? (route.query.tab as 'general' | 'catch-up') : 'general',
  )

  watch(activeTab, (tab) => {
    void router.replace({ query: { ...route.query, tab } })
  })
</script>
