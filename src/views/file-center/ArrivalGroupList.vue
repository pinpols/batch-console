<template>
  <PageContainer>
    <PageHeader />

    <SectionCard>
      <ProTable
        :data="rows"
        :loading="tableBlocking"
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
            :disabled="loading"
            @search="onSearch"
            @reset="onReset"
            @refresh="() => runRefresh(load)"
          >
            <el-form-item :label="t('arrivalGroupList.groupCodeLabel')">
              <el-input
                class="query-w-200"
                v-model="kwDraft"
                clearable
                :placeholder="t('arrivalGroupList.groupCodePlaceholder')"
                @keyup.enter="onSearch"
              />
            </el-form-item>
            <el-form-item :label="t('arrivalGroupList.stateLabel')">
              <el-input
                class="query-w-160"
                v-model="stateDraft"
                clearable
                :placeholder="t('arrivalGroupList.statePlaceholder')"
                @keyup.enter="onSearch"
              />
            </el-form-item>
          </ListPageQueryBar>
        </template>
        <el-table-column
          prop="fileGroupCode"
          :label="t('arrivalGroupList.colGroupCode')"
          min-width="140"
        />
        <el-table-column prop="arrivalState" :label="t('arrivalGroupList.colState')" width="130">
          <template #default="{ row }">
            <StatusTag :value="String(row.arrivalState ?? '')" category="arrival" />
          </template>
        </el-table-column>
        <el-table-column
          prop="waitFileGroupMode"
          :label="t('arrivalGroupList.colWaitMode')"
          width="110"
        />
        <el-table-column
          prop="requiredFileSet"
          :label="t('arrivalGroupList.colRequired')"
          min-width="160"
          show-overflow-tooltip
        />
        <el-table-column
          prop="arrivalTimeoutAction"
          :label="t('arrivalGroupList.colTimeoutAction')"
          width="110"
        />
        <el-table-column
          prop="arrivedCount"
          :label="t('arrivalGroupList.colArrived')"
          width="70"
          align="right"
        />
        <el-table-column
          prop="waitingCount"
          :label="t('arrivalGroupList.colWaiting')"
          width="80"
          align="right"
        />
        <el-table-column
          prop="timeoutCount"
          :label="t('arrivalGroupList.colTimeout')"
          width="70"
          align="right"
        />
        <el-table-column
          prop="triggeredCount"
          :label="t('arrivalGroupList.colTriggered')"
          width="80"
          align="right"
        />
        <DatetimeColumn
          prop="expectedArrivalTime"
          :label="t('arrivalGroupList.colExpected')"
          width="160"
        />
        <DatetimeColumn
          prop="latestTolerableTime"
          :label="t('arrivalGroupList.colTolerable')"
          width="160"
        />
        <DatetimeColumn
          prop="lastUpdatedAt"
          :label="t('arrivalGroupList.colUpdated')"
          width="160"
        />
        <el-table-column :label="t('arrivalGroupList.colActions')" width="130" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" plain type="primary" @click="confirm(row)">
                {{ t('arrivalGroupList.actionConfirm') }}
              </el-button>
            </div>
          </template>
        </el-table-column>
      </ProTable>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessageBox } from 'element-plus'

  const { t } = useI18n({ useScope: 'global' })
  import { toPageResult } from '@/api/adapters'
  import { fileApi } from '@/api/file'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import type { ConsoleFileArrivalGroupResponse } from '@/types/console-api'

  const tenant = useTenantStore()
  const loading = ref(false)
  const loadError = ref<unknown>(null)
  const {
    filterBusy: queryActionBusy,
    tableBlocking,
    runSearch,
    runReset,
    runRefresh,
  } = useListFilterFeedback(loading)
  const allRows = ref<ConsoleFileArrivalGroupResponse[]>([])
  const rows = ref<ConsoleFileArrivalGroupResponse[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(15)
  const kwDraft = ref('')
  const stateDraft = ref('')
  const kwApplied = ref('')
  const stateApplied = ref('')

  const filtered = computed(() => {
    let r = allRows.value
    const k = kwApplied.value.trim().toLowerCase()
    if (k) r = r.filter((row) => row.fileGroupCode?.toLowerCase().includes(k))
    const s = stateApplied.value.trim()
    if (s) r = r.filter((row) => String(row.arrivalState ?? '').includes(s))
    return r
  })

  function slicePage() {
    const list = filtered.value
    total.value = list.length
    const pr = toPageResult(list, page.value, pageSize.value)
    rows.value = pr.records as ConsoleFileArrivalGroupResponse[]
  }

  function onSearch() {
    return runSearch(() => {
      kwApplied.value = kwDraft.value.trim()
      stateApplied.value = stateDraft.value.trim()
      page.value = 1
      slicePage()
    })
  }

  function onReset() {
    return runReset(() => {
      kwDraft.value = ''
      stateDraft.value = ''
      kwApplied.value = ''
      stateApplied.value = ''
      page.value = 1
      slicePage()
    })
  }

  async function load() {
    loading.value = true
    loadError.value = null
    try {
      allRows.value = await fileApi.listArrivalGroups(tenant.tenantId)
      page.value = 1
      slicePage()
    } catch (err) {
      loadError.value = err
      throw err
    } finally {
      loading.value = false
    }
  }

  async function confirm(row: ConsoleFileArrivalGroupResponse) {
    try {
      await ElMessageBox.confirm(
        t('arrivalGroupList.confirmText', { code: row.fileGroupCode }),
        t('arrivalGroupList.confirmTitle'),
        {
          type: 'warning',
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
        },
      )
      await fileApi.confirmArrival(row.fileGroupCode, tenant.tenantId)
      await load()
    } catch {
      /* cancel */
    }
  }

  useTenantReload(load)
</script>
