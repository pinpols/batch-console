<template>
  <PageContainer>
    <PageHeader> </PageHeader>

    <div class="metrics">
      <MetricCard label="账户总数" :value="page.total" />
      <MetricCard label="已启用" :value="enabledCount" />
      <MetricCard label="已停用" :value="disabledCount" />
    </div>

    <SectionCard>
      <template #header>
        <span>账户列表</span>
      </template>

      <ListPageQueryBar
        :filter-busy="filterBusy"
        :refresh-busy="loading"
        @search="onSearch"
        @reset="onReset"
        @refresh="() => runRefresh(load)"
      >
        <el-form-item label="关键字">
          <el-input
            class="query-w-220"
            v-model="queryDraft.keyword"
            clearable
            placeholder="username / displayName"
            @keyup.enter="onSearch"
          />
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
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="tenantId" label="tenantId" min-width="160" />
        <el-table-column prop="username" label="用户名" min-width="160" show-overflow-tooltip />
        <el-table-column prop="displayName" label="显示名" min-width="160" show-overflow-tooltip />
        <el-table-column label="角色">
          <template #default="{ row }">
            <div class="role-tags">
              <el-tag
                v-for="role in parseRoles(row.authoritiesCsv)"
                :key="role"
                size="small"
                effect="plain"
              >
                {{ role }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <StatusTag :value="String(row.enabled)" category="yn" />
          </template>
        </el-table-column>
        <DatetimeColumn prop="createdAt" label="创建时间" width="160" />
        <el-table-column label="操作" width="360" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" plain type="primary" @click="openEdit(row)">编辑</el-button>
              <el-button size="small" plain @click="openResetPassword(row)">重置密码</el-button>
              <el-button
                v-if="row.enabled"
                size="small"
                plain
                type="warning"
                @click="confirmDisable(row)"
                >停用</el-button
              >
              <el-button v-else size="small" plain type="success" @click="confirmEnable(row)"
                >启用</el-button
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

    <!-- 编辑 -->
    <el-dialog v-model="formVisible" :title="`编辑账户：${form.username}`" width="560px">
      <el-form label-width="100px">
        <el-form-item label="tenantId">
          <TenantSelect
            v-model="form.tenantId"
            :disabled="true"
            placeholder="归属租户"
            select-class="query-w-full"
          />
        </el-form-item>
        <el-form-item label="用户名">
          <el-input v-model="form.username" :disabled="true" maxlength="128" />
        </el-form-item>
        <el-form-item label="显示名">
          <el-input v-model="form.displayName" placeholder="可选" maxlength="256" />
        </el-form-item>
        <el-form-item label="authoritiesCsv">
          <el-input
            v-model="form.authoritiesCsv"
            placeholder="ROLE_CONFIG_ADMIN,ROLE_AUDITOR（留空默认 ROLE_USER）"
            maxlength="512"
          />
          <div class="form-hint">角色以半角逗号分隔，例如 ROLE_ADMIN、ROLE_AUDITOR。</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>

    <!-- 重置密码 -->
    <el-dialog
      v-model="resetVisible"
      :title="resetTarget ? `重置密码：${resetTarget.username}` : '重置密码'"
      width="440px"
    >
      <el-form label-width="100px">
        <el-form-item label="新密码" required>
          <el-input
            v-model="newPassword"
            type="password"
            show-password
            placeholder="至少 8 个字符"
            maxlength="256"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resetVisible = false">取消</el-button>
        <el-button type="primary" :loading="resetting" @click="submitReset">确认重置</el-button>
      </template>
    </el-dialog>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, onMounted, reactive, ref } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    listUsers,
    updateUser,
    enableUser,
    disableUser,
    resetUserPassword,
    type UserAccount,
    type UserListQuery,
    type UserPage,
  } from '@/api/userAccounts'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import MetricCard from '@/components/common/MetricCard.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import TablePagerBar from '@/components/table/TablePagerBar.vue'
  import TenantSelect from '@/components/common/TenantSelect.vue'
  import StatusTag from '@/components/common/StatusTag.vue'

  const loading = ref(false)
  const saving = ref(false)
  const resetting = ref(false)
  const listRemote = ref(true)
  const { filterBusy, runSearch, runReset, runRefresh } = useListFilterFeedback(listRemote)

  const queryDraft = reactive({ tenantId: '', keyword: '' })
  const queryApplied = reactive({
    tenantId: '',
    keyword: '',
    pageNo: 1,
    pageSize: 20,
  })
  const page = ref<UserPage>({ total: 0, pageNo: 1, pageSize: 20, items: [] })

  const enabledCount = computed(() => page.value.items.filter((u) => u.enabled).length)
  const disabledCount = computed(() => page.value.items.filter((u) => !u.enabled).length)

  function parseRoles(csv?: string): string[] {
    if (!csv) return []
    return csv
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean)
  }

  async function load() {
    loading.value = true
    try {
      const q: UserListQuery = {
        pageNo: queryApplied.pageNo,
        pageSize: queryApplied.pageSize,
      }
      if (queryApplied.tenantId) q.tenantId = queryApplied.tenantId
      if (queryApplied.keyword) q.keyword = queryApplied.keyword
      page.value = await listUsers(q)
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
      queryApplied.tenantId = queryDraft.tenantId.trim()
      queryApplied.keyword = queryDraft.keyword.trim()
      queryApplied.pageNo = 1
      await load()
    })
  }

  function onReset() {
    return runReset(async () => {
      queryDraft.tenantId = ''
      queryDraft.keyword = ''
      queryApplied.tenantId = ''
      queryApplied.keyword = ''
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
  interface UserForm {
    id: number | null
    tenantId: string
    username: string
    displayName: string
    authoritiesCsv: string
  }
  const formVisible = ref(false)
  const form = reactive<UserForm>({
    id: null,
    tenantId: '',
    username: '',
    displayName: '',
    authoritiesCsv: '',
  })

  function openEdit(row: UserAccount) {
    form.id = row.id
    form.tenantId = row.tenantId
    form.username = row.username
    form.displayName = row.displayName ?? ''
    form.authoritiesCsv = row.authoritiesCsv ?? ''
    formVisible.value = true
  }

  async function submitForm() {
    if (form.id == null) return
    saving.value = true
    try {
      await updateUser(form.id, {
        displayName: form.displayName || undefined,
        authoritiesCsv: form.authoritiesCsv || undefined,
      })
      ElMessage.success('已更新')
      formVisible.value = false
      await load()
    } finally {
      saving.value = false
    }
  }

  // --- 重置密码 ---
  const resetVisible = ref(false)
  const resetTarget = ref<UserAccount | null>(null)
  const newPassword = ref('')

  function openResetPassword(row: UserAccount) {
    resetTarget.value = row
    newPassword.value = ''
    resetVisible.value = true
  }

  async function submitReset() {
    if (!resetTarget.value) return
    if (newPassword.value.length < 8) {
      ElMessage.warning('密码至少 8 个字符')
      return
    }
    resetting.value = true
    try {
      await resetUserPassword(resetTarget.value.id, { newPassword: newPassword.value })
      ElMessage.success('密码已重置')
      resetVisible.value = false
    } finally {
      resetting.value = false
    }
  }

  // --- 启停 / 删除 ---
  async function confirmEnable(row: UserAccount) {
    try {
      await ElMessageBox.confirm(`启用账户 ${row.username}？`, '启用账户', { type: 'info' })
      await enableUser(row.id)
      ElMessage.success('已启用')
      await load()
    } catch {
      /* cancel */
    }
  }

  async function confirmDisable(row: UserAccount) {
    try {
      await ElMessageBox.confirm(
        `停用账户 ${row.username} 后该用户将无法登录，继续？`,
        '停用账户',
        {
          type: 'warning',
        },
      )
      await disableUser(row.id)
      ElMessage.success('已停用')
      await load()
    } catch {
      /* cancel */
    }
  }

  onMounted(load)
</script>

<style scoped>
  .metrics {
    display: grid;
    gap: var(--space-md);
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }

  .role-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .form-hint {
    margin-top: 4px;
    font-size: 12px;
    color: var(--color-text-tertiary, #909399);
  }
</style>
