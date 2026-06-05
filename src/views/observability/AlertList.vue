<template>
  <PageContainer>
    <PageHeader />

    <SectionCard>
      <ProTable
        :data="rows"
        :loading="tableBlocking"
        :error="loadError"
        :on-retry="load"
        :total="total"
        :has-active-filters="hasAlertFilters"
        :empty-text="t('alertList.empty')"
        :filtered-empty-text="alertFilteredEmptyText"
        v-model:page="page"
        v-model:page-size="pageSize"
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
            <el-form-item :label="t('alertList.severityLabel')">
              <MetaSelect
                class="query-w-140"
                v-model="filters.severity"
                :options="severityOptions"
                clearable
                filterable
                enum-key="severity"
                :placeholder="t('alertList.severityPlaceholder')"
              />
            </el-form-item>
            <el-form-item :label="t('alertList.typeLabel')">
              <el-select
                class="query-w-160"
                v-model="filters.alertType"
                clearable
                filterable
                :placeholder="t('alertList.typePlaceholder')"
              >
                <el-option
                  v-for="option in alertTypeOptions"
                  :key="option"
                  :label="option"
                  :value="option"
                />
              </el-select>
            </el-form-item>
            <el-form-item :label="t('alertList.statusLabel')">
              <MetaSelect
                class="query-w-140"
                v-model="filters.status"
                :options="statusOptions"
                clearable
                filterable
                enum-key="alertStatus"
                :placeholder="t('alertList.statusPlaceholder')"
              />
            </el-form-item>
            <el-form-item :label="t('alertList.traceLabel')">
              <el-input
                class="query-w-160"
                v-model="filters.traceId"
                clearable
                :placeholder="t('alertList.tracePlaceholder')"
              />
            </el-form-item>
            <el-form-item :label="t('alertList.timeRangeLabel')">
              <DateRangePresetPicker v-model="timeRange" default-preset="today" />
            </el-form-item>
          </ListPageQueryBar>
        </template>

        <el-table-column prop="id" :label="t('alertList.colId')" width="80" />
        <el-table-column prop="severity" :label="t('alertList.colSeverity')" width="100">
          <template #default="{ row }">
            <StatusTag :value="String(row.severity ?? '')" category="alertSeverity" />
          </template>
        </el-table-column>
        <el-table-column prop="alertType" :label="t('alertList.colType')" width="120" />
        <el-table-column
          prop="serviceName"
          :label="t('alertList.colService')"
          width="140"
          show-overflow-tooltip
        />
        <el-table-column
          prop="title"
          :label="t('alertList.colTitle')"
          min-width="180"
          show-overflow-tooltip
        />
        <DatetimeColumn prop="firstSeenAt" :label="t('alertList.colFirstSeen')" width="160" />
        <el-table-column
          prop="dedupFingerprint"
          :label="t('alertList.colDedup')"
          width="160"
          show-overflow-tooltip
        />
        <el-table-column prop="status" :label="t('alertList.colStatus')" width="110">
          <template #default="{ row }">
            <StatusTag :value="String(row.status ?? '')" category="alertStatus" />
          </template>
        </el-table-column>
        <el-table-column prop="occurrenceCount" :label="t('alertList.colCount')" width="80" />
        <DatetimeColumn prop="lastSeenAt" :label="t('alertList.colLastSeen')" width="160" />
        <el-table-column
          prop="traceId"
          :label="t('alertList.colTrace')"
          min-width="120"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <router-link
              v-if="row.traceId"
              class="cell-link"
              :to="`/observability/trace?traceId=${row.traceId}`"
            >
              {{ row.traceId }}
            </router-link>
            <span v-else class="cell-empty">—</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('alertList.colActions')" width="260" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-tooltip
                :content="canMutateConfig ? '' : t('common.permissionDenied')"
                placement="top"
                :disabled="canMutateConfig"
              >
                <span>
                  <el-button
                    size="small"
                    plain
                    type="primary"
                    :disabled="!canMutateConfig"
                    :loading="actingId === row.id"
                    @click="doAck(row)"
                  >
                    {{ t('alertList.actionAck') }}
                  </el-button>
                </span>
              </el-tooltip>
              <el-tooltip
                :content="canMutateConfig ? '' : t('common.permissionDenied')"
                placement="top"
                :disabled="canMutateConfig"
              >
                <span>
                  <el-button
                    size="small"
                    plain
                    type="warning"
                    :disabled="!canMutateConfig"
                    :loading="actingId === row.id"
                    @click="doSilence(row)"
                  >
                    {{ t('alertList.actionSilence') }}
                  </el-button>
                </span>
              </el-tooltip>
              <el-tooltip
                :content="canMutateConfig ? '' : t('common.permissionDenied')"
                placement="top"
                :disabled="canMutateConfig"
              >
                <span>
                  <el-button
                    size="small"
                    plain
                    type="danger"
                    :disabled="!canMutateConfig"
                    :loading="actingId === row.id"
                    @click="doClose(row)"
                  >
                    {{ t('alertList.actionClose') }}
                  </el-button>
                </span>
              </el-tooltip>
            </div>
          </template>
        </el-table-column>
      </ProTable>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { confirmDanger } from '@/composables/useDangerConfirm'

  const { t } = useI18n({ useScope: 'global' })
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useSseAutoReload } from '@/composables/useSseAutoReload'
  import { queryAlertsPage } from '@/api/alertsQuery'
  import { acknowledgeAlert, closeAlert, silenceAlert } from '@/api/alertsCommands'
  import { useAuthStore } from '@/stores/auth'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { usePermission } from '@/composables/usePermission'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import type { ConsoleAlertEventResponse } from '@/types/console-api'

  const route = useRoute()
  const router = useRouter()
  const tenant = useTenantStore()
  const auth = useAuthStore()
  // VIEWER 角色看不到/点不动破坏性按钮:ack/silence/close 都属于"会改告警状态"的 mutation,
  // 旧版只是 v-if 隐藏顶部 Create 类按钮,行内 ack/silence/close 没 gate,VIEWER 点了才弹 403,
  // bad surprise。这里复用 canMutateConfig 灰显 + tooltip。
  const { canMutateConfig } = usePermission()
  const loading = ref(false)
  const {
    filterBusy: queryActionBusy,
    tableBlocking,
    runSearch,
    runReset,
    runRefresh,
  } = useListFilterFeedback(loading)
  // 当前页原始数据(BE 已分页过滤完 acknowledged/startDate/endDate;
  // severity/alertType/traceId 三个 BE 不支持的字段在前端做"当前页局部过滤")
  const pageRaw = ref<ConsoleAlertEventResponse[]>([])
  // 所有已加载页的 union,用来派生 alertType select 候选;限制最大 5 页避免膨胀
  const allRows = ref<ConsoleAlertEventResponse[]>([])
  const rows = ref<ConsoleAlertEventResponse[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(15)
  const actingId = ref<number | null>(null)
  const timeRange = ref<[string, string] | null>(null)
  const filters = reactive({
    tenantId: tenant.tenantId,
    severity: '',
    alertType: '',
    status: '',
    traceId: '',
    startTime: '',
    endTime: '',
  })

  // severity / alertStatus 走后端 enum 字典(完整候选);进页面就有数据,不依赖列表先加载
  const { data: metaEnums } = useConsoleMetaEnumsQuery()
  const severityOptions = computed(() => pickMetaEnumGroup(metaEnums.value, 'severity'))
  const statusOptions = computed(() => pickMetaEnumGroup(metaEnums.value, 'alertStatus'))
  // alertType 后端没枚举字典(各租户业务自定),保持从已加载数据 unique 派生
  const alertTypeOptions = computed(() =>
    Array.from(
      new Set(allRows.value.map((row) => row.alertType).filter((item): item is string => !!item)),
    ),
  )

  const hasAlertFilters = computed(
    () =>
      !!(
        filters.severity.trim() ||
        filters.alertType.trim() ||
        filters.status.trim() ||
        filters.traceId.trim() ||
        filters.startTime ||
        filters.endTime
      ),
  )

  const alertFilteredEmptyText = computed(() =>
    filters.traceId.trim() ? t('alertList.emptyTrace') : t('alertList.emptyFiltered'),
  )

  function actionBody(reason?: string) {
    return {
      tenantId: tenant.tenantId,
      operatorId: auth.userInfo?.username ?? auth.userInfo?.userId,
      reason,
    }
  }

  /**
   * 客户端"当前页"局部过滤(severity / alertType / traceId):BE 不支持这些过滤维度,
   * 跨页全量过滤会拉爆大租户,所以仅在 BE 返回的当前页结果上再过滤,
   * 配合 ProTable 的 filtered-empty-text 提示用户"当前页无匹配"。
   * status 字段映射成 BE 的 acknowledged 在服务端处理;时间范围对应 startDate/endDate。
   */
  function applyLocalFilter(list: ConsoleAlertEventResponse[]): ConsoleAlertEventResponse[] {
    // clearable 控件点 X 清除会置 null/undefined → 直接 .trim() 会 TypeError 击穿渲染,统一 ?? '' 兜底
    return list.filter((row) => {
      const sev = (filters.severity ?? '').trim()
      if (sev && !row.severity?.includes(sev)) return false
      const at = (filters.alertType ?? '').trim()
      if (at && !row.alertType?.includes(at)) return false
      const tid = (filters.traceId ?? '').trim()
      if (tid && !row.traceId?.includes(tid)) return false
      return true
    })
  }

  /** 把 UI 的 filters.status 映射成 BE 的 acknowledged 布尔(只有 OPEN / 非 OPEN 两档) */
  function resolveAcknowledgedFilter(): boolean | undefined {
    const s = (filters.status ?? '').trim().toUpperCase()
    if (!s) return undefined
    if (s === 'OPEN') return false
    // ACKNOWLEDGED / SILENCED / CLOSED 都属于非 OPEN
    return true
  }

  function slicePage() {
    const filtered = applyLocalFilter(pageRaw.value)
    rows.value = filtered
  }

  const loadError = ref<unknown>(null)
  async function load() {
    loading.value = true
    loadError.value = null
    try {
      const resp = await queryAlertsPage(
        filters.tenantId || tenant.tenantId,
        page.value,
        pageSize.value,
        {
          acknowledged: resolveAcknowledgedFilter(),
          startDate: filters.startTime || undefined,
          endDate: filters.endTime || undefined,
        },
      )
      pageRaw.value = (resp.items ?? []) as ConsoleAlertEventResponse[]
      total.value = Number(resp.total ?? pageRaw.value.length)
      // 维护 union,但限制大小避免 alertType 候选无穷膨胀(只保留最近 5 页 ≈ 1000 行)
      const cap = pageSize.value * 5
      const merged = [...allRows.value, ...pageRaw.value]
      allRows.value = merged.slice(-cap)
      slicePage()
    } catch (err) {
      loadError.value = err
      throw err
    } finally {
      loading.value = false
    }
  }

  // 翻页 / 改 pageSize 都触发 BE 重拉(替代旧的纯前端 slice)
  watch([page, pageSize], () => {
    void load()
  })

  function search() {
    return runSearch(async () => {
      // traceId 是全局唯一键,搜它时清掉时间范围(默认 today preset),否则别的业务日的告警搜不到。
      if (filters.traceId?.trim()) {
        timeRange.value = null
        filters.startTime = ''
        filters.endTime = ''
      }
      page.value = 1
      await load()
    })
  }

  function reset() {
    return runReset(async () => {
      filters.tenantId = tenant.tenantId
      filters.severity = ''
      filters.alertType = ''
      filters.status = ''
      filters.traceId = ''
      filters.startTime = ''
      filters.endTime = ''
      timeRange.value = null
      page.value = 1
      await load()
    })
  }

  async function optionalReason(title: string): Promise<string | undefined> {
    try {
      const { value } = await ElMessageBox.prompt(t('alertList.reasonPrompt'), title, {
        confirmButtonText: t('alertList.reasonSubmit'),
        cancelButtonText: t('alertList.reasonSkip'),
        distinguishCancelAndClose: true,
        inputPlaceholder: t('alertList.reasonPlaceholder'),
      })
      return value?.trim() || undefined
    } catch (e) {
      if (e === 'cancel') return undefined
      throw e
    }
  }

  async function doAck(row: ConsoleAlertEventResponse) {
    try {
      await confirmDanger({
        verb: '确认告警',
        target: `「${row.title}」`,
        consequence: '该告警将进入"已确认"状态,通知值班暂停升级,但不会自动修复根因。',
        confirmButtonText: '确认告警',
      })
      actingId.value = row.id
      const reason = await optionalReason(t('alertList.ackReasonTitle'))
      await acknowledgeAlert(row.id, actionBody(reason))
      ElMessage.success(t('alertList.ackedToast'))
      await load()
    } catch (e) {
      if (e !== 'cancel' && e !== 'close') {
        /* handled */
      }
    } finally {
      actingId.value = null
    }
  }

  async function doSilence(row: ConsoleAlertEventResponse) {
    try {
      await confirmDanger({
        verb: '静默',
        target: `「${row.title}」`,
        consequence: '该告警的同类事件将不再发出通知,直到静默期结束或被手动取消。',
        confirmButtonText: '确认静默',
      })
      actingId.value = row.id
      const reason = await optionalReason(t('alertList.silenceReasonTitle'))
      await silenceAlert(row.id, actionBody(reason))
      ElMessage.success(t('alertList.silencedToast'))
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
      await confirmDanger({
        verb: '关闭',
        target: `「${row.title}」`,
        consequence: '告警从看板下架。若根因未解决,同类事件仍会以新告警形式重新产生。',
        irreversible: true,
        confirmButtonText: '确认关闭',
      })
      actingId.value = row.id
      const reason = await optionalReason(t('alertList.closeReasonTitle'))
      await closeAlert(row.id, actionBody(reason))
      ElMessage.success(t('alertList.closedToast'))
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
    filters.startTime = value?.[0] ?? ''
    filters.endTime = value?.[1] ?? ''
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
    if (q.alertType) filters.alertType = String(q.alertType)
    if (q.page) {
      const p = Number(q.page)
      if (Number.isFinite(p) && p > 0) page.value = p
    }
    if (q.pageSize) {
      const ps = Number(q.pageSize)
      if (Number.isFinite(ps) && ps > 0) pageSize.value = ps
    }
  }

  // URL state:筛选 + 分页 round-trip
  function syncFiltersToUrl() {
    const params: Record<string, string> = {}
    if (filters.severity) params.severity = filters.severity
    if (filters.status) params.status = filters.status
    if (filters.traceId) params.traceId = filters.traceId
    if (filters.alertType) params.alertType = filters.alertType
    if (page.value > 1) params.page = String(page.value)
    if (pageSize.value !== 15) params.pageSize = String(pageSize.value)
    void router.replace({ query: params })
  }
  watch(
    () => [
      filters.severity,
      filters.status,
      filters.traceId,
      filters.alertType,
      page.value,
      pageSize.value,
    ],
    syncFiltersToUrl,
  )

  useTenantReload(() => {
    page.value = 1
    void load()
  })
</script>
