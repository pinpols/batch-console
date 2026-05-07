<template>
  <PageContainer>
    <PageHeader title="告警" description="告警事件查看、确认、静默与关闭。" />

    <SectionCard>
      <ProTable
        :data="rows"
        :loading="tableBlocking"
        :total="total"
        v-model:page="page"
        v-model:page-size="pageSize"
        @change="slicePage"
      >
        <template #query>
          <ListPageQueryBar
            :filter-busy="queryActionBusy"
            :refresh-busy="loading"
            :disabled="loading"
            @search="search"
            @reset="reset"
            @refresh="() => runRefresh(load)"
          >
            <el-form-item label="级别">
              <el-select
                class="query-w-140"
                v-model="filters.severity"
                clearable
                filterable
                placeholder="请选择级别"
              >
                <el-option
                  v-for="option in severityOptions"
                  :key="option"
                  :label="option"
                  :value="option"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="类型">
              <el-select
                class="query-w-160"
                v-model="filters.alertType"
                clearable
                filterable
                placeholder="请选择 alertType"
              >
                <el-option
                  v-for="option in alertTypeOptions"
                  :key="option"
                  :label="option"
                  :value="option"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="状态">
              <el-select
                class="query-w-140"
                v-model="filters.status"
                clearable
                filterable
                placeholder="请选择状态"
              >
                <el-option
                  v-for="option in statusOptions"
                  :key="option"
                  :label="option"
                  :value="option"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="Trace">
              <el-input
                class="query-w-160"
                v-model="filters.traceId"
                clearable
                placeholder="请输入 traceId"
              />
            </el-form-item>
            <el-form-item label="时间范围">
              <el-date-picker
                class="query-w-340"
                v-model="timeRange"
                type="datetimerange"
                value-format="YYYY-MM-DD HH:mm:ss"
                range-separator="至"
                start-placeholder="开始时间"
                end-placeholder="结束时间"
              />
            </el-form-item>
          </ListPageQueryBar>
        </template>

        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="severity" label="级别" width="100">
          <template #default="{ row }">
            <StatusTag :value="String(row.severity ?? '')" category="alertSeverity" />
          </template>
        </el-table-column>
        <el-table-column prop="alertType" label="类型" width="120" />
        <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="110">
          <template #default="{ row }">
            <StatusTag :value="String(row.status ?? '')" category="alertStatus" />
          </template>
        </el-table-column>
        <el-table-column prop="occurrenceCount" label="次数" width="80" />
        <DatetimeColumn prop="lastSeenAt" label="最近" width="160" />
        <el-table-column prop="traceId" label="Trace" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">
            <router-link v-if="row.traceId" class="cell-link" :to="`/logs?traceId=${row.traceId}`">
              {{ row.traceId }}
            </router-link>
            <span v-else class="cell-empty">—</span>
          </template>
        </el-table-column>
        <el-table-column label="治理" width="260" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button
                size="small"
                plain
                type="primary"
                :loading="actingId === row.id"
                @click="doAck(row)"
              >
                确认
              </el-button>
              <el-button
                size="small"
                plain
                type="warning"
                :loading="actingId === row.id"
                @click="doSilence(row)"
              >
                静默
              </el-button>
              <el-button
                size="small"
                plain
                type="danger"
                :loading="actingId === row.id"
                @click="doClose(row)"
              >
                关闭
              </el-button>
            </div>
          </template>
        </el-table-column>
      </ProTable>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useSseAutoReload } from '@/composables/useSseAutoReload'
  import { toPageResult } from '@/api/adapters'
  import { queryAlertsAll } from '@/api/alertsQuery'
  import { acknowledgeAlert, closeAlert, silenceAlert } from '@/api/alertsCommands'
  import { useAuthStore } from '@/stores/auth'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import TenantSelect from '@/components/common/TenantSelect.vue'
  import type { ConsoleAlertEventResponse } from '@/types/console-api'

  const route = useRoute()
  const tenant = useTenantStore()
  const auth = useAuthStore()
  const loading = ref(false)
  const {
    filterBusy: queryActionBusy,
    tableBlocking,
    runSearch,
    runReset,
    runRefresh,
  } = useListFilterFeedback(loading)
  const allRows = ref<ConsoleAlertEventResponse[]>([])
  const rows = ref<ConsoleAlertEventResponse[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(20)
  const actingId = ref<number | null>(null)
  const timeRange = ref<[string, string] | []>([])
  const filters = reactive({
    tenantId: tenant.tenantId,
    severity: '',
    alertType: '',
    status: '',
    traceId: '',
    startTime: '',
    endTime: '',
  })

  const severityOptions = computed(() =>
    Array.from(
      new Set(allRows.value.map((row) => row.severity).filter((item): item is string => !!item)),
    ),
  )
  const alertTypeOptions = computed(() =>
    Array.from(
      new Set(allRows.value.map((row) => row.alertType).filter((item): item is string => !!item)),
    ),
  )
  const statusOptions = computed(() =>
    Array.from(
      new Set(allRows.value.map((row) => row.status).filter((item): item is string => !!item)),
    ),
  )

  function actionBody(reason?: string) {
    return {
      tenantId: tenant.tenantId,
      operatorId: auth.userInfo?.username ?? auth.userInfo?.userId,
      reason,
    }
  }

  function filteredRows() {
    return allRows.value.filter((row) => {
      if (filters.severity.trim() && !row.severity?.includes(filters.severity.trim())) return false
      if (filters.alertType.trim() && !row.alertType?.includes(filters.alertType.trim())) {
        return false
      }
      if (filters.status.trim() && !row.status?.includes(filters.status.trim())) return false
      if (filters.traceId.trim() && !row.traceId?.includes(filters.traceId.trim())) return false
      const lastSeenAt = String(row.lastSeenAt ?? '')
      if (filters.startTime && lastSeenAt < filters.startTime) return false
      if (filters.endTime && lastSeenAt > filters.endTime) return false
      return true
    })
  }

  function slicePage() {
    const filtered = filteredRows()
    total.value = filtered.length
    const pr = toPageResult(filtered, page.value, pageSize.value)
    rows.value = pr.records as ConsoleAlertEventResponse[]
  }

  async function load() {
    loading.value = true
    try {
      allRows.value = await queryAlertsAll(filters.tenantId || tenant.tenantId)
      slicePage()
    } finally {
      loading.value = false
    }
  }

  function search() {
    return runSearch(() => {
      page.value = 1
      slicePage()
    })
  }

  function reset() {
    return runReset(() => {
      filters.tenantId = tenant.tenantId
      filters.severity = ''
      filters.alertType = ''
      filters.status = ''
      filters.traceId = ''
      filters.startTime = ''
      filters.endTime = ''
      timeRange.value = []
      page.value = 1
      slicePage()
    })
  }

  async function optionalReason(title: string): Promise<string | undefined> {
    try {
      const { value } = await ElMessageBox.prompt('可选，审计说明', title, {
        confirmButtonText: '提交',
        cancelButtonText: '跳过',
        distinguishCancelAndClose: true,
        inputPlaceholder: 'reason',
      })
      return value?.trim() || undefined
    } catch (e) {
      if (e === 'cancel') return undefined
      throw e
    }
  }

  async function doAck(row: ConsoleAlertEventResponse) {
    try {
      await ElMessageBox.confirm(`确认告警「${row.title}」？`, '确认（ACK）', { type: 'warning' })
      actingId.value = row.id
      const reason = await optionalReason('ACK 说明')
      await acknowledgeAlert(row.id, actionBody(reason))
      ElMessage.success('已提交确认')
      await load()
    } catch (e) {
      if (e !== 'cancel' && e !== 'close') {
        /* 错误由拦截器提示 */
      }
    } finally {
      actingId.value = null
    }
  }

  async function doSilence(row: ConsoleAlertEventResponse) {
    try {
      await ElMessageBox.confirm(`静默告警「${row.title}」？`, '静默', { type: 'warning' })
      actingId.value = row.id
      const reason = await optionalReason('静默说明')
      await silenceAlert(row.id, actionBody(reason))
      ElMessage.success('已提交静默')
      await load()
    } catch (e) {
      if (e !== 'cancel' && e !== 'close') {
        /* handled */
      }
    } finally {
      actingId.value = null
    }
  }

  async function doClose(row: ConsoleAlertEventResponse) {
    try {
      await ElMessageBox.confirm(`关闭告警「${row.title}」？`, '关闭', { type: 'warning' })
      actingId.value = row.id
      const reason = await optionalReason('关闭说明')
      await closeAlert(row.id, actionBody(reason))
      ElMessage.success('已提交关闭')
      await load()
    } catch (e) {
      if (e !== 'cancel' && e !== 'close') {
        /* handled */
      }
    } finally {
      actingId.value = null
    }
  }

  watch(timeRange, (value) => {
    filters.startTime = value[0] ?? ''
    filters.endTime = value[1] ?? ''
  })

  useSseAutoReload({
    domain: 'alerts',
    reload: load,
    scope: () => tenant.tenantId,
  })

  {
    const q = route.query
    if (q.severity) filters.severity = String(q.severity)
    if (q.status) filters.status = String(q.status)
    if (q.traceId) filters.traceId = String(q.traceId)
  }

  useTenantReload(() => {
    page.value = 1
    void load()
  })
</script>
