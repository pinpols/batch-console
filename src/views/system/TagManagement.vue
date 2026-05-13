<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button
          v-if="activeTab === 'resource'"
          type="primary"
          :icon="Plus"
          @click="openResourceCreate"
        >
          {{ t('tagResourceTab.btnAddTag') }}
        </el-button>
      </template>
    </PageHeader>

    <SectionCard>
      <el-tabs v-model="activeTab" v-hover-tab-activate="true" class="pill-tabs">
        <el-tab-pane :label="t('tagManagement.tabResource')" name="resource">
          <p class="tag-tabs__desc">{{ t('tagManagement.descResource') }}</p>
          <TagResourceTab ref="resourceTabRef" />
        </el-tab-pane>
        <el-tab-pane :label="t('tagManagement.tabSearch')" name="search">
          <p class="tag-tabs__desc">{{ t('tagManagement.descSearch') }}</p>
          <TagSearchTab />
        </el-tab-pane>
      </el-tabs>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { Plus } from '@element-plus/icons-vue'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import TagResourceTab from './components/TagResourceTab.vue'
  import TagSearchTab from './components/TagSearchTab.vue'

  const { t } = useI18n({ useScope: 'global' })

  type TagTab = 'resource' | 'search'

  const route = useRoute()
  const router = useRouter()
  const validTabs = new Set<TagTab>(['resource', 'search'])
  const activeTab = ref<TagTab>(
    validTabs.has(route.query.tab as TagTab) ? (route.query.tab as TagTab) : 'resource',
  )
  const resourceTabRef = ref<{ openNewDialog: () => void } | null>(null)

  function openResourceCreate() {
    resourceTabRef.value?.openNewDialog()
  }

  watch(activeTab, (tab) => {
    void router.replace({ query: { ...route.query, tab } })
  })
</script>

<style scoped>
  .tag-tabs__desc {
    margin: 0 0 var(--space-md);
    font-size: 13px;
    color: var(--color-text-tertiary);
    line-height: 1.55;
  }
</style>
