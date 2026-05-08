<template>
  <PageContainer>
    <PageHeader />

    <SectionCard>
      <el-tabs v-model="activeTab" v-hover-tab-activate="true" class="pill-tabs">
        <el-tab-pane label="资源标签" name="resource">
          <TagResourceTab />
        </el-tab-pane>
        <el-tab-pane label="按标签搜索" name="search">
          <TagSearchTab />
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
  import TagResourceTab from './components/TagResourceTab.vue'
  import TagSearchTab from './components/TagSearchTab.vue'

  const activeTab = ref<'resource' | 'search'>('resource')
</script>
