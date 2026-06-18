<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-tooltip
          v-if="activeTab === 'resource'"
          :content="t('tagResourceTab.needResourceTypeCode')"
          placement="bottom-end"
          :disabled="canCreateResourceTag"
        >
          <!-- el-button disabled 时 pointer-events:none 会吃掉 tooltip hover,wrap span 兜底 -->
          <span class="add-tag-btn-wrap">
            <el-button
              type="primary"
              :icon="Plus"
              class="pretty-add-button"
              :disabled="!canCreateResourceTag"
              @click="openResourceCreate"
            >
              {{ t('tagResourceTab.btnAddTag') }}
            </el-button>
          </span>
        </el-tooltip>
      </template>
    </PageHeader>

    <SectionCard>
      <el-tabs v-model="activeTab" class="pill-tabs">
        <el-tab-pane :label="t('tagManagement.tabResource')" name="resource">
          <p class="tag-tabs__desc">{{ t('tagManagement.descResource') }}</p>
          <TagResourceTab ref="resourceTabRef" @can-create-change="resourceCanCreate = $event" />
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
  import { computed, ref, watch } from 'vue'
  import type { ComputedRef } from 'vue'
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
  const resourceTabRef = ref<{
    openNewDialog: () => void
    canCreate: ComputedRef<boolean>
  } | null>(null)

  // 资源类型+编码两者齐备才允许新增标签:避免用户填了表单到最后才发现外层缺前置。
  // 用子组件 emit 的 canCreateChange 落到普通 ref(替代此前读 expose computed 的跨组件依赖,
  // 后者 reactivity 偶发不触发 → 表单填好按钮却不解锁)。
  const resourceCanCreate = ref(false)
  const canCreateResourceTag = computed(
    () => activeTab.value === 'resource' && resourceCanCreate.value,
  )

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

  /* tooltip wrap:disabled button 不接收 pointer events,只能 wrap span 兜 hover */
  .add-tag-btn-wrap {
    display: inline-flex;
  }
</style>
