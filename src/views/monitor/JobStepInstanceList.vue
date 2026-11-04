<template>
  <PageContainer>
    <PageHeader />

    <div>
      <ProTable
        :data="rows"
        :loading="loading"
        :total="total"
        v-model:page="page"
        v-model:page-size="pageSize"
        @change="slicePage"
        :error="loadError"
        :on-retry="load"
      >
        <template #query>
          <ListPageQueryBar
            :filter-busy="queryActionBusy"
            :refresh-busy="loading"
            @search="onQuerySearch"
            @reset="onQueryReset"
            @refresh="onQueryRefresh"
          >
            <el-form-item :label="t('monitor.stepInstanceIdLabel')">
              <el-input
                class="query-w-160"
                v-model="filterInstanceId"
                clearable
                :placeholder="t('monitor.stepInstanceIdPlaceholder')"
              />
            </el-form-item>
            <el-form-item :label="t('monitor.stepStatusLabel')">
              <MetaSelect
                class="query-w-200"
                v-model="filterStepStatus"
                clearable
                filterable
                enum-key="partitionStatus"
                :placeholder="t('monitor.stepStatusPlaceholder')"
                :options="stepStatusOptions"
              />
            </el-form-item>
          </ListPageQueryBar>
          <el-alert
            v-if="validationError"
            :title="validationError"
            type="warning"
            :closable="false"
            show-icon
          />
        </template>
        <el-table-column prop="jobInstanceId" :label="t('monitor.stepColInstanceId')" width="100">
          <template #default="{ row }">
            <CopyableText :text="String(row.jobInstanceId)" :copyable="false">
              <router-link class="cell-link" :to="`/monitor/job-instances/${row.jobInstanceId}`">
                {{ row.jobInstanceId }}
              </router-link>
            </CopyableText>
          </template>
        </el-table-column>
        <el-table-column :label="t('monitor.stepColStep')" width="180">
          <template #default="{ row }">
            <div class="cell-stack">
              <CopyableText v-if="row.stepCode" class="cell-main" :text="String(row.stepCode)" />
              <span v-else class="cell-main">{{ row.stepCode }}</span>
              <span v-if="row.stepType" class="cell-sub">{{ row.stepType }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="stepStatus" :label="t('monitor.stepColStatus')" width="120">
          <template #default="{ row }">
            <StatusTag :value="String(row.stepStatus ?? '')" category="partition" />
          </template>
        </el-table-column>
        <el-table-column
          prop="retryCount"
          :label="t('monitor.stepColRetry')"
          width="80"
          align="right"
        />
        <DatetimeColumn prop="startedAt" :label="t('monitor.stepColStarted')" width="160" />
        <DatetimeColumn prop="finishedAt" :label="t('monitor.stepColFinished')" width="160" />
        <el-table-column :label="t('monitor.stepColError')" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <ErrorDetailsText :code="row.errorCode" :message="row.errorMessage" />
          </template>
        </el-table-column>
        <el-table-column :label="t('monitor.stepColActions')" width="110" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button
                size="small"
                plain
                type="primary"
                :icon="Eye"
                @click="goInstance(row.jobInstanceId)"
              >
                {{ t('monitor.stepActionInstance') }}
              </el-button>
            </div>
          </template>
        </el-table-column>
      </ProTable>
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
  import CopyableText from '@/components/common/CopyableText.vue'
  import ErrorDetailsText from '@/components/common/ErrorDetailsText.vue'
  import { Eye } from '@lucide/vue'
  import { computed, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'

  const { t } = useI18n({ useScope: 'global' })
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { queryJobStepInstancePage } from '@/api/jobStepInstances'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import DatetimeColumn from '@/components/common/DatetimeColumn.vue'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import type { ConsoleJobStepInstanceResponse } from '@/types/console-api'

  const route = useRoute()
  const router = useRouter()
  const tenant = useTenantStore()
  const loading = ref(false)
  const loadError = ref<unknown>(null)
  const validationError = ref('')
  const {
    filterBusy: queryActionBusy,
    runSearch,
    runReset,
    runRefresh,
  } = useListFilterFeedback(loading)
  const filterInstanceId = ref('')
  const filterStepStatus = ref('')
  const { data: metaEnums } = useConsoleMetaEnumsQuery()

  const stepStatusOptions = computed(() => pickMetaEnumGroup(metaEnums.value, 'partitionStatus'))
  const page = ref(1)
  const pageSize = ref(15)
  const total = ref(0)
  const rows = ref<ConsoleJobStepInstanceResponse[]>([])

  function slicePage() {
    void load()
  }

  function onQuerySearch() {
    if (readInstanceId() === null) return load()
    return runSearch(() => {
      page.value = 1
      return load()
    })
  }

  function onQueryReset() {
    return runReset(() => {
      filterInstanceId.value = ''
      filterStepStatus.value = ''
      page.value = 1
      return load()
    })
  }

  function onQueryRefresh() {
    if (readInstanceId() === null) return load()
    return runRefresh(load)
  }

  // Long 查询参数保留十进制原文，避免转换为 Number 时丢失精度。
  function readInstanceId(): string | undefined | null {
    const text = filterInstanceId.value.trim()
    if (!text) return undefined
    if (!/^\d+$/.test(text)) return null
    const id = BigInt(text)
    return id > 0n && id <= 9223372036854775807n ? text : null
  }

  async function load() {
    loading.value = true
    loadError.value = null
    try {
      const jobInstanceId = readInstanceId()
      if (jobInstanceId === null) {
        validationError.value = t('monitor.stepInvalidInstanceId')
        return
      }
      validationError.value = ''
      const tenantId = tenant.tenantId
      const pageNo = page.value
      const requestedPageSize = pageSize.value
      const stepStatus = filterStepStatus.value.trim() || undefined
      const result = await queryJobStepInstancePage({
        tenantId,
        pageNo,
        pageSize: requestedPageSize,
        jobInstanceId,
        stepStatus,
      })
      rows.value = result.items ?? []
      total.value = result.total ?? 0
    } catch (err) {
      loadError.value = err
      throw err
    } finally {
      loading.value = false
    }
  }

  function goInstance(jobInstanceId: number) {
    router.push(`/monitor/job-instances/${jobInstanceId}`)
  }

  {
    // 深链参数以 jobInstanceId 为准；instanceId 是作业运行列表早期使用的名字，继续兼容
    const q = (route.query.jobInstanceId ?? route.query.instanceId) as string | undefined
    if (q) filterInstanceId.value = q
  }

  useTenantReload(load)
</script>

<style scoped>
  .cell-stack {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-width: 0;
  }

  .cell-sub {
    color: var(--color-text-tertiary);
    font-size: 12px;
  }
</style>
