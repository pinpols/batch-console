<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-segmented v-model="viewMode" :options="viewModeOptions" />
      </template>
    </PageHeader>

    <el-tabs v-model="activeTab" class="pill-tabs">
      <el-tab-pane :label="t('observability.eventCatalogTabEventTypes')" name="eventTypes" />
      <el-tab-pane :label="t('observability.eventCatalogTabTopics')" name="topics" />
    </el-tabs>

    <ListPageQueryBar
      :filter-busy="activeFilterBusy"
      :refresh-busy="activeLoading"
      @search="runActiveSearch"
      @reset="runActiveReset"
      @refresh="refreshActive"
    >
      <el-form-item :label="t('observability.eventCatalogKeywordLabel')">
        <el-input
          class="query-w-240"
          v-model="activeKeyword"
          clearable
          :placeholder="activePlaceholder"
          @keyup.enter="runActiveSearch"
        />
      </el-form-item>
    </ListPageQueryBar>

    <section v-if="viewMode === 'explorer'" class="catalog-workbench">
      <aside class="catalog-list" :aria-label="activeTabLabel">
        <div class="catalog-list__header">
          <span>{{ activeTabLabel }}</span>
          <el-tag size="small" effect="plain" type="info">{{ activeRows.length }}</el-tag>
        </div>
        <div v-loading="activeLoading" class="catalog-list__body">
          <button
            v-for="row in activeRows"
            :key="rowKey(row)"
            type="button"
            class="catalog-list__item"
            :class="{ 'catalog-list__item--active': rowKey(row) === selectedKey }"
            @click="selectRow(row)"
          >
            <span class="catalog-list__name">{{ rowTitle(row) }}</span>
            <span class="catalog-list__meta">{{ rowSubtitle(row) }}</span>
          </button>
          <EmptyState
            v-if="!activeLoading && activeRows.length === 0"
            :title="t('observability.eventCatalogEmptyTitle')"
            :description="t('observability.eventCatalogEmptyDescription')"
            :image-size="64"
          />
        </div>
      </aside>

      <main class="catalog-detail">
        <template v-if="selectedRow">
          <div class="catalog-detail__header">
            <div>
              <div class="catalog-detail__eyebrow">{{ activeTabLabel }}</div>
              <h2>{{ rowTitle(selectedRow) }}</h2>
            </div>
          </div>
          <p class="catalog-detail__description">
            {{ selectedRow.description || t('common.noData') }}
          </p>

          <template v-if="activeTab === 'eventTypes'">
            <el-descriptions :column="2" border>
              <el-descriptions-item :label="t('observability.eventCatalogColCategory')">
                {{ selectedEventType?.category || '—' }}
              </el-descriptions-item>
              <el-descriptions-item :label="t('observability.eventCatalogColEventType')">
                {{ selectedEventType?.eventType || '—' }}
              </el-descriptions-item>
            </el-descriptions>
            <div class="catalog-detail__section-title">
              {{ t('observability.eventCatalogSchemaTitle') }}
            </div>
            <JsonPreview :data="selectedSchema" />
          </template>

          <template v-else>
            <el-descriptions :column="2" border>
              <el-descriptions-item :label="t('observability.eventCatalogColTopic')">
                {{ selectedTopic?.topic || selectedTopic?.name || '—' }}
              </el-descriptions-item>
              <el-descriptions-item :label="t('observability.eventCatalogColPartitions')">
                {{ selectedTopic?.partitions || '—' }}
              </el-descriptions-item>
              <el-descriptions-item :label="t('observability.eventCatalogColReplicas')">
                {{ selectedTopic?.replicationFactor || '—' }}
              </el-descriptions-item>
            </el-descriptions>
          </template>
        </template>
        <EmptyState
          v-else
          :title="t('observability.eventCatalogSelectTitle')"
          :description="t('observability.eventCatalogSelectDescription')"
          :image-size="72"
        />
      </main>
    </section>

    <template v-else>
      <ProTable
        v-if="activeTab === 'eventTypes'"
        :data="pagedEventTypes"
        :loading="loadingTypes"
        :error="loadTypesError"
        :on-retry="loadEventTypes"
        :total="filteredEventTypes.length"
        v-model:page="typePage"
        v-model:page-size="typePageSize"
        :has-active-filters="!!eventTypeKeyword"
        @change="() => {}"
      >
        <el-table-column
          prop="eventType"
          :label="t('observability.eventCatalogColEventType')"
          min-width="220"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <CopyableText :text="String(row.eventType ?? '')" />
          </template>
        </el-table-column>
        <el-table-column
          prop="description"
          :label="t('observability.eventCatalogColDescription')"
          min-width="320"
          show-overflow-tooltip
        />
        <el-table-column
          prop="category"
          :label="t('observability.eventCatalogColCategory')"
          width="160"
        />
        <el-table-column :label="t('observability.eventCatalogColActions')" width="104">
          <template #default="{ row }">
            <el-button size="small" text type="primary" @click="openDetail('eventType', row)">
              {{ t('observability.eventCatalogActionDetail') }}
            </el-button>
          </template>
        </el-table-column>
      </ProTable>

      <ProTable
        v-else
        :data="pagedTopics"
        :loading="loadingTopics"
        :error="loadTopicsError"
        :on-retry="loadTopics"
        :total="filteredTopics.length"
        v-model:page="topicPage"
        v-model:page-size="topicPageSize"
        :has-active-filters="!!topicKeyword"
        @change="() => {}"
      >
        <el-table-column
          prop="topic"
          :label="t('observability.eventCatalogColTopic')"
          min-width="280"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <CopyableText :text="String(row.topic ?? row.name ?? '')" />
          </template>
        </el-table-column>
        <el-table-column
          prop="partitions"
          :label="t('observability.eventCatalogColPartitions')"
          width="120"
        />
        <el-table-column
          prop="replicationFactor"
          :label="t('observability.eventCatalogColReplicas')"
          width="120"
        />
        <el-table-column
          prop="description"
          :label="t('observability.eventCatalogColDescription')"
          min-width="320"
          show-overflow-tooltip
        />
        <el-table-column :label="t('observability.eventCatalogColActions')" width="104">
          <template #default="{ row }">
            <el-button size="small" text type="primary" @click="openDetail('topic', row)">
              {{ t('observability.eventCatalogActionDetail') }}
            </el-button>
          </template>
        </el-table-column>
      </ProTable>
    </template>

    <DetailDrawer
      v-model:visible="detailVisible"
      :title="detailTitle"
      :meta-rows="detailMetaRows"
      :raw="detailRow"
    />
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import {
    listEventTypes,
    listKafkaTopics,
    type EventCatalogTopicRow,
    type EventCatalogTypeRow,
  } from '@/api/eventCatalog'
  import { toPageResult } from '@/api/adapters'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import CopyableText from '@/components/common/CopyableText.vue'
  import DetailDrawer from '@/components/common/DetailDrawer.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useListLoadState } from '@/composables/useListLoadState'
  import { filterCatalogRows, parseCatalogSchema } from './eventCatalogPresentation'

  type CatalogRow = EventCatalogTypeRow | EventCatalogTopicRow

  const { t } = useI18n({ useScope: 'global' })
  const activeTab = ref<'eventTypes' | 'topics'>('eventTypes')
  const viewMode = ref<'explorer' | 'dense'>('explorer')
  const viewModeOptions = computed(() => [
    { label: t('observability.eventCatalogViewExplorer'), value: 'explorer' },
    { label: t('observability.eventCatalogViewDense'), value: 'dense' },
  ])
  const { loading: loadingTypes, error: loadTypesError, run: runLoadTypes } = useListLoadState()
  const { loading: loadingTopics, error: loadTopicsError, run: runLoadTopics } = useListLoadState()
  const {
    filterBusy: typesFilterBusy,
    runSearch: runTypesSearch,
    runReset: runTypesReset,
    runRefresh: runTypesRefresh,
  } = useListFilterFeedback(loadingTypes)
  const {
    filterBusy: topicsFilterBusy,
    runSearch: runTopicsSearch,
    runReset: runTopicsReset,
    runRefresh: runTopicsRefresh,
  } = useListFilterFeedback(loadingTopics)
  const eventTypeKeyword = ref('')
  const topicKeyword = ref('')
  const eventTypes = ref<EventCatalogTypeRow[]>([])
  const topics = ref<EventCatalogTopicRow[]>([])
  const typePage = ref(1)
  const typePageSize = ref(15)
  const topicPage = ref(1)
  const topicPageSize = ref(15)
  const selectedEventType = ref<EventCatalogTypeRow | null>(null)
  const selectedTopic = ref<EventCatalogTopicRow | null>(null)

  const filteredEventTypes = computed(() =>
    filterCatalogRows(eventTypes.value, eventTypeKeyword.value),
  )
  const filteredTopics = computed(() => filterCatalogRows(topics.value, topicKeyword.value))
  const pagedEventTypes = computed(
    () => toPageResult(filteredEventTypes.value, typePage.value, typePageSize.value).records,
  )
  const pagedTopics = computed(
    () => toPageResult(filteredTopics.value, topicPage.value, topicPageSize.value).records,
  )
  const activeRows = computed<CatalogRow[]>(() =>
    activeTab.value === 'eventTypes' ? filteredEventTypes.value : filteredTopics.value,
  )
  const selectedRow = computed<CatalogRow | null>(() =>
    activeTab.value === 'eventTypes' ? selectedEventType.value : selectedTopic.value,
  )
  const selectedKey = computed(() => (selectedRow.value ? rowKey(selectedRow.value) : ''))
  const selectedSchema = computed(() =>
    activeTab.value === 'eventTypes' && selectedEventType.value
      ? parseCatalogSchema(selectedEventType.value.schema)
      : {},
  )
  const activeTabLabel = computed(() =>
    activeTab.value === 'eventTypes'
      ? t('observability.eventCatalogTabEventTypes')
      : t('observability.eventCatalogTabTopics'),
  )
  const activePlaceholder = computed(() =>
    activeTab.value === 'eventTypes'
      ? t('observability.eventCatalogEventTypesPlaceholder')
      : t('observability.eventCatalogTopicsPlaceholder'),
  )
  const activeLoading = computed(() =>
    activeTab.value === 'eventTypes' ? loadingTypes.value : loadingTopics.value,
  )
  const activeFilterBusy = computed(() =>
    activeTab.value === 'eventTypes' ? typesFilterBusy.value : topicsFilterBusy.value,
  )
  const activeKeyword = computed({
    get: () => (activeTab.value === 'eventTypes' ? eventTypeKeyword.value : topicKeyword.value),
    set: (value: string) => {
      if (activeTab.value === 'eventTypes') eventTypeKeyword.value = value
      else topicKeyword.value = value
    },
  })

  function rowKey(row: CatalogRow): string {
    return 'eventType' in row ? row.eventType : row.topic || row.name || ''
  }

  function rowTitle(row: CatalogRow): string {
    return rowKey(row) || '—'
  }

  function rowSubtitle(row: CatalogRow): string {
    return 'eventType' in row
      ? row.category || row.description || '—'
      : row.description || `${row.partitions} / ${row.replicationFactor}`
  }

  function selectRow(row: CatalogRow) {
    if ('eventType' in row) selectedEventType.value = row
    else selectedTopic.value = row
  }

  function keepSelection() {
    if (activeTab.value === 'eventTypes') {
      if (
        !filteredEventTypes.value.some(
          (row) => row.eventType === selectedEventType.value?.eventType,
        )
      ) {
        selectedEventType.value = filteredEventTypes.value[0] ?? null
      }
    } else if (!filteredTopics.value.some((row) => row.topic === selectedTopic.value?.topic)) {
      selectedTopic.value = filteredTopics.value[0] ?? null
    }
  }

  function runActiveSearch() {
    const run = activeTab.value === 'eventTypes' ? runTypesSearch : runTopicsSearch
    return run(() => {
      if (activeTab.value === 'eventTypes') typePage.value = 1
      else topicPage.value = 1
      keepSelection()
    })
  }

  function runActiveReset() {
    const run = activeTab.value === 'eventTypes' ? runTypesReset : runTopicsReset
    return run(() => {
      activeKeyword.value = ''
      keepSelection()
    })
  }

  function refreshActive() {
    return activeTab.value === 'eventTypes'
      ? runTypesRefresh(loadEventTypes)
      : runTopicsRefresh(loadTopics)
  }

  const detailVisible = ref(false)
  const detailKind = ref<'eventType' | 'topic'>('eventType')
  const detailRow = ref<Record<string, unknown> | null>(null)
  const detailTitle = computed(() =>
    detailKind.value === 'eventType'
      ? t('observability.eventCatalogEventTypeDetailTitle')
      : t('observability.eventCatalogTopicDetailTitle'),
  )
  const detailMetaRows = computed(() => {
    if (!detailRow.value) return []
    return detailKind.value === 'eventType'
      ? [
          {
            label: t('observability.eventCatalogMetaEventType'),
            value: String(detailRow.value.eventType ?? ''),
          },
        ]
      : [
          {
            label: t('observability.eventCatalogMetaTopic'),
            value: String(detailRow.value.topic ?? detailRow.value.name ?? ''),
          },
        ]
  })

  function openDetail(kind: 'eventType' | 'topic', row: Record<string, unknown>) {
    detailKind.value = kind
    detailRow.value = row
    detailVisible.value = true
  }

  async function loadEventTypes() {
    await runLoadTypes(async () => {
      eventTypes.value = await listEventTypes()
      keepSelection()
    }).catch(() => {
      eventTypes.value = []
      selectedEventType.value = null
    })
  }

  async function loadTopics() {
    await runLoadTopics(async () => {
      topics.value = await listKafkaTopics()
      keepSelection()
    }).catch(() => {
      topics.value = []
      selectedTopic.value = null
    })
  }

  watch([activeTab, filteredEventTypes, filteredTopics], keepSelection)

  onMounted(() => {
    void loadEventTypes()
    void loadTopics()
  })
