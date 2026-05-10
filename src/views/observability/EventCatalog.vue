<template>
  <PageContainer>
    <PageHeader />

    <SectionCard>
      <el-tabs v-model="activeTab" v-hover-tab-activate="true" class="pill-tabs">
        <el-tab-pane :label="t('observability.eventCatalogTabEventTypes')" name="eventTypes">
          <ProTable
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
            <template #query>
              <ListPageQueryBar
                :filter-busy="typesFilterBusy"
                :refresh-busy="loadingTypes"
                @search="() => runTypesSearch(() => {})"
                @reset="() => runTypesReset(() => (eventTypeKeyword = ''))"
                @refresh="() => runTypesRefresh(loadEventTypes)"
              >
                <el-form-item :label="t('observability.eventCatalogKeywordLabel')">
                  <el-input
                    class="query-w-240"
                    v-model="eventTypeKeyword"
                    clearable
                    :placeholder="t('observability.eventCatalogEventTypesPlaceholder')"
                  />
                </el-form-item>
              </ListPageQueryBar>
            </template>
            <el-table-column
              prop="eventType"
              :label="t('observability.eventCatalogColEventType')"
              min-width="200"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                <CopyableText :text="String(row.eventType ?? '')" />
              </template>
            </el-table-column>
            <el-table-column
              prop="description"
              :label="t('observability.eventCatalogColDescription')"
              min-width="300"
              show-overflow-tooltip
            />
            <el-table-column
              prop="category"
              :label="t('observability.eventCatalogColCategory')"
              width="140"
            />
            <el-table-column
              prop="schema"
              :label="t('observability.eventCatalogColSchema')"
              min-width="200"
              show-overflow-tooltip
            />
            <el-table-column
              :label="t('observability.eventCatalogColActions')"
              width="120"
              fixed="right"
            >
              <template #default="{ row }">
                <div class="table-actions">
                  <el-button
                    size="small"
                    plain
                    type="primary"
                    @click="openDetail('eventType', row)"
                  >
                    {{ t('observability.eventCatalogActionDetail') }}
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </ProTable>
        </el-tab-pane>

        <el-tab-pane :label="t('observability.eventCatalogTabTopics')" name="topics">
          <ProTable
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
            <template #query>
              <ListPageQueryBar
                :filter-busy="topicsFilterBusy"
                :refresh-busy="loadingTopics"
                @search="() => runTopicsSearch(() => {})"
                @reset="() => runTopicsReset(() => (topicKeyword = ''))"
                @refresh="() => runTopicsRefresh(loadTopics)"
              >
                <el-form-item :label="t('observability.eventCatalogKeywordLabel')">
                  <el-input
                    class="query-w-240"
                    v-model="topicKeyword"
                    clearable
                    :placeholder="t('observability.eventCatalogTopicsPlaceholder')"
                  />
                </el-form-item>
              </ListPageQueryBar>
            </template>
            <el-table-column
              prop="topic"
              :label="t('observability.eventCatalogColTopic')"
              min-width="250"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                <CopyableText :text="String(row.topic ?? row.name ?? '')" />
              </template>
            </el-table-column>
            <el-table-column
              prop="partitions"
              :label="t('observability.eventCatalogColPartitions')"
              width="100"
            />
            <el-table-column
              prop="replicationFactor"
              :label="t('observability.eventCatalogColReplicas')"
              width="100"
            />
            <el-table-column
              prop="description"
              :label="t('observability.eventCatalogColDescription')"
              min-width="200"
              show-overflow-tooltip
            />
            <el-table-column
              :label="t('observability.eventCatalogColActions')"
              width="120"
              fixed="right"
            >
              <template #default="{ row }">
                <div class="table-actions">
                  <el-button size="small" plain type="primary" @click="openDetail('topic', row)">
                    {{ t('observability.eventCatalogActionDetail') }}
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </ProTable>
        </el-tab-pane>
      </el-tabs>
    </SectionCard>

    <DetailDrawer
      v-model="detailVisible"
      :title="detailTitle"
      :meta-rows="detailMetaRows"
      :raw="detailRow"
    />
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { listEventTypes, listKafkaTopics } from '@/api/eventCatalog'

  const { t } = useI18n({ useScope: 'global' })
  import { toPageResult } from '@/api/adapters'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import CopyableText from '@/components/common/CopyableText.vue'
  import DetailDrawer from '@/components/common/DetailDrawer.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useListLoadState } from '@/composables/useListLoadState'

  const activeTab = ref('eventTypes')
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
  const eventTypes = ref<Record<string, unknown>[]>([])
  const topics = ref<Record<string, unknown>[]>([])
  const typePage = ref(1)
  const typePageSize = ref(20)
  const topicPage = ref(1)
  const topicPageSize = ref(20)

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

  const filteredEventTypes = computed(() => {
    const k = eventTypeKeyword.value.trim().toLowerCase()
    if (!k) return eventTypes.value
    return eventTypes.value.filter((r) => JSON.stringify(r).toLowerCase().includes(k))
  })

  const pagedEventTypes = computed(
    () => toPageResult(filteredEventTypes.value, typePage.value, typePageSize.value).records,
  )

  const filteredTopics = computed(() => {
    const k = topicKeyword.value.trim().toLowerCase()
    if (!k) return topics.value
    return topics.value.filter((r) => JSON.stringify(r).toLowerCase().includes(k))
  })

  const pagedTopics = computed(
    () => toPageResult(filteredTopics.value, topicPage.value, topicPageSize.value).records,
  )

  async function loadEventTypes() {
    await runLoadTypes(async () => {
      const data = await listEventTypes()
      eventTypes.value = Array.isArray(data) ? (data as Record<string, unknown>[]) : []
    }).catch(() => {
      eventTypes.value = []
    })
  }

  async function loadTopics() {
    await runLoadTopics(async () => {
      const data = await listKafkaTopics()
      topics.value = Array.isArray(data) ? (data as Record<string, unknown>[]) : []
    }).catch(() => {
      topics.value = []
    })
  }

  onMounted(() => {
    void loadEventTypes()
    void loadTopics()
  })
</script>

<style scoped></style>
