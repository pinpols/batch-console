<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button type="primary" :icon="Plus" class="pretty-add-button" @click="openCreate">
          {{ t('userAccountList.headerCreate') }}
        </el-button>
      </template>
    </PageHeader>

    <div class="metrics">
      <MetricCard :label="t('userAccountList.metricTotal')" :value="page.total" />
      <MetricCard :label="t('userAccountList.metricEnabled')" :value="enabledCount" />
      <MetricCard :label="t('userAccountList.metricDisabled')" :value="disabledCount" />
    </div>

    <SectionCard>
      <template #header>
        <span>{{ t('userAccountList.sectionTitle') }}</span>
      </template>

      <ListPageQueryBar
        :filter-busy="filterBusy"
        :refresh-busy="loading"
        @search="onSearch"
        @reset="onReset"
        @refresh="() => runRefresh(load)"
      >
        <el-form-item :label="t('userAccountList.keywordLabel')">
          <el-input
            class="query-w-220"
            v-model="queryDraft.keyword"
            clearable
            :placeholder="t('userAccountList.keywordPlaceholder')"
            @keyup.enter="onSearch"
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
          :empty-text="t('common.noData')"
          class="console-table"
        >
          <el-table-column prop="id" :label="t('userAccountList.colId')" width="80" />
          <el-table-column
            prop="tenantId"
            :label="t('userAccountList.colTenantId')"
            min-width="160"
          />
          <el-table-column
            prop="username"
            :label="t('userAccountList.colUsername')"
            min-width="160"
            show-overflow-tooltip
          />
          <el-table-column
            prop="displayName"
            :label="t('userAccountList.colDisplayName')"
            min-width="160"
            show-overflow-tooltip
          />
          <el-table-column :label="t('userAccountList.colRoles')">
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
          <el-table-column :label="t('userAccountList.colStatus')" width="100">
            <template #default="{ row }">
              <StatusTag :value="String(row.enabled)" category="yn" />
            </template>
          </el-table-column>
          <DatetimeColumn prop="createdAt" :label="t('userAccountList.colCreatedAt')" width="160" />
          <el-table-column :label="t('userAccountList.colActions')" width="260" fixed="right">
            <template #default="{ row }">
              <div class="table-actions">
                <el-button size="small" plain type="primary" @click="openEdit(row)">
                  {{ t('userAccountList.actionEdit') }}
                </el-button>
                <el-button size="small" plain @click="openResetPassword(row)">
                  {{ t('userAccountList.actionResetPassword') }}
                </el-button>
                <el-button
                  v-if="row.enabled"
                  size="small"
                  plain
                  type="warning"
                  @click="confirmDisable(row)"
                >
                  {{ t('userAccountList.actionDisable') }}
                </el-button>
                <el-button v-else size="small" plain type="success" @click="confirmEnable(row)">
                  {{ t('userAccountList.actionEnable') }}
                </el-button>
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

    <el-drawer
      :append-to-body="true"
      v-model="createVisible"
      :title="t('userAccountList.createTitle')"
      direction="rtl"
      size="640px"
      :before-close="onCreateClose"
    >
      <el-form ref="createFormRef" :model="createForm" :rules="createFormRules" label-width="88px">
        <el-form-item :label="t('userAccountList.fieldTenant')" prop="tenantId">
          <TenantSelect
            v-model="createForm.tenantId"
            :placeholder="t('userAccountList.createTenantPlaceholder')"
            select-class="query-w-full"
          />
        </el-form-item>
        <el-form-item :label="t('userAccountList.fieldUsername')" prop="username">
          <el-input
            v-model="createForm.username"
            :placeholder="t('userAccountList.createUsernamePlaceholder')"
            maxlength="128"
          />
        </el-form-item>
        <el-form-item :label="t('userAccountList.fieldPassword')" prop="password">
          <el-input
            v-model="createForm.password"
            type="password"
            show-password
            :placeholder="t('userAccountList.fieldNewPasswordPlaceholder')"
            maxlength="256"
          />
        </el-form-item>
        <el-form-item :label="t('userAccountList.fieldDisplayName')">
          <el-input
            v-model="createForm.displayName"
            :placeholder="t('userAccountList.fieldDisplayNamePlaceholder')"
            maxlength="256"
          />
        </el-form-item>
        <el-form-item :label="t('userAccountList.fieldRoles')">
          <el-input
            v-model="createForm.authoritiesCsv"
            :placeholder="t('userAccountList.createRolesPlaceholder')"
            maxlength="512"
          />
          <div class="field-hint">{{ t('userAccountList.createRolesHint') }}</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="closeCreate">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="creating" @click="submitCreate">
          {{ t('userAccountList.createSubmit') }}
        </el-button>
      </template>
    </el-drawer>

    <el-drawer
      :append-to-body="true"
      v-model="formVisible"
      :title="t('userAccountList.editTitle', { name: form.username })"
      direction="rtl"
      size="640px"
    >
      <el-form label-width="88px">
        <el-form-item :label="t('userAccountList.fieldTenant')">
          <TenantSelect
            v-model="form.tenantId"
            :disabled="true"
            :placeholder="t('userAccountList.fieldTenantPlaceholder')"
            select-class="query-w-full"
          />
        </el-form-item>
        <el-form-item :label="t('userAccountList.fieldUsername')">
          <el-input v-model="form.username" :disabled="true" maxlength="128" />
        </el-form-item>
        <el-form-item :label="t('userAccountList.fieldDisplayName')">
          <el-input
            v-model="form.displayName"
            :placeholder="t('userAccountList.fieldDisplayNamePlaceholder')"
            maxlength="256"
          />
        </el-form-item>
        <el-form-item :label="t('userAccountList.fieldRoles')">
          <el-input
            v-model="form.authoritiesCsv"
            :placeholder="t('userAccountList.fieldRolesPlaceholder')"
            maxlength="512"
          />
          <div class="field-hint">{{ t('userAccountList.rolesHint') }}</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm">
          {{ t('common.save') }}
        </el-button>
      </template>
    </el-drawer>

    <el-dialog
      v-model="resetVisible"
      :title="
        resetTarget
          ? t('userAccountList.resetTitle', { name: resetTarget.username })
          : t('userAccountList.resetTitleDefault')
      "
      width="480px"
    >
      <el-form ref="resetFormRef" :model="resetForm" :rules="resetFormRules" label-width="88px">
        <el-form-item :label="t('userAccountList.fieldNewPassword')" prop="newPassword">
          <el-input
            v-model="resetForm.newPassword"
            type="password"
            show-password
            :placeholder="t('userAccountList.fieldNewPasswordPlaceholder')"
            maxlength="256"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resetVisible = false">{{ t('userAccountList.resetCancel') }}</el-button>
        <el-button type="primary" :loading="resetting" @click="submitReset">
          {{ t('userAccountList.resetSubmit') }}
        </el-button>
      </template>
    </el-dialog>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, onMounted, reactive, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Plus } from '@element-plus/icons-vue'

  const { t } = useI18n({ useScope: 'global' })
  import type { FormRules } from 'element-plus'
  import { useFormValidate, rules } from '@/composables/useFormValidate'
  import {
    listUsers,
    createUser,
    updateUser,
    enableUser,
    disableUser,
    resetUserPassword,
    type UserAccount,
    type UserListQuery,
    type UserPage,
  } from '@/api/userAccounts'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useListLoadState } from '@/composables/useListLoadState'
  import DataState from '@/components/common/DataState.vue'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import MetricCard from '@/components/common/MetricCard.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import TablePagerBar from '@/components/table/TablePagerBar.vue'
  import TenantSelect from '@/components/common/TenantSelect.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import { useTenantStore } from '@/stores/tenant'

  const { loading, error: loadError, run: runLoad } = useListLoadState()
  const tenant = useTenantStore()
  const creating = ref(false)
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
    await runLoad(async () => {
      const q: UserListQuery = {
        pageNo: queryApplied.pageNo,
        pageSize: queryApplied.pageSize,
      }
      if (queryApplied.tenantId) q.tenantId = queryApplied.tenantId
      if (queryApplied.keyword) q.keyword = queryApplied.keyword
      page.value = await listUsers(q)
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

  // --- 新增 ---
  const createVisible = ref(false)
  const createForm = reactive({
    tenantId: '',
    username: '',
    password: '',
    displayName: '',
    authoritiesCsv: '',
  })

  const {
    formRef: createFormRef,
    validate: validateCreateForm,
    clearValidate: clearCreateValidate,
  } = useFormValidate()
  const createFormRules: FormRules = {
    tenantId: [rules.required(t('userAccountList.tenantRequired'), 'change')],
    username: [
      rules.required(t('userAccountList.usernameRequired')),
      rules.pattern(/^[A-Za-z][A-Za-z0-9_.@-]{2,127}$/, t('userAccountList.usernamePattern')),
    ],
    password: [rules.required(t('userAccountList.passwordRequired')), rules.minLength(8)],
  }

  function resetCreateForm() {
    createForm.tenantId = tenant.tenantId
    createForm.username = ''
    createForm.password = ''
    createForm.displayName = ''
    createForm.authoritiesCsv = ''
    clearCreateValidate()
  }

  function openCreate() {
    resetCreateForm()
    createVisible.value = true
  }

  function closeCreate() {
    createVisible.value = false
    resetCreateForm()
  }

  function onCreateClose(done: () => void) {
    if (creating.value) return
    done()
    resetCreateForm()
  }

  async function submitCreate() {
    if (!(await validateCreateForm())) return
    creating.value = true
    const username = createForm.username.trim()
    const tenantId = createForm.tenantId
    try {
      await createUser({
        tenantId: tenantId || undefined,
        username,
        password: createForm.password,
        displayName: createForm.displayName.trim() || undefined,
        authoritiesCsv: createForm.authoritiesCsv.trim() || undefined,
      })
      ElMessage.success(t('userAccountList.createSuccess', { name: username }))
      createVisible.value = false
      resetCreateForm()
      queryDraft.keyword = username
      queryApplied.keyword = username
      queryApplied.tenantId = ''
      queryApplied.pageNo = 1
      await load()
    } finally {
      creating.value = false
    }
  }

  // --- 编辑 ---
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
      ElMessage.success(t('userAccountList.updateSuccess'))
      formVisible.value = false
      await load()
    } finally {
      saving.value = false
    }
  }

  // --- 重置密码 ---
  const resetVisible = ref(false)
  const resetTarget = ref<UserAccount | null>(null)
  const resetForm = reactive({ newPassword: '' })

  const { formRef: resetFormRef, validate: validateResetForm } = useFormValidate()
  const resetFormRules: FormRules = {
    newPassword: [rules.required(t('userAccountList.newPasswordRequired')), rules.minLength(8)],
  }

  function openResetPassword(row: UserAccount) {
    resetTarget.value = row
    resetForm.newPassword = ''
    resetVisible.value = true
  }

  async function submitReset() {
    if (!resetTarget.value) return
    if (!(await validateResetForm())) return
    resetting.value = true
    try {
      await resetUserPassword(resetTarget.value.id, { newPassword: resetForm.newPassword })
      ElMessage.success(t('userAccountList.resetSuccess'))
      resetVisible.value = false
    } finally {
      resetting.value = false
    }
  }

  // --- 启停 / 删除 ---
  async function confirmEnable(row: UserAccount) {
    try {
      await ElMessageBox.confirm(
        t('userAccountList.enableConfirmText', { name: row.username }),
        t('userAccountList.enableConfirmTitle'),
        {
          type: 'info',
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
        },
      )
      await enableUser(row.id)
      ElMessage.success(t('userAccountList.enableSuccess'))
      await load()
    } catch {
      /* cancel */
    }
  }

  async function confirmDisable(row: UserAccount) {
    try {
      await ElMessageBox.confirm(
        t('userAccountList.disableConfirmText', { name: row.username }),
        t('userAccountList.disableConfirmTitle'),
        {
          type: 'warning',
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
        },
      )
      await disableUser(row.id)
      ElMessage.success(t('userAccountList.disableSuccess'))
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
</style>
