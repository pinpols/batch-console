<template>
  <PageContainer>
    <PageHeader
      title="Outbox"
      description="重试与投递日志分页聚合；状态项为数据中出现值并带常用中文释义（无单独字典接口）。"
    />

    <SectionCard>
      <el-tabs v-model="tab" v-hover-tab-activate="true" class="pill-tabs">
        <el-tab-pane label="重试" name="retry">
          <ProTable
            :data="retryRows"
            :loading="tableBlocking"
            :total="retryTotal"
            v-model:page="retryPage"
            v-model:page-size="retryPageSize"
            @change="sliceRetry"
          >
            <template #query>
              <ListPageQueryBar
                :filter-busy="queryActionBusy"
                :refresh-busy="loading"
                :disabled="loading"
                @search="onRetrySearch"
                @reset="onRetryReset"
                @refresh="loadTab"
              >
                <el-form-item label="关键字">
                  <el-input
                    class="query-w-220"
                    v-model="retryKwDraft"
                    clearable
                    placeholder="事件类型或事件 Key，模糊匹配"
                    @keyup.enter="onRetrySearch"
                  />
                </el-form-item>
                <el-form-item label="状态">
                  <el-select
                    class="query-w-200"
                    v-model="retryStatusDraft"
                    clearable
                    filterable
                    allow-create
                    default-first-option
                    placeholder="重试状态"
                    @keyup.enter="onRetrySearch"
                  >
                    <el-option
                      v-for="opt in retryStatusSelectOptions"
                      :key="opt.value"
                      :label="opt.label"
                      :value="opt.value"
                    />
                  </el-select>
                </el-form-item>
              </ListPageQueryBar>
            </template>
            <el-table-column prop="eventType" label="事件类型" width="140" />
            <el-table-column prop="eventKey" label="Key" min-width="160" show-overflow-tooltip />
            <el-table-column prop="retryStatus" label="状态" width="120">
              <template #default="{ row }">
                <StatusTag :value="String(row.retryStatus ?? '')" category="outboxPublishStatus" />
              </template>
            </el-table-column>
            <el-table-column prop="retryCount" label="次数" width="80" />
            <DatetimeColumn prop="nextRetryAt" label="下次重试" width="160" />
            <el-table-column label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <div class="table-actions">
                  <el-button size="small" plain type="primary" @click="openDetail('retry', row)">
                    详情
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </ProTable>
        </el-tab-pane>
        <el-tab-pane label="投递" name="delivery">
          <ProTable
            :data="deliveryRows"
            :loading="tableBlocking"
            :total="deliveryTotal"
            v-model:page="deliveryPage"
            v-model:page-size="deliveryPageSize"
            @change="sliceDelivery"
          >
            <template #query>
              <ListPageQueryBar
                :filter-busy="queryActionBusy"
                :refresh-busy="loading"
                :disabled="loading"
                @search="onDeliverySearch"
                @reset="onDeliveryReset"
                @refresh="loadTab"
              >
                <el-form-item label="关键字">
                  <el-input
                    class="query-w-220"
                    v-model="deliveryKwDraft"
                    clearable
                    placeholder="事件类型、Key 或 Topic，模糊匹配"
                    @keyup.enter="onDeliverySearch"
                  />
                </el-form-item>
                <el-form-item label="状态">
                  <el-select
                    class="query-w-200"
                    v-model="deliveryStatusDraft"
                    clearable
                    filterable
                    allow-create
                    default-first-option
                    placeholder="投递状态"
                    @keyup.enter="onDeliverySearch"
                  >
                    <el-option
                      v-for="opt in deliveryStatusSelectOptions"
                      :key="opt.value"
                      :label="opt.label"
                      :value="opt.value"
                    />
                  </el-select>
                </el-form-item>
              </ListPageQueryBar>
            </template>
            <el-table-column prop="eventType" label="事件类型" width="140" />
            <el-table-column prop="eventKey" label="Key" min-width="160" show-overflow-tooltip />
            <el-table-column prop="deliveryStatus" label="状态" width="120">
              <template #default="{ row }">
                <StatusTag
                  :value="String(row.deliveryStatus ?? '')"
                  category="outboxPublishStatus"
                />
              </template>
            </el-table-column>
            <el-table-column
              prop="targetTopic"
              label="Topic"
              min-width="140"
              show-overflow-tooltip
            />
            <DatetimeColumn prop="updatedAt" label="更新" width="160" />
            <el-table-column label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <div class="table-actions">
                  <el-button size="small" plain type="primary" @click="openDetail('delivery', row)">
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
          <div class="detail-drawer__meta-row">
            <span class="detail-drawer__label">事件类型</span>
            <CopyableText :text="detailRow.eventType ?? ''" />
          </div>
          <div class="detail-drawer__meta-row">
            <span class="detail-drawer__label">Key</span>
            <CopyableText :text="detailRow.eventKey ?? ''" />
          </div>
          <div v-if="detailKind === 'delivery'" class="detail-drawer__meta-row">
            <span class="detail-drawer__label">Topic</span>
            <CopyableText
              :text="(detailRow as ConsoleOutboxDeliveryLogResponse).targetTopic ?? ''"
            />
          </div>
        </div>
        <pre class="json-preview">{{ detailJson }}</pre>
      </div>
    </el-drawer>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { queryOutboxDeliveries, queryOutboxRetries } from '@/api/observabilityQueries'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useSseAutoReload } from '@/composables/useSseAutoReload'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { toPageResult } from '@/api/adapters'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import CopyableText from '@/components/common/CopyableText.vue'
  import type {
    ConsoleOutboxDeliveryLogResponse,
    ConsoleOutboxRetryLogResponse,
  } from '@/types/console-api'

  const tenant = useTenantStore()
  const tab = ref<'retry' | 'delivery'>('retry')
  const loading = ref(false)
  const {
    filterBusy: queryActionBusy,
    tableBlocking,
    runSearch,
    runReset,
  } = useListFilterFeedback(loading)

  const retriesAll = ref<ConsoleOutboxRetryLogResponse[]>([])
  const deliveriesAll = ref<ConsoleOutboxDeliveryLogResponse[]>([])

  const detailVisible = ref(false)
  const detailKind = ref<'retry' | 'delivery'>('retry')
  const detailRow = ref<ConsoleOutboxRetryLogResponse | ConsoleOutboxDeliveryLogResponse | null>(
    null,
  )
  const detailTitle = computed(() => (detailKind.value === 'retry' ? '重试详情' : '投递详情'))
  const detailJson = computed(() => {
    if (!detailRow.value) return ''
    try {
      return JSON.stringify(detailRow.value, null, 2)
    } catch {
      return String(detailRow.value)
    }
  })

  function openDetail(
    kind: 'retry' | 'delivery',
    row: ConsoleOutboxRetryLogResponse | ConsoleOutboxDeliveryLogResponse,
  ) {
    detailKind.value = kind
    detailRow.value = row
    detailVisible.value = true
  }

  const retryRows = ref<ConsoleOutboxRetryLogResponse[]>([])
  const retryTotal = ref(0)
  const retryPage = ref(1)
  const retryPageSize = ref(20)
  const retryKwDraft = ref('')
  const retryStatusDraft = ref('')
  const retryKwApplied = ref('')
  const retryStatusApplied = ref('')

  const deliveryRows = ref<ConsoleOutboxDeliveryLogResponse[]>([])
  const deliveryTotal = ref(0)
  const deliveryPage = ref(1)
  const deliveryPageSize = ref(20)
  const deliveryKwDraft = ref('')
  const deliveryStatusDraft = ref('')
  const deliveryKwApplied = ref('')
  const deliveryStatusApplied = ref('')

  const { data: metaEnums } = useConsoleMetaEnumsQuery()

  const retryStatusSelectOptions = computed(() =>
    pickMetaEnumGroup(metaEnums.value, 'outboxPublishStatus'),
  )

  const deliveryStatusSelectOptions = computed(() =>
    pickMetaEnumGroup(metaEnums.value, 'outboxPublishStatus'),
  )

  const filteredRetries = computed(() => {
    let r = retriesAll.value
    const k = retryKwApplied.value.trim().toLowerCase()
    if (k) {
      r = r.filter(
        (row) =>
          row.eventType?.toLowerCase().includes(k) || row.eventKey?.toLowerCase().includes(k),
      )
    }
    const s = retryStatusApplied.value.trim()
    if (s) r = r.filter((row) => String(row.retryStatus ?? '') === s)
    return r
  })

  const filteredDeliveries = computed(() => {
    let r = deliveriesAll.value
    const k = deliveryKwApplied.value.trim().toLowerCase()
    if (k) {
      r = r.filter(
        (row) =>
          row.eventType?.toLowerCase().includes(k) ||
          row.eventKey?.toLowerCase().includes(k) ||
          String(row.targetTopic ?? '')
            .toLowerCase()
            .includes(k),
      )
    }
    const s = deliveryStatusApplied.value.trim()
    if (s) r = r.filter((row) => String(row.deliveryStatus ?? '') === s)
    return r
  })

  function sliceRetry() {
    const pr = toPageResult(filteredRetries.value, retryPage.value, retryPageSize.value)
    retryRows.value = pr.records as ConsoleOutboxRetryLogResponse[]
    retryTotal.value = pr.total
  }

  function sliceDelivery() {
    const pr = toPageResult(filteredDeliveries.value, deliveryPage.value, deliveryPageSize.value)
    deliveryRows.value = pr.records as ConsoleOutboxDeliveryLogResponse[]
    deliveryTotal.value = pr.total
  }

  function onRetrySearch() {
    return runSearch(() => {
      retryKwApplied.value = retryKwDraft.value.trim()
      retryStatusApplied.value = retryStatusDraft.value.trim()
      retryPage.value = 1
      sliceRetry()
    })
  }

  function onRetryReset() {
    return runReset(() => {
      retryKwDraft.value = ''
      retryStatusDraft.value = ''
      retryKwApplied.value = ''
      retryStatusApplied.value = ''
      retryPage.value = 1
      sliceRetry()
    })
  }

  function onDeliverySearch() {
    return runSearch(() => {
      deliveryKwApplied.value = deliveryKwDraft.value.trim()
      deliveryStatusApplied.value = deliveryStatusDraft.value.trim()
      deliveryPage.value = 1
      sliceDelivery()
    })
  }

  function onDeliveryReset() {
    return runReset(() => {
      deliveryKwDraft.value = ''
      deliveryStatusDraft.value = ''
      deliveryKwApplied.value = ''
      deliveryStatusApplied.value = ''
      deliveryPage.value = 1
      sliceDelivery()
    })
  }

  async function loadTab() {
    loading.value = true
    try {
      if (tab.value === 'retry') {
        retriesAll.value = await queryOutboxRetries(tenant.tenantId, {
          retryStatus: retryStatusApplied.value.trim() || undefined,
        })
        retryPage.value = 1
        sliceRetry()
      } else {
        deliveriesAll.value = await queryOutboxDeliveries(tenant.tenantId, {
          deliveryStatus: deliveryStatusApplied.value.trim() || undefined,
        })
        deliveryPage.value = 1
        sliceDelivery()
      }
    } finally {
      loading.value = false
    }
  }

  useTenantReload(loadTab)

  watch(tab, () => loadTab())

  useSseAutoReload({
    domain: 'outbox-retries',
    reload: () => (tab.value === 'retry' ? loadTab() : Promise.resolve()),
    scope: () => tenant.tenantId,
  })

  useSseAutoReload({
    domain: 'outbox-deliveries',
    reload: () => (tab.value === 'delivery' ? loadTab() : Promise.resolve()),
    scope: () => tenant.tenantId,
  })
</script>
