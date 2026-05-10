<template>
  <PageContainer>
    <PageHeader />

    <SectionCard>
      <el-tabs v-model="activeTab" v-hover-tab-activate="true" class="pill-tabs">
        <el-tab-pane :label="t('approvals.tabGeneral')" name="general">
          <GeneralApprovalsTab />
        </el-tab-pane>
        <el-tab-pane :label="t('approvals.tabCatchUp')" name="catch-up">
          <CatchUpApprovalsTab />
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
