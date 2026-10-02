<template>
  <el-dialog
    :model-value="modelValue"
    :title="t('userBatch.title')"
    :width="preview || result ? 'min(960px, 96vw)' : 'min(640px, 96vw)'"
    :close-on-click-modal="false"
    :close-on-press-escape="!busy"
    :before-close="beforeClose"
    @closed="clearSensitiveResult"
  >
    <div v-if="!result && !recoveredOperation" class="batch-toolbar">
      <el-button :icon="Download" @click="downloadTemplate">{{
        t('userBatch.template')
      }}</el-button>
      <el-button :icon="Upload" :loading="busy" @click="fileInput?.click()">
        {{ t('userBatch.upload') }}
      </el-button>
      <input
        ref="fileInput"
        class="batch-file-input"
        type="file"
        accept=".xlsx"
        @change="onFileChange"
      />
    </div>

    <template v-if="result">
      <el-alert
        type="success"
        :closable="false"
        :title="t('userBatch.created', { count: result.accountCount })"
      />
      <p class="batch-note">{{ t('userBatch.oneTimeWarning') }}</p>
      <p class="batch-operation">{{ t('userBatch.operationId') }}: {{ result.operationId }}</p>
      <el-table
        class="batch-desktop-table"
        :data="result.credentials"
        border
        stripe
        max-height="420"
      >
        <el-table-column prop="tenantId" :label="t('userBatch.tenant')" min-width="130" />
        <el-table-column prop="username" :label="t('userBatch.username')" min-width="150" />
        <el-table-column :label="t('userBatch.password')" min-width="260">
          <template #default="{ row }">
            <div class="batch-password">
              <code>{{ row.initialPassword }}</code>
              <el-tooltip :content="t('userBatch.copy')">
                <el-button
                  link
                  :icon="Copy"
                  :aria-label="t('userBatch.copy')"
                  @click="copyPassword(row.initialPassword)"
                />
              </el-tooltip>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <div class="batch-mobile-rows">
        <div
          v-for="credential in result.credentials"
          :key="credential.accountId"
          class="batch-mobile-row"
        >
          <strong>{{ credential.username }}</strong>
          <span class="batch-mobile-secondary">{{ credential.tenantId }}</span>
          <div class="batch-password">
            <code>{{ credential.initialPassword }}</code>
            <el-tooltip :content="t('userBatch.copy')">
              <el-button
                link
                :icon="Copy"
                :aria-label="t('userBatch.copy')"
                @click="copyPassword(credential.initialPassword)"
              />
            </el-tooltip>
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="recoveredOperation">
      <el-alert type="warning" :closable="false" :title="t('userBatch.recovered')" />
      <p class="batch-note">{{ t('userBatch.recoveredHint') }}</p>
      <p class="batch-operation">
        {{ t('userBatch.operationId') }}: {{ recoveredOperation.operationId }}
      </p>
    </template>

    <template v-else-if="preview">
      <div class="batch-stats">
        <div>
          <strong>{{ preview.totalRows }}</strong
          ><span>{{ t('userBatch.total') }}</span>
        </div>
        <div>
          <strong>{{ preview.validRows }}</strong
          ><span>{{ t('userBatch.valid') }}</span>
        </div>
        <div :class="{ 'batch-stat-error': preview.issues.length > 0 }">
          <strong>{{ preview.issues.length }}</strong
          ><span>{{ t('userBatch.invalid') }}</span>
        </div>
      </div>
      <el-table
        class="batch-desktop-table"
        :data="preview.rows"
        border
        stripe
        max-height="440"
        row-key="rowNo"
      >
        <el-table-column prop="rowNo" :label="t('userBatch.row')" width="70" />
        <el-table-column
          prop="tenantId"
          :label="t('userBatch.tenant')"
          min-width="130"
          show-overflow-tooltip
        />
        <el-table-column
          prop="username"
          :label="t('userBatch.username')"
          min-width="150"
          show-overflow-tooltip
        />
        <el-table-column
          prop="displayName"
          :label="t('userBatch.displayName')"
          min-width="130"
          show-overflow-tooltip
        />
        <el-table-column :label="t('userBatch.role')" min-width="150">
          <template #default="{ row }">{{ roleLabel(row.role) }}</template>
        </el-table-column>
        <el-table-column :label="t('userBatch.issue')" min-width="170">
          <template #default="{ row }">
            <span class="batch-issue">{{ issueFor(row.rowNo) }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('userBatch.action')" width="94">
          <template #default="{ row }">
            <el-button link type="primary" @click="editRow(row)">{{
              t('userBatch.edit')
            }}</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="batch-mobile-rows">
        <div v-for="row in preview.rows" :key="row.rowNo" class="batch-mobile-row">
          <div class="batch-mobile-heading">
            <strong>{{ row.username || t('userBatch.username') }}</strong>
            <span class="batch-mobile-secondary">{{ t('userBatch.row') }} {{ row.rowNo }}</span>
          </div>
          <span class="batch-mobile-secondary">{{ row.tenantId }} · {{ roleLabel(row.role) }}</span>
          <div class="batch-mobile-heading">
            <span class="batch-issue">{{ issueFor(row.rowNo) }}</span>
            <el-button link type="primary" @click="editRow(row)">{{
              t('userBatch.edit')
            }}</el-button>
          </div>
        </div>
      </div>
      <div class="batch-summary">
        <span>{{ t('userBatch.tenants', { count: tenantCount }) }}</span>
        <span>{{ t('userBatch.privileged', { count: privilegedCount }) }}</span>
      </div>
    </template>

    <p v-else class="batch-placeholder">{{ t('userBatch.empty') }}</p>

    <template #footer>
      <el-button :disabled="busy" @click="close">{{ t('common.close') }}</el-button>
      <el-button
        v-if="preview && !result && !recoveredOperation"
        type="primary"
        :loading="busy"
        :disabled="preview.issues.length > 0"
        @click="apply"
      >
        {{ t('userBatch.apply') }}
      </el-button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="editVisible"
    :title="t('userBatch.editRow')"
    width="min(520px, 96vw)"
    append-to-body
  >
    <el-form v-if="draft" label-width="110px">
      <el-form-item :label="t('userBatch.tenant')">
        <el-input v-model="draft.tenantId" :disabled="!isPlatformAdmin" maxlength="64" />
      </el-form-item>
      <el-form-item :label="t('userBatch.username')">
        <el-input v-model="draft.username" maxlength="128" />
      </el-form-item>
      <el-form-item :label="t('userBatch.displayName')">
        <el-input v-model="draft.displayName" maxlength="256" />
      </el-form-item>
      <el-form-item :label="t('userBatch.role')">
        <el-select v-model="draft.role" class="batch-role-select" @change="onRoleChange">
          <el-option
            v-for="option in roleOptions"
            :key="option.value"
            :value="option.value"
            :label="option.label"
          />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="editVisible = false">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="busy" @click="saveRow">{{ t('common.save') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Copy, Download, Upload } from '@lucide/vue'
  import {
    applyUserBatch,
    downloadUserBatchTemplate,
    findUserBatchOperation,
    patchUserBatch,
    previewUserBatch,
    type UserBatchAccountRow,
    type UserBatchApplyResult,
    type UserBatchOperation,
    type UserBatchPreview,
  } from '@/api/userAccounts'
  import { filterRoleOptionsFor } from '@/utils/roleOptions'
  import { useAuthStore } from '@/stores/auth'

  defineProps<{ modelValue: boolean }>()
  const emit = defineEmits<{ 'update:modelValue': [value: boolean]; applied: [] }>()
  const { t } = useI18n({ useScope: 'global' })
  const auth = useAuthStore()
  const isPlatformAdmin = computed(() => auth.hasPermission('ROLE_ADMIN'))
  const roleOptions = computed(() => filterRoleOptionsFor(isPlatformAdmin.value))
  const fileInput = ref<HTMLInputElement | null>(null)
  const busy = ref(false)
  const preview = ref<UserBatchPreview | null>(null)
  const result = ref<UserBatchApplyResult | null>(null)
  const recoveredOperation = ref<UserBatchOperation | null>(null)
  const editVisible = ref(false)
  const draft = ref<UserBatchAccountRow | null>(null)
  const tenantCount = computed(() => new Set(preview.value?.rows.map((r) => r.tenantId)).size)
  const privilegedCount = computed(
    () =>
      preview.value?.rows.filter((r) => r.role === 'ROLE_ADMIN' || r.role === 'ROLE_TENANT_ADMIN')
        .length ?? 0,
  )

  function clearSensitiveResult() {
    result.value = null
    preview.value = null
    recoveredOperation.value = null
    draft.value = null
    if (fileInput.value) fileInput.value.value = ''
  }

  function close() {
    if (busy.value) return
    emit('update:modelValue', false)
  }

  function beforeClose(done: () => void) {
    if (busy.value) return
    close()
    done()
  }

  async function downloadTemplate() {
    const blob = await downloadUserBatchTemplate()
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'accounts-template.xlsx'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function onFileChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.xlsx') || file.size > 2 * 1024 * 1024) {
      ElMessage.error(t('userBatch.fileLimit'))
      return
    }
    busy.value = true
    try {
      preview.value = await previewUserBatch(file)
      result.value = null
      recoveredOperation.value = null
    } finally {
      busy.value = false
      if (fileInput.value) fileInput.value.value = ''
    }
  }

  function issueFor(rowNo: number) {
    const code = preview.value?.issues.find((issue) => issue.rowNo === rowNo)?.errorCode
    return code ? t(`userBatch.issueCodes.${code}`) : ''
  }

  function roleLabel(role: string) {
    const keys: Record<string, string> = {
      ROLE_ADMIN: 'roleOptions.admin',
      ROLE_AUDITOR: 'roleOptions.auditor',
      ROLE_TENANT_ADMIN: 'roleOptions.tenantAdmin',
      ROLE_TENANT_USER: 'roleOptions.tenantUser',
    }
    const key = keys[role]
    return key ? t(key) : role
  }

  function editRow(row: UserBatchAccountRow) {
    draft.value = { ...row }
    editVisible.value = true
  }

  function onRoleChange(role: UserBatchAccountRow['role']) {
    if (!draft.value || !isPlatformAdmin.value) return
    if (role === 'ROLE_ADMIN' || role === 'ROLE_AUDITOR') {
      draft.value.tenantId = 'system'
    } else if (draft.value.tenantId === 'system') {
      draft.value.tenantId = ''
    }
  }

  async function saveRow() {
    if (!preview.value || !draft.value) return
    busy.value = true
    try {
      preview.value = await patchUserBatch(
        preview.value.previewToken,
        preview.value.version,
        draft.value,
      )
      editVisible.value = false
    } finally {
      busy.value = false
    }
  }

  async function apply() {
    if (!preview.value || preview.value.issues.length) return
    try {
      await ElMessageBox.confirm(
        t('userBatch.confirmBody', {
          count: preview.value.totalRows,
          tenants: tenantCount.value,
          privileged: privilegedCount.value,
        }),
        t('userBatch.confirmTitle'),
        { type: 'warning' },
      )
    } catch {
      return
    }
    const requestId = crypto.randomUUID()
    busy.value = true
    try {
      result.value = await applyUserBatch(
        preview.value.previewToken,
        preview.value.version,
        requestId,
      )
      emit('applied')
    } catch {
      // 响应丢失后只能查询无敏感摘要，不能重放 Apply 取回明文凭据。
      try {
        recoveredOperation.value = await findUserBatchOperation(requestId)
        if (recoveredOperation.value) emit('applied')
      } catch {
        // 原始请求错误由 API 拦截器反馈；保留预览以便修正或重试。
      }
    } finally {
      busy.value = false
    }
  }

  async function copyPassword(password: string) {
    await navigator.clipboard.writeText(password)
    ElMessage.success(t('userBatch.copied'))
  }
</script>

<style scoped>
  .batch-toolbar,
  .batch-summary,
  .batch-password {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .batch-toolbar {
    margin-bottom: 16px;
  }
  .batch-summary {
    flex-wrap: wrap;
    padding: 12px 0;
    color: var(--color-text-secondary);
  }
  .batch-stats {
    display: flex;
    gap: 24px;
    padding: 4px 0 14px;
  }
  .batch-stats > div {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .batch-stats strong {
    font-size: 16px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .batch-stats span {
    color: var(--color-text-secondary);
    font-size: 12px;
  }
  .batch-stats .batch-stat-error strong {
    color: var(--color-danger);
  }
  .batch-note {
    margin: 16px 0 8px;
    color: var(--color-warning);
  }
  .batch-operation {
    overflow-wrap: anywhere;
    color: var(--color-text-secondary);
  }
  .batch-issue {
    color: var(--color-danger);
  }
  .batch-password code {
    overflow-wrap: anywhere;
  }
  .batch-file-input {
    display: none;
  }
  .batch-role-select {
    width: 100%;
  }
  .batch-placeholder {
    margin: 8px 0 12px;
    color: var(--color-text-secondary);
  }
  .batch-mobile-rows {
    display: none;
  }
  @media (max-width: 600px) {
    .batch-toolbar {
      flex-direction: column;
      align-items: stretch;
    }
    .batch-toolbar .el-button {
      width: 100%;
      margin-left: 0;
    }
    .batch-desktop-table {
      display: none;
    }
    .batch-mobile-rows {
      display: block;
      max-height: 440px;
      overflow-y: auto;
      border-top: 1px solid var(--el-border-color-light);
    }
    .batch-mobile-row {
      display: grid;
      gap: 7px;
      padding: 12px 0;
      border-bottom: 1px solid var(--el-border-color-light);
    }
    .batch-mobile-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .batch-mobile-secondary {
      color: var(--color-text-secondary);
      font-size: 12px;
    }
    .batch-mobile-row .batch-password {
      justify-content: space-between;
      min-width: 0;
    }
    .batch-mobile-row .batch-password code {
      min-width: 0;
    }
    .batch-stats {
      gap: 14px;
    }
    .batch-stats > div {
      display: grid;
      gap: 2px;
      min-width: 0;
    }
  }
</style>
