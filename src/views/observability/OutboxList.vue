<template>
  <PageContainer>
    <PageHeader />

    <SectionCard>
      <el-tabs v-model="tab" v-hover-tab-activate="true" class="pill-tabs">
        <el-tab-pane :label="t('observability.outboxTabRetry')" name="retry">
          <ProTable
            :data="retryRows"
            :loading="tableBlocking"
            :total="retryTotal"
            v-model:page="retryPage"
            v-model:page-size="retryPageSize"
            @change="sliceRetry"
            :error="loadError"
            :on-retry="loadTab"
          >
            <template #query>
              <ListPageQueryBar
                :filter-busy="queryActionBusy"
                :refresh-busy="loading"
                :disabled="loading"
                @search="onRetrySearch"
                @reset="onRetryReset"
                @refresh="() => runRefresh(loadTab)"
              >
                <el-form-item :label="t('observability.outboxKeywordLabel')">
                  <el-input
                    class="query-w-220"
                    v-model="retryKwDraft"
                    clearable
                    :placeholder="t('observability.outboxRetryKeywordPlaceholder')"
                    @keyup.enter="onRetrySearch"
                  />
                </el-form-item>
                <el-form-item :label="t('observability.outboxStatusLabel')">
                  <MetaSelect
                    class="query-w-200"
                    v-model="retryStatusDraft"
                    clearable
                    filterable
                    allow-create
                    default-first-option
                    enum-key="outboxPublishStatus"
                    :placeholder="t('observability.outboxRetryStatusPlaceholder')"
                    @keyup.enter="onRetrySearch"
                    :options="retryStatusSelectOptions"
                  />
                </el-form-item>
              </ListPageQueryBar>
            </template>
            <el-table-column
              prop="eventType"
              :label="t('observability.outboxColEventType')"
              width="140"
            />
            <el-table-column
              prop="eventKey"
              :label="t('observability.outboxColKey')"
              min-width="160"
              show-overflow-tooltip
            />
            <el-table-column
              prop="retryStatus"
              :label="t('observability.outboxColStatus')"
              width="120"
            >
              <template #default="{ row }">
                <StatusTag :value="String(row.retryStatus ?? '')" category="outboxPublishStatus" />
              </template>
            </el-table-column>
            <el-table-column
              prop="retryCount"
              :label="t('observability.outboxColCount')"
              width="70"
              align="right"
            />
            <el-table-column
              prop="retryPolicy"
              :label="t('observability.outboxColPolicy')"
              width="120"
              show-overflow-tooltip
            />
            <DatetimeColumn
              prop="nextRetryAt"
              :label="t('observability.outboxColNextRetry')"
              width="160"
            />
            <el-table-column :label="t('observability.outboxColActions')" width="120" fixed="right">
              <template #default="{ row }">
                <div class="table-actions">
                  <el-button size="small" plain type="primary" @click="openDetail('retry', row)">
                    {{ t('observability.outboxActionDetail') }}
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </ProTable>
        </el-tab-pane>
        <el-tab-pane :label="t('observability.outboxTabDelivery')" name="delivery">
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
                @refresh="() => runRefresh(loadTab)"
              >
                <el-form-item :label="t('observability.outboxKeywordLabel')">
                  <el-input
                    class="query-w-220"
                    v-model="deliveryKwDraft"
                    clearable
                    :placeholder="t('observability.outboxDeliveryKeywordPlaceholder')"
                    @keyup.enter="onDeliverySearch"
                  />
                </el-form-item>
                <el-form-item :label="t('observability.outboxStatusLabel')">
                  <MetaSelect
                    class="query-w-200"
                    v-model="deliveryStatusDraft"
                    clearable
                    filterable
                    allow-create
                    default-first-option
                    enum-key="outboxPublishStatus"
                    :placeholder="t('observability.outboxDeliveryStatusPlaceholder')"
                    @keyup.enter="onDeliverySearch"
                    :options="deliveryStatusSelectOptions"
                  />
                </el-form-item>
              </ListPageQueryBar>
            </template>
            <el-table-column
              prop="eventType"
              :label="t('observability.outboxColEventType')"
              width="140"
            />
            <el-table-column
              prop="eventKey"
              :label="t('observability.outboxColKey')"
              min-width="160"
              show-overflow-tooltip
            />
            <el-table-column
              prop="deliveryStatus"
              :label="t('observability.outboxColStatus')"
              width="120"
            >
              <template #default="{ row }">
                <StatusTag
                  :value="String(row.deliveryStatus ?? '')"
                  category="outboxPublishStatus"
                />
              </template>
            </el-table-column>
            <el-table-column
              prop="targetTopic"
              :label="t('observability.outboxColTopic')"
              min-width="140"
              show-overflow-tooltip
            />
            <el-table-column
              prop="deliveryAttempt"
              :label="t('observability.outboxColAttempt')"
              width="70"
              align="right"
            />
            <el-table-column
              prop="errorMessage"
              :label="t('observability.outboxColError')"
              min-width="180"
              show-overflow-tooltip
            />
            <DatetimeColumn
              prop="updatedAt"
              :label="t('observability.outboxColUpdated')"
              width="160"
            />
            <el-table-column :label="t('observability.outboxColActions')" width="120" fixed="right">
              <template #default="{ row }">
                <div class="table-actions">
                  <el-button size="small" plain type="primary" @click="openDetail('delivery', row)">
                    {{ t('observability.outboxActionDetail') }}
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
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { queryOutboxDeliveries, queryOutboxRetries } from '@/api/observabilityQueries'

  const { t } = useI18n({ useScope: 'global' })
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useSseAutoReload } from '@/composables/useSseAutoReload'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { toPageResult } from '@/api/adapters'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import PageContainer from '@/components/common/PageContainer.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import DetailDrawer from '@/components/common/DetailDrawer.vue'
  import type {
    ConsoleOutboxDeliveryLogResponse,
    ConsoleOutboxRetryLogResponse,
  } from '@/types/console-api'

  const tenant = useTenantStore()
  const tab = ref<'retry' | 'delivery'>('retry')
  const loading = ref(false)
  const loadError = ref<unknown>(null)
  const {
    filterBusy: queryActionBusy,
    tableBlocking,
    runSearch,
    runReset,
    runRefresh,
  } = useListFilterFeedback(loading)

  const retriesAll = ref<ConsoleOutboxRetryLogResponse[]>([])
  const deliveriesAll = ref<ConsoleOutboxDeliveryLogResponse[]>([])

  const detailVisible = ref(false)
  const detailKind = ref<'retry' | 'delivery'>('retry')
  const detailRow = ref<ConsoleOutboxRetryLogResponse | ConsoleOutboxDeliveryLogResponse | null>(
    null,
  )
  const detailTitle = computed(() =>
    detailKind.value === 'retry'
      ? t('observability.outboxRetryDetailTitle')
      : t('observability.outboxDeliveryDetailTitle'),
  )
  const detailMetaRows = computed(() => {
    if (!detailRow.value) return []
    const rows = [
      { label: t('observability.outboxColEventType'), value: detailRow.value.eventType ?? '' },
      { label: t('observability.outboxColKey'), value: detailRow.value.eventKey ?? '' },
    ]
    if (detailKind.value === 'delivery') {
      rows.push({
        label: t('observability.outboxColTopic'),
        value: (detailRow.value as ConsoleOutboxDeliveryLogResponse).targetTopic ?? '',
      })
    }
    return rows
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
    loadError.value = null
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
