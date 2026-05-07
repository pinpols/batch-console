<template>
  <PageContainer>
    <PageHeader title="事件目录" description="浏览系统事件类型与 Kafka Topic 注册信息。" />

    <SectionCard>
      <el-tabs v-model="activeTab" v-hover-tab-activate="true" class="pill-tabs">
        <el-tab-pane label="事件类型" name="eventTypes">
          <ProTable
            :data="pagedEventTypes"
            :loading="loadingTypes"
            :total="filteredEventTypes.length"
            v-model:page="typePage"
            v-model:page-size="typePageSize"
            :has-active-filters="!!eventTypeKeyword"
            @change="() => {}"
          >
            <template #query>
              <ListPageQueryBar
                :filter-busy="false"
                :refresh-busy="loadingTypes"
                @search="() => {}"
                @reset="eventTypeKeyword = ''"
                @refresh="loadEventTypes"
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
            :total="filteredTopics.length"
            v-model:page="topicPage"
            v-model:page-size="topicPageSize"
            :has-active-filters="!!topicKeyword"
            @change="() => {}"
          >
            <template #query>
              <ListPageQueryBar
                :filter-busy="false"
                :refresh-busy="loadingTopics"
                @search="() => {}"
                @reset="topicKeyword = ''"
                @refresh="loadTopics"
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

    <el-drawer v-model="detailVisible" :title="detailTitle" size="720px">
      <div v-if="detailRow" class="detail-drawer">
        <div class="detail-drawer__meta">
          <div v-if="detailKind === 'eventType'" class="detail-drawer__meta-row">
            <span class="detail-drawer__label">事件类型</span>
            <CopyableText :text="String(detailRow.eventType ?? '')" />
          </div>
          <div v-else class="detail-drawer__meta-row">
            <span class="detail-drawer__label">Topic</span>
            <CopyableText :text="String(detailRow.topic ?? detailRow.name ?? '')" />
          </div>
        </div>
        <pre class="json-preview">{{ detailJson }}</pre>
      </div>
    </el-drawer>
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

  const activeTab = ref('eventTypes')
  const loadingTypes = ref(false)
  const loadingTopics = ref(false)
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
  const detailJson = computed(() => {
    if (!detailRow.value) return ''
    try {
      return JSON.stringify(detailRow.value, null, 2)
    } catch {
      return String(detailRow.value)
    }
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
    loadingTypes.value = true
    try {
      const data = await listEventTypes()
      eventTypes.value = Array.isArray(data) ? (data as Record<string, unknown>[]) : []
    } catch {
      eventTypes.value = []
    } finally {
      loadingTypes.value = false
    }
  }

  async function loadTopics() {
    loadingTopics.value = true
    try {
      const data = await listKafkaTopics()
      topics.value = Array.isArray(data) ? (data as Record<string, unknown>[]) : []
    } catch {
      topics.value = []
    } finally {
      loadingTopics.value = false
    }
  }

  onMounted(() => {
    void loadEventTypes()
    void loadTopics()
  })
</script>

<style scoped></style>
