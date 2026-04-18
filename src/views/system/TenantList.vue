<template>
  <PageContainer>
    <PageHeader
      title="租户管理"
      description="维护平台级租户目录：创建、编辑、暂停 / 恢复租户，并可一键将当前控制台上下文切换到目标租户。"
      :show-description="true"
    >
      <template #actions>
        <el-button v-if="canManageTenants" type="primary" :icon="Plus" @click="openCreate"
          >新建租户</el-button
        >
        <el-button v-if="canManageTenants" type="primary" plain @click="openBatchCreate"
          >批量新建</el-button
        >
        <el-button v-if="canManageTenants" plain @click="openCopyConfig">复制配置</el-button>
        <el-button :loading="loading" @click="load">刷新</el-button>
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
            v-model="queryDraft.keyword"
            clearable
            placeholder="tenantId / tenantName"
            style="width: 220px"
            @keyup.enter="onSearch"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="queryDraft.status" clearable placeholder="全部" style="width: 140px">
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

    <!-- 新建 / 编辑对话框 -->
    <el-dialog
      v-model="formVisible"
      :title="form.editing ? `编辑租户：${form.tenantId}` : '新建租户'"
      width="520px"
    >
      <el-form label-width="100px">
        <el-form-item label="tenantId" required>
          <el-input
            v-model="form.tenantId"
            :disabled="form.editing"
            placeholder="例如：acme-prod"
          />
          <div class="form-hint">小写字母、数字、短横线；长度 2–64；首尾需为字母或数字。</div>
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="form.tenantName" placeholder="租户显示名称" maxlength="256" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="form.description"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 4 }"
            placeholder="可选"
            maxlength="512"
            show-word-limit
          />
        </el-form-item>
        <template v-if="!form.editing">
          <el-form-item label="操作账号" required>
            <el-input
              v-model="form.username"
              placeholder="初始操作账号用户名（ROLE_TENANT_USER）"
              maxlength="128"
            />
            <div class="form-hint">字母、数字、._- ，至少 2 个字符。</div>
          </el-form-item>
          <el-form-item label="初始密码" required>
            <el-input
              v-model="form.password"
              type="password"
              show-password
              placeholder="至少 8 个字符"
              maxlength="256"
            />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm">
          {{ form.editing ? '保存' : '创建' }}
        </el-button>
      </template>
    </el-dialog>
    <!-- 批量新建对话框 -->
    <el-dialog v-model="batchFormVisible" title="批量新建租户" width="620px">
      <el-form label-width="100px">
        <el-form-item label="租户列表" required>
          <el-input
            v-model="batchForm.tenantsText"
            type="textarea"
            :autosize="{ minRows: 4, maxRows: 10 }"
            placeholder="每行一个：tenantId,tenantName[,description]"
          />
          <div class="form-hint">每行格式：tenantId,名称[,描述]。最多 50 个。</div>
        </el-form-item>
        <el-form-item label="用户名前缀">
          <el-input
            v-model="batchForm.usernamePrefix"
            placeholder="默认 op-，最终用户名为 {前缀}{tenantId}"
            maxlength="32"
          />
        </el-form-item>
        <el-form-item label="共享密码" required>
          <el-input
            v-model="batchForm.password"
            type="password"
            show-password
            placeholder="所有租户共享的初始密码，至少 12 个字符"
            maxlength="256"
          />
        </el-form-item>
        <el-divider content-position="left">配置初始化（可选）</el-divider>
        <el-form-item label="源租户">
          <el-select
            v-model="batchForm.initConfigFrom"
            clearable
            filterable
            placeholder="留空则跳过配置初始化"
            style="width: 280px"
          >
            <el-option
              v-for="t in page.items"
              :key="t.tenantId"
              :label="`${t.tenantId} — ${t.tenantName}`"
              :value="t.tenantId"
            />
          </el-select>
          <div class="form-hint">选择后，新建租户将自动复制源租户的全部 10 类配置。</div>
        </el-form-item>
        <el-form-item v-if="batchForm.initConfigFrom" label="初始化模式">
          <el-radio-group v-model="batchForm.initMode">
            <el-radio value="SKIP_EXISTING">SKIP_EXISTING</el-radio>
            <el-radio value="UPSERT">UPSERT</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="batchFormVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingBatch" @click="submitBatch">批量创建</el-button>
      </template>
    </el-dialog>
    <!-- 初始化配置对话框 -->
    <el-dialog v-model="initFormVisible" title="初始化租户配置" width="640px">
      <el-alert type="info" :closable="false" show-icon class="mb-12">
        <template #title>
          将 JSON Spec 写入目标租户，覆盖全部 10 个配置域。SKIP_EXISTING 仅创建缺失项，UPSERT
          会覆盖已有项。
        </template>
      </el-alert>
      <el-form label-width="100px">
        <el-form-item label="目标租户">
          <el-tag>{{ initForm.targetTenantId }}</el-tag>
        </el-form-item>
        <el-form-item label="配置类型">
          <el-checkbox-group v-model="initForm.configTypes">
            <el-checkbox v-for="ct in allConfigTypes" :key="ct" :label="ct" :value="ct" />
          </el-checkbox-group>
          <div class="form-hint">留空表示全部 10 个类型</div>
        </el-form-item>
        <el-form-item label="写入模式">
          <el-radio-group v-model="initForm.mode">
            <el-radio value="SKIP_EXISTING">SKIP_EXISTING</el-radio>
            <el-radio value="UPSERT">UPSERT</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="Spec JSON" required>
          <el-input
            v-model="initForm.specJson"
            type="textarea"
            :autosize="{ minRows: 8, maxRows: 20 }"
            placeholder='完整的配置 JSON，例如 {"jobDefinitions":[...],"workflowDefinitions":[...]}'
            style="font-family: var(--font-family-mono, monospace); font-size: 12px"
          />
        </el-form-item>
        <el-form-item label="试运行">
          <el-switch v-model="initForm.dryRun" />
          <span class="form-hint" style="margin-left: 8px">开启后仅校验，不实际写入</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="initFormVisible = false">取消</el-button>
        <el-button type="primary" :loading="initSaving" @click="submitInit">
          {{ initForm.dryRun ? '试运行' : '执行初始化' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 复制配置对话框 -->
    <el-dialog v-model="copyFormVisible" title="跨租户复制配置" width="640px">
      <el-alert type="info" :closable="false" show-icon class="mb-12">
        <template #title> 从源租户读取配置，自动写入目标租户，无需手写 Spec。 </template>
      </el-alert>
      <el-form label-width="100px">
        <el-form-item label="源租户" required>
          <el-select
            v-model="copyForm.sourceTenantId"
            filterable
            placeholder="选择源租户"
            style="width: 280px"
          >
            <el-option
              v-for="t in page.items"
              :key="t.tenantId"
              :label="`${t.tenantId} — ${t.tenantName}`"
              :value="t.tenantId"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="目标租户" required>
          <el-select
            v-model="copyForm.targetTenantIds"
            multiple
            filterable
            placeholder="选择一个或多个目标租户"
            style="width: 100%"
          >
            <el-option
              v-for="t in page.items.filter((x) => x.tenantId !== copyForm.sourceTenantId)"
              :key="t.tenantId"
              :label="`${t.tenantId} — ${t.tenantName}`"
              :value="t.tenantId"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="配置类型">
          <el-checkbox-group v-model="copyForm.configTypes">
            <el-checkbox v-for="ct in allConfigTypes" :key="ct" :label="ct" :value="ct" />
          </el-checkbox-group>
          <div class="form-hint">留空表示全部 10 个类型</div>
        </el-form-item>
        <el-form-item label="写入模式">
          <el-radio-group v-model="copyForm.mode">
            <el-radio value="SKIP_EXISTING">SKIP_EXISTING</el-radio>
            <el-radio value="UPSERT">UPSERT</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="试运行">
          <el-switch v-model="copyForm.dryRun" />
          <span class="form-hint" style="margin-left: 8px">开启后仅预览差异，不实际写入</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="copyFormVisible = false">取消</el-button>
        <el-button type="primary" :loading="copySaving" @click="submitCopy">
          {{ copyForm.dryRun ? '试运行' : '执行复制' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 初始化 / 复制结果 -->
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
    createTenant,
    batchCreateTenants,
    updateTenant,
    suspendTenant,
    activateTenant,
    type Tenant,
    type TenantListQuery,
    type TenantPage,
    type TenantStatus,
  } from '@/api/tenants'
  import { batchInitTenantConfig, copyTenantConfig, type ConfigType } from '@/api/ops'
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

  const auth = useAuthStore()
  const tenant = useTenantStore()
  const loading = ref(false)
  const saving = ref(false)
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

  // --- 表单 ---
  interface TenantForm {
    editing: boolean
    tenantId: string
    tenantName: string
    description: string
    username: string
    password: string
  }
  const formVisible = ref(false)
  const form = reactive<TenantForm>({
    editing: false,
    tenantId: '',
    tenantName: '',
    description: '',
    username: '',
    password: '',
  })

  function openCreate() {
    if (!canManageTenants.value) return
    form.editing = false
    form.tenantId = ''
    form.tenantName = ''
    form.description = ''
    form.username = ''
    form.password = ''
    formVisible.value = true
  }

  function openEdit(row: Tenant) {
    if (!canManageTenants.value) return
    form.editing = true
    form.tenantId = row.tenantId
    form.tenantName = row.tenantName
    form.description = row.description ?? ''
    formVisible.value = true
  }

  async function submitForm() {
    if (!canManageTenants.value) return
    if (!form.editing) {
      if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(form.tenantId)) {
        ElMessage.warning('tenantId 格式非法：小写字母 / 数字 / 短横线，长度 2–64')
        return
      }
      if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(form.username) || form.username.length < 2) {
        ElMessage.warning('操作账号用户名格式非法：字母 / 数字 / ._- ，至少 2 个字符')
        return
      }
      if (form.password.length < 8) {
        ElMessage.warning('初始密码至少 8 个字符')
        return
      }
    }
    if (!form.tenantName.trim()) {
      ElMessage.warning('名称不能为空')
      return
    }
    saving.value = true
    try {
      if (form.editing) {
        await updateTenant(form.tenantId, {
          tenantName: form.tenantName.trim(),
          description: form.description || undefined,
        })
        ElMessage.success('已更新')
      } else {
        await createTenant({
          tenantId: form.tenantId.trim(),
          tenantName: form.tenantName.trim(),
          description: form.description || undefined,
          username: form.username.trim(),
          password: form.password,
        })
        ElMessage.success('已创建')
      }
      formVisible.value = false
      await load()
    } finally {
      saving.value = false
    }
  }

  // --- 暂停 / 恢复 ---
  async function confirmSuspend(row: Tenant) {
    if (!canManageTenants.value) return
    try {
      await ElMessageBox.confirm(
        `暂停租户 ${row.tenantId} 后，相关配置与调度将受影响，确认继续？`,
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
      await ElMessageBox.confirm(`恢复租户 ${row.tenantId}？`, '恢复租户', { type: 'info' })
      await activateTenant(row.tenantId)
      ElMessage.success('已恢复')
      await load()
    } catch {
      /* cancel */
    }
  }

  // --- 切换当前控制台上下文 ---
  function switchToTenant(row: Tenant) {
    if (row.tenantId === tenant.tenantId) return
    tenant.setTenantId(row.tenantId)
    ElMessage.success(`当前租户已切换为 ${row.tenantId}`)
  }

  // --- 批量新建 ---
  const batchFormVisible = ref(false)
  const savingBatch = ref(false)
  const batchForm = reactive({
    tenantsText: '',
    usernamePrefix: 'op-',
    password: '',
    initConfigFrom: '',
    initMode: 'SKIP_EXISTING' as 'SKIP_EXISTING' | 'UPSERT',
  })

  function openBatchCreate() {
    if (!canManageTenants.value) return
    batchForm.tenantsText = ''
    batchForm.usernamePrefix = 'op-'
    batchForm.password = ''
    batchForm.initConfigFrom = ''
    batchForm.initMode = 'SKIP_EXISTING'
    batchFormVisible.value = true
  }

  function parseBatchTenants(text: string) {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [tenantId = '', tenantName = '', description] = line.split(',').map((s) => s.trim())
        return { tenantId, tenantName, description: description || undefined }
      })
  }

  async function submitBatch() {
    if (!canManageTenants.value) return
    const tenants = parseBatchTenants(batchForm.tenantsText)
    if (tenants.length === 0) {
      ElMessage.warning('请至少填写一个租户')
      return
    }
    if (tenants.length > 50) {
      ElMessage.warning('单次最多 50 个租户')
      return
    }
    for (const t of tenants) {
      if (!t.tenantId || !t.tenantName) {
        ElMessage.warning(`每行至少包含 tenantId 和名称：${t.tenantId || '(空)'}`)
        return
      }
    }
    if (batchForm.password.length < 12) {
      ElMessage.warning('共享密码至少 12 个字符')
      return
    }
    savingBatch.value = true
    try {
      const res = await batchCreateTenants({
        tenants,
        usernamePrefix: batchForm.usernamePrefix || undefined,
        password: batchForm.password,
        initConfigFrom: batchForm.initConfigFrom || undefined,
        initMode: batchForm.initConfigFrom ? batchForm.initMode : undefined,
      })
      batchFormVisible.value = false
      if (res.configInit) {
        const ci = res.configInit
        ElMessage.success(
          `已创建 ${tenants.length} 个租户，配置初始化：${ci.successTenants} 成功 / ${ci.failureTenants} 失败`,
        )
        showResult(res.configInit)
      } else {
        ElMessage.success(`已批量创建 ${tenants.length} 个租户`)
      }
      await load()
    } finally {
      savingBatch.value = false
    }
  }

  // --- 初始化配置 ---
  const allConfigTypes: ConfigType[] = [
    'JOB_DEFINITION',
    'WORKFLOW_DEFINITION',
    'PIPELINE_DEFINITION',
    'FILE_CHANNEL',
    'FILE_TEMPLATE',
    'RESOURCE_QUEUE',
    'BATCH_WINDOW',
    'BUSINESS_CALENDAR',
    'QUOTA_POLICY',
    'ALERT_ROUTING',
  ]
  const initFormVisible = ref(false)
  const initSaving = ref(false)
  const initForm = reactive({
    targetTenantId: '',
    configTypes: [] as ConfigType[],
    mode: 'SKIP_EXISTING' as 'SKIP_EXISTING' | 'UPSERT',
    specJson: '',
    dryRun: true,
  })

  function openInitConfig(row: Tenant) {
    if (!canManageTenants.value) return
    initForm.targetTenantId = row.tenantId
    initForm.configTypes = []
    initForm.mode = 'SKIP_EXISTING'
    initForm.specJson = ''
    initForm.dryRun = true
    initFormVisible.value = true
  }

  async function submitInit() {
    if (!canManageTenants.value) return
    if (!initForm.specJson.trim()) {
      ElMessage.warning('Spec JSON 不能为空')
      return
    }
    let spec: Record<string, unknown>
    try {
      spec = JSON.parse(initForm.specJson)
    } catch {
      ElMessage.error('JSON 格式不合法')
      return
    }
    initSaving.value = true
    try {
      const res = await batchInitTenantConfig({
        targetTenantIds: [initForm.targetTenantId],
        spec,
        configTypes: initForm.configTypes.length ? initForm.configTypes : undefined,
        mode: initForm.mode,
        dryRun: initForm.dryRun,
      })
      showResult(res)
      if (!initForm.dryRun) {
        ElMessage.success('初始化完成')
        initFormVisible.value = false
      }
    } finally {
      initSaving.value = false
    }
  }

  // --- 复制配置 ---
  const copyFormVisible = ref(false)
  const copySaving = ref(false)
  const copyForm = reactive({
    sourceTenantId: '',
    targetTenantIds: [] as string[],
    configTypes: [] as ConfigType[],
    mode: 'SKIP_EXISTING' as 'SKIP_EXISTING' | 'UPSERT',
    dryRun: true,
  })

  function openCopyConfig() {
    if (!canManageTenants.value) return
    copyForm.sourceTenantId = ''
    copyForm.targetTenantIds = []
    copyForm.configTypes = []
    copyForm.mode = 'SKIP_EXISTING'
    copyForm.dryRun = true
    copyFormVisible.value = true
  }

  async function submitCopy() {
    if (!canManageTenants.value) return
    if (!copyForm.sourceTenantId) {
      ElMessage.warning('请选择源租户')
      return
    }
    if (copyForm.targetTenantIds.length === 0) {
      ElMessage.warning('请选择至少一个目标租户')
      return
    }
    copySaving.value = true
    try {
      const res = await copyTenantConfig({
        sourceTenantId: copyForm.sourceTenantId,
        targetTenantIds: copyForm.targetTenantIds,
        configTypes: copyForm.configTypes.length ? copyForm.configTypes : undefined,
        mode: copyForm.mode,
        dryRun: copyForm.dryRun,
      })
      showResult(res)
      if (!copyForm.dryRun) {
        ElMessage.success('复制完成')
        copyFormVisible.value = false
      }
    } finally {
      copySaving.value = false
    }
  }

  // --- 结果展示 ---
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

  .form-hint {
    margin-top: 4px;
    font-size: 12px;
    color: var(--color-text-tertiary, #909399);
  }

  .mb-12 {
    margin-bottom: 12px;
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
