<template>
  <PageContainer>
    <PageHeader
      title="租户管理"
      description="维护平台级租户目录:创建、编辑、暂停 / 恢复租户,并可一键将当前控制台上下文切换到目标租户。"
      :show-description="true"
    >
      <template #actions>
        <el-button
          v-if="canManageTenants"
          type="primary"
          :icon="Plus"
          class="pretty-add-button"
          @click="openCreate"
        >
          新增租户
        </el-button>
        <el-button v-if="canManageTenants" type="primary" plain @click="batchVisible = true"
          >批量新增</el-button
        >
        <el-button v-if="canManageTenants" plain @click="copyVisible = true">复制配置</el-button>
      </template>
    </PageHeader>

    <div class="metrics">
      <MetricCard label="租户总数" :value="page.total" />
      <MetricCard label="启用中" :value="activeCount" />
      <MetricCard label="已暂停" :value="suspendedCount" />
      <MetricCard label="当前上下文" :value="tenant.tenantId" />
    </div>

    <SectionCard>
      <template #header>
        <span>租户列表</span>
      </template>

      <ListPageQueryBar
        :filter-busy="filterBusy"
        :refresh-busy="loading"
        @search="onSearch"
        @reset="onReset"
        @refresh="load"
      >
        <el-form-item label="关键字">
          <el-input
            class="query-w-220"
            v-model="queryDraft.keyword"
            clearable
            placeholder="tenantId / tenantName"
            @keyup.enter="onSearch"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select class="query-w-140" v-model="queryDraft.status" clearable placeholder="全部">
            <el-option
              v-for="opt in tenantStatusOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
      </ListPageQueryBar>

      <el-table
        v-loading="loading"
        :data="page.items"
        stripe
        border
        empty-text="暂无数据"
        class="console-table"
      >
        <el-table-column prop="tenantId" label="tenantId" min-width="180" />
        <el-table-column prop="tenantName" label="名称" min-width="160" show-overflow-tooltip />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <StatusTag :value="String(row.status ?? '')" category="tenant" />
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="220" show-overflow-tooltip />
        <el-table-column prop="createdBy" label="创建人" width="140" show-overflow-tooltip />
        <DatetimeColumn prop="createdAt" label="创建时间" width="160" />
        <el-table-column label="操作" width="400" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button
                v-if="canManageTenants"
                size="small"
                plain
                type="primary"
                @click="openEdit(row)"
                >编辑</el-button
              >
              <el-button
                v-if="canManageTenants && row.status === 'ACTIVE'"
                size="small"
                plain
                type="warning"
                @click="confirmSuspend(row)"
                >暂停</el-button
              >
              <el-button
                v-else-if="canManageTenants"
                size="small"
                plain
                type="success"
                @click="confirmActivate(row)"
                >恢复</el-button
              >
              <el-button v-if="canManageTenants" size="small" plain @click="openInitConfig(row)"
                >初始化</el-button
              >
              <el-button
                size="small"
                plain
                :type="row.tenantId === tenant.tenantId ? 'info' : 'primary'"
                :disabled="row.tenantId === tenant.tenantId"
                @click="switchToTenant(row)"
                >{{ row.tenantId === tenant.tenantId ? '当前' : '设为当前' }}</el-button
              >
            </div>
          </template>
        </el-table-column>
      </el-table>

      <TablePagerBar
        :page="queryApplied.pageNo"
        :page-size="queryApplied.pageSize"
        :total="page.total"
        @update:page="onPage"
        @update:page-size="onPageSize"
      />
    </SectionCard>

    <TenantFormDialog v-model="formVisible" :initial="formInitial" @saved="load" />
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

    <el-dialog v-model="resultVisible" title="执行结果" width="640px">
      <pre class="result-json">{{ resultJson }}</pre>
      <template #footer>
        <el-button type="primary" @click="resultVisible = false">确定</el-button>
      </template>
    </el-dialog>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, onMounted, reactive, ref } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Plus } from '@element-plus/icons-vue'
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
  import { canManageTenants as hasTenantAdminAccess } from '@/utils/tenantAccess'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import MetricCard from '@/components/common/MetricCard.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
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
  const loading = ref(false)
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
    pageSize: 20,
  })

  const page = ref<TenantPage>({ total: 0, pageNo: 1, pageSize: 20, items: [] })

  const { data: metaEnums } = useConsoleMetaEnumsQuery()
  const tenantStatusOptions = computed(() => pickMetaEnumGroup(metaEnums.value, 'tenantStatus'))

  const activeCount = computed(
    () => page.value.items.filter((item) => item.status === 'ACTIVE').length,
  )
  const suspendedCount = computed(
    () => page.value.items.filter((item) => item.status === 'SUSPENDED').length,
  )
  const canManageTenants = computed(() => hasTenantAdminAccess(auth.userInfo?.permissions ?? []))

  async function load() {
    loading.value = true
    try {
      const q: TenantListQuery = {
        pageNo: queryApplied.pageNo,
        pageSize: queryApplied.pageSize,
      }
      if (queryApplied.keyword) q.keyword = queryApplied.keyword
      if (queryApplied.status) q.status = queryApplied.status
      const resp = await listTenants(q)
      page.value = resp
    } catch {
      page.value = {
        total: 0,
        pageNo: queryApplied.pageNo,
        pageSize: queryApplied.pageSize,
        items: [],
      }
    } finally {
      loading.value = false
    }
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

  // ── 批量 / 复制 / 初始化 ─────────────────────────────
  const batchVisible = ref(false)
  const copyVisible = ref(false)
  const initVisible = ref(false)
  const initTargetTenantId = ref('')

  function openInitConfig(row: Tenant) {
    if (!canManageTenants.value) return
    initTargetTenantId.value = row.tenantId
    initVisible.value = true
  }

  // ── 暂停 / 恢复 ───────────────────────────────────────
  async function confirmSuspend(row: Tenant) {
    if (!canManageTenants.value) return
    try {
      await ElMessageBox.confirm(
        `暂停租户 ${row.tenantId} 后,相关配置与调度将受影响,确认继续?`,
        '暂停租户',
        { type: 'warning' },
      )
      await suspendTenant(row.tenantId)
      ElMessage.success('已暂停')
      await load()
    } catch {
      /* cancel */
    }
  }

  async function confirmActivate(row: Tenant) {
    if (!canManageTenants.value) return
    try {
      await ElMessageBox.confirm(`恢复租户 ${row.tenantId}?`, '恢复租户', { type: 'info' })
      await activateTenant(row.tenantId)
      ElMessage.success('已恢复')
      await load()
    } catch {
      /* cancel */
    }
  }

  function switchToTenant(row: Tenant) {
    if (row.tenantId === tenant.tenantId) return
    tenant.setTenantId(row.tenantId)
    ElMessage.success(`当前租户已切换为 ${row.tenantId}`)
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
</style>