</script>

<style scoped>
  .catalog-workbench {
    display: grid;
    min-height: 34rem;
    grid-template-columns: minmax(16rem, 22rem) minmax(0, 1fr);
    margin-top: var(--page-block-gap);
    overflow: hidden;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
    background: var(--color-bg-card);
  }

  .catalog-list {
    min-width: 0;
    border-right: 1px solid var(--color-border-light);
    background: var(--color-bg-subtle);
  }

  .catalog-list__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md);
    border-bottom: 1px solid var(--color-border-light);
    font-weight: 600;
  }

  .catalog-list__body {
    max-height: 42rem;
    overflow: auto;
  }

  .catalog-list__item {
    display: flex;
    width: 100%;
    flex-direction: column;
    gap: var(--space-xs);
    padding: var(--space-md);
    color: var(--color-text-primary);
    text-align: left;
    border: 0;
    border-bottom: 1px solid var(--color-border-light);
    background: transparent;
    cursor: pointer;
  }

  .catalog-list__item:hover,
  .catalog-list__item:focus-visible {
    background: var(--el-fill-color-light);
    outline: none;
  }

  .catalog-list__item--active {
    box-shadow: inset 0.2rem 0 0 var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }

  .catalog-list__name {
    overflow: hidden;
    font-family: var(--font-mono);
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .catalog-list__meta,
  .catalog-detail__eyebrow {
    overflow: hidden;
    color: var(--color-text-tertiary);
    font-size: var(--font-size-sm);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .catalog-detail {
    min-width: 0;
    padding: var(--space-lg);
  }

  .catalog-detail__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-lg);
  }

  .catalog-detail__header h2 {
    margin: var(--space-xs) 0 0;
    font-size: var(--font-size-xl);
  }

  .catalog-detail__description {
    margin: var(--space-md) 0 var(--space-lg);
    color: var(--color-text-secondary);
    line-height: var(--line-height-relaxed);
  }

  .catalog-detail__section-title {
    margin: var(--space-lg) 0 var(--space-sm);
    font-weight: 600;
  }

  @media (max-width: 960px) {
    .catalog-workbench {
      grid-template-columns: 1fr;
    }

    .catalog-list {
      border-right: 0;
      border-bottom: 1px solid var(--color-border-light);
    }

    .catalog-list__body {
      max-height: 18rem;
    }
  }

  @media (max-width: 640px) {
    .catalog-workbench {
      min-height: 0;
    }

    .catalog-list__body {
      max-height: 12rem;
    }

    .catalog-detail {
      padding: var(--space-md);
    }

    .catalog-detail__header {
      flex-direction: column;
      gap: var(--space-sm);
    }
  }
</style>
