<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button
          v-if="canManageTenants"
          type="primary"
          :icon="Plus"
          class="pretty-add-button"
          @click="openCreate"
        >
          {{ t('tenantList.headerCreate') }}
        </el-button>
        <el-button v-if="canManageTenants" type="primary" plain @click="batchVisible = true">
          {{ t('tenantList.headerBatch') }}
        </el-button>
        <el-button v-if="canManageTenants" plain @click="copyVisible = true">
          {{ t('tenantList.headerCopyConfig') }}
        </el-button>
      </template>
    </PageHeader>

    <div class="metrics">
      <MetricCard
        :label="t('tenantList.metricTotal')"
        :value="page.total"
        clickable
        :active="queryApplied.status === ''"
        @click="filterByStatus('')"
      />
      <MetricCard
        :label="t('tenantList.metricActive')"
        :value="activeCount"
        tone="success"
        clickable
        :active="queryApplied.status === 'ACTIVE'"
        @click="filterByStatus('ACTIVE')"
      />
      <MetricCard
        :label="t('tenantList.metricSuspended')"
        :value="suspendedCount"
        :tone="suspendedCount > 0 ? 'warning' : 'neutral'"
        clickable
        :active="queryApplied.status === 'SUSPENDED'"
        @click="filterByStatus('SUSPENDED')"
      />
      <MetricCard :label="t('tenantList.metricCurrent')" :value="tenant.tenantId" />
    </div>

    <SectionCard>
      <template #header>
        <span>{{ t('tenantList.sectionTitle') }}</span>
      </template>

      <ListPageQueryBar
        :filter-busy="filterBusy"
        :refresh-busy="loading"
        @search="onSearch"
        @reset="onReset"
        @refresh="() => runRefresh(load)"
      >
        <el-form-item :label="t('tenantList.keyword')">
          <el-input
            class="query-w-220"
            v-model="queryDraft.keyword"
            clearable
            :placeholder="t('tenantList.keywordPlaceholderLite')"
            @keyup.enter="onSearch"
          />
        </el-form-item>
        <el-form-item :label="t('tenantList.statusLabel')">
          <MetaSelect
            class="query-w-140"
            v-model="queryDraft.status"
            clearable
            enum-key="tenantStatus"
            :placeholder="t('tenantList.statusPlaceholder')"
            :options="tenantStatusOptions"
          />
        </el-form-item>
      </ListPageQueryBar>

      <DataState
        :loading="loading"
        :error="loadError"
        :has-data="page.items.length > 0"
        :on-retry="load"
      >
        <el-table
          v-loading="loading"
          :data="page.items"
          stripe
          border
          :empty-text="hasActiveFilters ? t('tenantList.emptyFiltered') : t('common.noData')"
          class="console-table"
        >
          <!-- 引导式空状态:仅"无筛选 + 零数据"时显示 CTA;有筛选/状态过滤时回落到默认 empty-text -->
          <template v-if="!hasActiveFilters" #empty>
            <EmptyState :description="t('tenantList.emptyDescription')" :image-size="80">
              <template v-if="canManageTenants" #action>
                <el-button type="primary" :icon="Plus" @click="openCreate">
                  {{ t('tenantList.headerCreate') }}
                </el-button>
                <el-button plain @click="batchVisible = true">
                  {{ t('tenantList.headerBatch') }}
                </el-button>
              </template>
            </EmptyState>
          </template>
          <el-table-column
            prop="tenantId"
            :label="t('tenantList.colTenantId')"
            width="220"
            show-overflow-tooltip
          />
          <el-table-column
            prop="tenantName"
            :label="t('tenantList.colName')"
            width="240"
            show-overflow-tooltip
          />
          <el-table-column :label="t('tenantList.statusLabel')" width="96">
            <template #default="{ row }">
              <StatusTag :value="String(row.status ?? '')" category="tenant" />
            </template>
          </el-table-column>
          <el-table-column
            prop="description"
            :label="t('tenantList.colDescription')"
            min-width="360"
            show-overflow-tooltip
          />
          <el-table-column
            prop="createdBy"
            :label="t('tenantList.colCreatedBy')"
            width="120"
            show-overflow-tooltip
          />
          <DatetimeColumn prop="createdAt" :label="t('tenantList.colCreatedAt')" width="180" />
          <el-table-column :label="t('tenantList.colActions')" width="260" fixed="right">
            <template #default="{ row }">
              <div class="table-actions tenant-row-actions">
                <el-tag
                  v-if="row.tenantId === tenant.tenantId"
                  type="success"
                  size="small"
                  effect="plain"
                  class="current-tag"
                >
                  {{ t('tenantList.currentTag') }}
                </el-tag>
                <RowActions :actions="rowActions(row)" :inline-limit="2" />
              </div>
            </template>
          </el-table-column>
        </el-table>
      </DataState>

      <TablePagerBar
        :page="queryApplied.pageNo"
        :page-size="queryApplied.pageSize"
        :total="page.total"
        @update:page="onPage"
        @update:page-size="onPageSize"
      />
    </SectionCard>

    <TenantFormDialog v-model="formVisible" :initial="formInitial" @saved="onTenantSaved" />
    <TenantBatchCreateDialog
      v-model="batchVisible"
      :items="page.items"
      @saved="load"
      @result="showResult"
    />
    <TenantInitConfigDialog
      v-model="initVisible"
      :target-tenant-id="initTargetTenantId"
      @result="showResult"
    />
    <TenantCopyConfigDialog v-model="copyVisible" :items="page.items" @result="showResult" />

    <el-dialog v-model="resultVisible" :title="t('tenantList.resultDialogTitle')" width="640px">
      <JsonPreview class="result-json" :data="resultJson" />
      <template #footer>
        <el-button type="primary" @click="resultVisible = false">{{ t('common.ok') }}</el-button>
      </template>
    </el-dialog>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, onMounted, reactive, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { confirmDanger } from '@/composables/useDangerConfirm'
  import { Plus } from '@element-plus/icons-vue'

  const { t } = useI18n({ useScope: 'global' })
  import {
    listTenants,
    suspendTenant,
    activateTenant,
    type Tenant,
    type TenantListQuery,
    type TenantPage,
    type TenantStatus,
  } from '@/api/tenants'
  import { useAuthStore } from '@/stores/auth'
  import { useTenantStore } from '@/stores/tenant'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useListLoadState } from '@/composables/useListLoadState'
  import DataState from '@/components/common/DataState.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import { canManageTenants as hasTenantAdminAccess } from '@/utils/tenantAccess'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import MetricCard from '@/components/common/MetricCard.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import RowActions, { type RowAction } from '@/components/common/RowActions.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'
  import { showCreateSuccess } from '@/composables/useCreateSuccess'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import TablePagerBar from '@/components/table/TablePagerBar.vue'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import TenantFormDialog from './components/TenantFormDialog.vue'
  import TenantBatchCreateDialog from './components/TenantBatchCreateDialog.vue'
  import TenantInitConfigDialog from './components/TenantInitConfigDialog.vue'
  import TenantCopyConfigDialog from './components/TenantCopyConfigDialog.vue'

  const auth = useAuthStore()
  const tenant = useTenantStore()
  const { loading, error: loadError, run: runLoad } = useListLoadState()
  const listRemote = ref(true)
  const { filterBusy, runSearch, runReset, runRefresh } = useListFilterFeedback(listRemote)

  const queryDraft = reactive<{
    keyword: string
    status: TenantStatus | ''
  }>({ keyword: '', status: '' })

  const queryApplied = reactive<
    Required<Pick<TenantListQuery, 'pageNo' | 'pageSize'>> & {
      keyword: string
      status: TenantStatus | ''
    }
  >({
    keyword: '',
    status: '',
    pageNo: 1,
    pageSize: 15,
  })

  const page = ref<TenantPage>({ total: 0, pageNo: 1, pageSize: 15, items: [] })

  const { data: metaEnums } = useConsoleMetaEnumsQuery()
  const tenantStatusOptions = computed(() => pickMetaEnumGroup(metaEnums.value, 'tenantStatus'))

  const activeCount = computed(
    () => page.value.items.filter((item) => item.status === 'ACTIVE').length,
  )
  const suspendedCount = computed(
    () => page.value.items.filter((item) => item.status === 'SUSPENDED').length,
  )
  const canManageTenants = computed(() => hasTenantAdminAccess(auth.userInfo?.permissions ?? []))

  // 用于"引导式空状态":仅在没有筛选 + 没数据时才展示"新增第一个"CTA
  // 有 keyword 或 status 过滤时,空数据应说"未找到符合条件",而不是诱导新增
  const hasActiveFilters = computed(() => !!queryApplied.keyword || !!queryApplied.status)

  async function load() {
    await runLoad(async () => {
      const q: TenantListQuery = {
        pageNo: queryApplied.pageNo,
        pageSize: queryApplied.pageSize,
      }
      if (queryApplied.keyword) q.keyword = queryApplied.keyword
      if (queryApplied.status) q.status = queryApplied.status
      const resp = await listTenants(q)
      page.value = resp
    }).catch(() => {
      page.value = {
        total: 0,
        pageNo: queryApplied.pageNo,
        pageSize: queryApplied.pageSize,
        items: [],
      }
    })
  }

  function onSearch() {
    return runSearch(async () => {
      queryApplied.keyword = queryDraft.keyword.trim()
      queryApplied.status = queryDraft.status
      queryApplied.pageNo = 1
      await load()
    })
  }

  /** 指标卡点击 → 同步 status 到 draft 与 applied,重拉列表 */
  function filterByStatus(status: TenantStatus | '') {
    queryDraft.status = status
    queryApplied.status = status
    queryApplied.pageNo = 1
    void load()
  }

  function onReset() {
    return runReset(async () => {
      queryDraft.keyword = ''
      queryDraft.status = ''
      queryApplied.keyword = ''
      queryApplied.status = ''
      queryApplied.pageNo = 1
      await load()
    })
  }

  function onPage(p: number) {
    queryApplied.pageNo = p
    void load()
  }

  function onPageSize(s: number) {
    queryApplied.pageSize = s
    queryApplied.pageNo = 1
    void load()
  }

  // ── 表单弹窗 ─────────────────────────────────────────
  const formVisible = ref(false)
  const formInitial = ref<Tenant | null>(null)

  function openCreate() {
    if (!canManageTenants.value) return
    formInitial.value = null
    formVisible.value = true
  }

  function openEdit(row: Tenant) {
    if (!canManageTenants.value) return
    formInitial.value = row
    formVisible.value = true
  }

  // ── 行操作工厂(给 <RowActions> 用)─────────────────────────────
  function rowActions(row: Tenant): RowAction[] {
    const isCurrent = row.tenantId === tenant.tenantId
    const isActive = row.status === 'ACTIVE'
    const acts: RowAction[] = []
    // 主操作:设为当前 / 已是当前
    if (!isCurrent) {
      acts.push({
        key: 'switch',
        label: t('tenantList.actionSwitch'),
        primary: true,
        onClick: () => switchToTenant(row),
      })
    }
    if (canManageTenants.value) {
      acts.push({
        key: 'edit',
        label: t('tenantList.actionEdit'),
        onClick: () => openEdit(row),
      })
      acts.push({
        key: 'init',
        label: t('tenantList.actionInitConfig'),
        // 加 divided 在"更多"菜单里和上面 edit 视觉分隔;init 是中风险动作,
        // 不放外露,通过 inlineLimit=2 让它进 more
        divided: true,
        onClick: () => openInitConfig(row),
      })
      if (isActive) {
        acts.push({
          key: 'suspend',
          label: t('tenantList.actionSuspend'),
          danger: true,
          divided: true,
          onClick: () => confirmSuspend(row),
        })
      } else {
        acts.push({
          key: 'activate',
          label: t('tenantList.actionResume'),
          divided: true,
          onClick: () => confirmActivate(row),
        })
      }
    }
    return acts
  }

  // ── 批量 / 复制 / 初始化 ─────────────────────────────
  const batchVisible = ref(false)
  const copyVisible = ref(false)
  const initVisible = ref(false)
  const initTargetTenantId = ref('')

  // 创建租户后:刷新列表 + 弹出"去初始化 / 留在列表"引导卡片;编辑只刷新
  // 解决体检"病根 2:做完就完事,没下一步引导"——新租户最关键的下一步就是初始化基础配置
  async function onTenantSaved(payload: { tenantId: string; created: boolean }) {
    await load()
    if (!payload.created) return
    showCreateSuccess({
      title: t('tenantList.createdCardTitle'),
      message: t('tenantList.createdCardMessage', { id: payload.tenantId }),
      primary: {
        label: t('tenantList.createdCardPrimary'),
        onClick: () => {
          initTargetTenantId.value = payload.tenantId
          initVisible.value = true
        },
      },
      secondary: { label: t('tenantList.createdCardSecondary') },
    })
  }

  function openInitConfig(row: Tenant) {
    if (!canManageTenants.value) return
    initTargetTenantId.value = row.tenantId
    initVisible.value = true
  }

  // ── 暂停 / 恢复 ───────────────────────────────────────
  async function confirmSuspend(row: Tenant) {
    if (!canManageTenants.value) return
    try {
      await confirmDanger({
        verb: '停用',
        target: `租户「${row.tenantId}」`,
        consequence:
          '该租户下所有触发器停止派发,正在运行的任务不受影响。租户用户登录/调用 API 将被拒绝。可在列表点"启用"恢复。',
        confirmButtonText: '确认停用',
      })
      await suspendTenant(row.tenantId)
      ElMessage.success(t('tenantList.suspendedToast'))
      await load()
    } catch {
      /* cancel */
    }
  }

  async function confirmActivate(row: Tenant) {
    if (!canManageTenants.value) return
    try {
      await confirmDanger({
        verb: '启用',
        target: `租户「${row.tenantId}」`,
        consequence: '该租户的触发器恢复派发,用户可重新登录。',
        confirmButtonText: '确认启用',
      })
      await activateTenant(row.tenantId)
      ElMessage.success(t('tenantList.activatedToast'))
      await load()
    } catch {
      /* cancel */
    }
  }

  async function switchToTenant(row: Tenant) {
    if (row.tenantId === tenant.tenantId) return
    tenant.setTenantId(row.tenantId)
    ElMessage.success(t('tenantList.switchedToast', { id: row.tenantId }))
    // 切租户后必须刷新 auth profile,否则 role/menus/permissions 还是上一个租户的。
    // 同时 await,避免侧边栏 / 路由 guard 在过渡窗口期用旧权限渲染或放行。
    try {
      await auth.fetchMe()
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[tenant-switch] fetchMe failed:', err)
    }
  }

  // ── 结果展示 ─────────────────────────────────────────
  const resultVisible = ref(false)
  const resultJson = ref('')

  function showResult(data: unknown) {
    resultJson.value = JSON.stringify(data, null, 2)
    resultVisible.value = true
  }

  onMounted(load)
</script>

<style scoped>
  .metrics {
    display: grid;
    gap: var(--space-md);
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }

  .result-json {
    margin: 0;
    padding: 12px;
    max-height: 400px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: var(--font-family-mono, monospace);
    font-size: 12px;
    line-height: 1.5;
    border-radius: var(--radius-input, 4px);
    background: var(--el-fill-color-light);
    border: 1px solid var(--color-border-light);
  }

  .tenant-row-actions {
    justify-content: flex-start;
    flex-wrap: nowrap;
    gap: 6px;
  }

  .tenant-row-actions :deep(.row-actions) {
    flex-wrap: nowrap;
  }
</style>
