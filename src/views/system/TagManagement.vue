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
      <el-tabs v-model="activeTab" class="tag-tabs">
        <el-tab-pane name="resource">
          <template #label>
            <span class="tag-tabs__label">
              <el-icon><CollectionTag /></el-icon>
              {{ t('tagManagement.tabResource') }}
            </span>
          </template>
          <p class="tag-tabs__desc">{{ t('tagManagement.descResource') }}</p>
          <TagResourceTab ref="resourceTabRef" />
        </el-tab-pane>
        <el-tab-pane name="search">
          <template #label>
            <span class="tag-tabs__label">
              <el-icon><Search /></el-icon>
              {{ t('tagManagement.tabSearch') }}
            </span>
          </template>
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
  import { CollectionTag, Plus, Search } from '@element-plus/icons-vue'
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
  .tag-tabs__label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
  }

  .tag-tabs__label :deep(svg) {
    width: 15px;
    height: 15px;
  }

  .tag-tabs__desc {
    margin: 0 0 var(--space-md);
    font-size: 13px;
    color: var(--color-text-tertiary);
    line-height: 1.55;
  }
</style>
