<template>
  <PageContainer>
    <PageHeader />

    <SectionCard>
      <el-tabs v-model="activeTab" v-hover-tab-activate="true" class="pill-tabs">
        <el-tab-pane label="事件类型" name="eventTypes">
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
                <el-form-item label="关键字">
                  <el-input
                    class="query-w-240"
                    v-model="eventTypeKeyword"
                    clearable
                    placeholder="搜索事件类型"
                  />
                </el-form-item>
              </ListPageQueryBar>
            </template>
            <el-table-column
              prop="eventType"
              label="事件类型"
              min-width="200"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                <CopyableText :text="String(row.eventType ?? '')" />
              </template>
            </el-table-column>
            <el-table-column
              prop="description"
              label="描述"
              min-width="300"
              show-overflow-tooltip
            />
            <el-table-column prop="category" label="分类" width="140" />
            <el-table-column prop="schema" label="Schema" min-width="200" show-overflow-tooltip />
            <el-table-column label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <div class="table-actions">
                  <el-button
                    size="small"
                    plain
                    type="primary"
                    @click="openDetail('eventType', row)"
                  >
                    详情
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </ProTable>
        </el-tab-pane>

        <el-tab-pane label="Kafka Topics" name="topics">
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
                <el-form-item label="关键字">
                  <el-input
                    class="query-w-240"
                    v-model="topicKeyword"
                    clearable
                    placeholder="搜索 Topic"
                  />
                </el-form-item>
              </ListPageQueryBar>
            </template>
            <el-table-column prop="topic" label="Topic" min-width="250" show-overflow-tooltip>
              <template #default="{ row }">
                <CopyableText :text="String(row.topic ?? row.name ?? '')" />
              </template>
            </el-table-column>
            <el-table-column prop="partitions" label="分区数" width="100" />
            <el-table-column prop="replicationFactor" label="副本因子" width="100" />
            <el-table-column
              prop="description"
              label="描述"
              min-width="200"
              show-overflow-tooltip
            />
            <el-table-column label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <div class="table-actions">
                  <el-button size="small" plain type="primary" @click="openDetail('topic', row)">
                    详情
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
  import { listEventTypes, listKafkaTopics } from '@/api/eventCatalog'
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
    detailKind.value === 'eventType' ? '事件类型详情' : 'Topic 详情',
  )
  const detailMetaRows = computed(() => {
    if (!detailRow.value) return []
    return detailKind.value === 'eventType'
      ? [{ label: '事件类型', value: String(detailRow.value.eventType ?? '') }]
      : [{ label: 'Topic', value: String(detailRow.value.topic ?? detailRow.value.name ?? '') }]
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
