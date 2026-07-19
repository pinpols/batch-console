<template>
  <PageContainer>
    <PageHeader :description="t('tenantList.pageDescription')">
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
        <!-- proto 头部只有一个主色按钮;批量/复制保留逻辑但降为次级形态 -->
        <el-button v-if="canManageTenants" plain @click="batchVisible = true">
          {{ t('tenantList.headerBatch') }}
        </el-button>
        <el-button v-if="canManageTenants" plain @click="copyVisible = true">
          {{ t('tenantList.headerCopyConfig') }}
        </el-button>
      </template>
    </PageHeader>

    <SectionCard>
      <!--
        proto 布局:筛选卡 + 表格卡,无统计卡、无区块标题、无刷新按钮;
        表格卡右上「☰ 列」= ProTable 列设置(proto 未展示的 描述/创建人/创建时间 收进列设置,默认隐藏)
      -->
      <ProTable
        :data="page.items"
        :loading="loading"
        :error="loadError"
        :on-retry="load"
        :total="page.total"
        :page="queryApplied.pageNo"
        :page-size="queryApplied.pageSize"
        :has-active-filters="hasActiveFilters"
        :filtered-empty-text="t('tenantList.emptyFiltered')"
        column-config-id="tenants"
        :column-defs="columnDefs"
        @update:page="onPage"
        @update:page-size="onPageSize"
      >
        <template #query>
          <ListPageQueryBar
            :filter-busy="filterBusy"
            :show-refresh="false"
            @search="onSearch"
            @reset="onReset"
          >
            <el-form-item :label="t('tenantList.keywordLabelProto')">
              <el-input
                class="query-w-220"
                v-model="queryDraft.keyword"
                clearable
                placeholder="搜索"
                @keyup.enter="onSearch"
              />
            </el-form-item>
            <el-form-item :label="t('tenantList.statusLabel')">
              <MetaSelect
                class="query-w-140"
                v-model="queryDraft.status"
                clearable
                enum-key="tenantStatus"
                :placeholder="t('tenantList.statusPlaceholderProto')"
                :options="tenantStatusOptions"
              />
            </el-form-item>
          </ListPageQueryBar>
        </template>

        <!-- 引导式空状态:仅"无筛选 + 零数据"时显示 CTA(ProTable 已按 hasActiveFilters 门禁) -->
        <template #empty>
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

        <!--
          列结构照设计 proto-nav-租户实例.html:勾选 → TENANT(mono 主色,点击即切换)→ 名称 →
          状态 pill → 操作(右对齐)。作业数/Worker/分片 三列 BE 未暴露统计,不编造;
          描述/创建人/创建时间 为实现侧多出的列,收进列设置且默认隐藏。
        -->
        <template #default="{ isColVisible }">
          <el-table-column type="selection" width="38" />
          <!-- i18n-todo: tenantList.colTenantProto = 'TENANT' -->
          <el-table-column prop="tenantId" label="TENANT" width="140" show-overflow-tooltip>
            <template #default="{ row }">
              <span
                class="tl-code"
                :class="{ 'is-current': row.tenantId === tenant.tenantId }"
                @click="switchToTenant(row)"
              >
                {{ row.tenantId }}
              </span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColVisible('tenantName')"
            prop="tenantName"
            :label="t('tenantList.colName')"
            min-width="180"
            show-overflow-tooltip
          />
          <el-table-column
            v-if="isColVisible('description')"
            prop="description"
            :label="t('tenantList.colDescription')"
            min-width="240"
            show-overflow-tooltip
          />
          <el-table-column
            v-if="isColVisible('createdBy')"
            prop="createdBy"
            :label="t('tenantList.colCreatedBy')"
            width="120"
            show-overflow-tooltip
          />
          <DatetimeColumn
            v-if="isColVisible('createdAt')"
            prop="createdAt"
            :label="t('tenantList.colCreatedAt')"
            width="180"
          />
          <el-table-column :label="t('tenantList.statusLabel')" width="100">
            <template #default="{ row }">
              <StatusTag :value="String(row.status ?? '')" category="tenant" />
            </template>
          </el-table-column>
          <el-table-column :label="t('tenantList.colActions')" width="200" align="right">
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
                <!-- 设计操作列:1 个外露文字操作 + ⋯ 收纳其余(proto: 配置 + ⋯) -->
                <RowActions :actions="rowActions(row)" :inline-limit="1" />
              </div>
            </template>
          </el-table-column>
        </template>
      </ProTable>
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
  import { Plus } from 'lucide-vue-next'

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
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import { canManageTenants as hasTenantAdminAccess } from '@/utils/tenantAccess'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import RowActions, { type RowAction } from '@/components/common/RowActions.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'
  import { showCreateSuccess } from '@/composables/useCreateSuccess'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
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
  const { filterBusy, runSearch, runReset } = useListFilterFeedback(listRemote)

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

  const canManageTenants = computed(() => hasTenantAdminAccess(auth.userInfo?.permissions ?? []))

  // 列设置(proto 头部「☰ 列」):TENANT/状态为必选;proto 未展示的列默认隐藏,可按需开
  const columnDefs = computed(() => [
    // i18n-todo: tenantList.colTenantProto = 'TENANT'
    { key: 'tenantId', label: 'TENANT', hideable: false },
    { key: 'tenantName', label: t('tenantList.colName') },
    { key: 'description', label: t('tenantList.colDescription'), defaultHidden: true },
    { key: 'createdBy', label: t('tenantList.colCreatedBy'), defaultHidden: true },
    { key: 'createdAt', label: t('tenantList.colCreatedAt'), defaultHidden: true },
    { key: 'status', label: t('tenantList.statusLabel'), hideable: false },
  ])

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
        disabled: !isActive,
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
      if (isActive || row.status === 'SUSPENDING') {
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

  /* TENANT 列:mono 主色可点(dump: 12px / accent / IBM Plex Mono / pointer);当前租户不可再切 */
  .tl-code {
    font-size: 12px;
    color: var(--color-primary);
    font-family: var(--font-mono);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
  }

  .tl-code:hover {
    text-decoration: underline;
  }

  .tl-code.is-current {
    cursor: default;
    text-decoration: none;
  }

  /* proto 操作列右对齐:配置 + ⋯ 靠右 */
  .tenant-row-actions {
    justify-content: flex-end;
    flex-wrap: nowrap;
    gap: 6px;
  }

  .tenant-row-actions :deep(.row-actions) {
    flex-wrap: nowrap;
  }
</style>
