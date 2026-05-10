<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button
          type="primary"
          :icon="Plus"
          class="pretty-add-button"
          v-track-click="'create API key'"
          @click="openCreate"
        >
          {{ t('apiKeyList.headerCreate') }}
        </el-button>
      </template>
    </PageHeader>

    <SectionCard>
      <ProTable
        :data="pagedRows"
        :loading="tableBlocking"
        :error="loadError"
        :on-retry="load"
        :total="filtered.length"
        v-model:page="page"
        v-model:page-size="pageSize"
        :has-active-filters="!!keyword"
        @change="() => {}"
      >
        <template #query>
          <ListPageQueryBar
            :filter-busy="filterBusy"
            :refresh-busy="loading"
            @search="onSearch"
            @reset="onReset"
            @refresh="() => runRefresh(load)"
          >
            <el-form-item :label="t('apiKeyList.keywordLabel')">
              <el-input
                class="query-w-200"
                v-model="kwDraft"
                clearable
                :placeholder="t('apiKeyList.keywordPlaceholder')"
                @keyup.enter="onSearch"
              />
            </el-form-item>
          </ListPageQueryBar>
        </template>
        <template #empty>
          <EmptyState :description="t('apiKeyList.emptyDescription')" :image-size="80">
            <template #action>
              <el-button type="primary" :icon="Plus" @click="openCreate">
                {{ t('apiKeyList.headerCreate') }}
              </el-button>
            </template>
          </EmptyState>
        </template>
        <el-table-column prop="id" :label="t('apiKeyList.colId')" width="80" />
        <el-table-column
          prop="keyName"
          :label="t('apiKeyList.colName')"
          min-width="160"
          show-overflow-tooltip
        />
        <el-table-column
          prop="scopes"
          :label="t('apiKeyList.colScopes')"
          min-width="180"
          show-overflow-tooltip
        />
        <el-table-column :label="t('apiKeyList.colStatus')" width="110">
          <template #default="{ row }">
            <StatusTag
              :value="String(isRevoked(row) ? 'REVOKED' : isEnabled(row) ? 'ENABLED' : 'DISABLED')"
              category="apiKey"
            />
          </template>
        </el-table-column>
        <DatetimeColumn prop="expiresAt" :label="t('apiKeyList.colExpiresAt')" width="160" />
        <DatetimeColumn prop="revokedAt" :label="t('apiKeyList.colRevokedAt')" width="160" />
        <DatetimeColumn prop="createdAt" :label="t('apiKeyList.colCreatedAt')" width="160" />
        <el-table-column :label="t('apiKeyList.colActions')" width="160" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" plain type="primary" @click="viewDetail(row)">
                {{ t('apiKeyList.actionDetail') }}
              </el-button>
              <el-button
                size="small"
                plain
                type="danger"
                v-track-click="{ action: 'revoke API key', id: row.id }"
                @click="confirmRevoke(row)"
                :disabled="isRevoked(row)"
              >
                {{ isRevoked(row) ? t('apiKeyList.actionRevoked') : t('apiKeyList.actionRevoke') }}
              </el-button>
            </div>
          </template>
        </el-table-column>
      </ProTable>
    </SectionCard>

    <el-dialog v-model="createVisible" :title="t('apiKeyList.dialogCreateTitle')" width="500px">
      <el-form ref="apiKeyFormRef" :model="form" :rules="apiKeyFormRules" label-width="100px">
        <el-form-item :label="t('apiKeyList.fieldName')" prop="keyName">
          <el-input
            v-model="form.keyName"
            :placeholder="t('apiKeyList.fieldNamePlaceholder')"
            maxlength="128"
          />
        </el-form-item>
        <el-form-item :label="t('apiKeyList.fieldScopes')" prop="scopes">
          <el-input v-model="form.scopes" :placeholder="t('apiKeyList.fieldScopesPlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('apiKeyList.fieldExpiresAt')" prop="expiresAt">
          <el-date-picker
            v-model="form.expiresAt"
            type="datetime"
            value-format="YYYY-MM-DDTHH:mm:ss"
            :placeholder="t('apiKeyList.fieldExpiresAtPlaceholder')"
            class="query-w-full"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">{{ t('apiKeyList.dialogCancel') }}</el-button>
        <el-button type="primary" :loading="saving" @click="save">
          {{ t('apiKeyList.dialogCreate') }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="rawKeyVisible"
      :title="t('apiKeyList.rawKeyTitle')"
      width="560px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
      align-center
    >
      <el-alert
        type="warning"
        :closable="false"
        show-icon
        :title="t('apiKeyList.rawKeyAlertTitle')"
        :description="t('apiKeyList.rawKeyAlertDescription')"
        class="raw-key-alert"
      />
      <div class="raw-key-block">
        <div class="raw-key-block__label">
          {{ t('apiKeyList.rawKeyLabel', { name: createdKey?.keyName ?? '' }) }}
        </div>
        <div class="raw-key-block__value">
          <code>{{ createdKey?.rawKey }}</code>
        </div>
        <el-button
          type="primary"
          :icon="copied ? Check : DocumentCopy"
          class="raw-key-block__copy"
          @click="copyRawKey"
        >
          {{ copied ? t('apiKeyList.rawKeyCopied') : t('apiKeyList.rawKeyCopy') }}
        </el-button>
      </div>
      <template #footer>
        <el-button :disabled="!copied" type="primary" @click="closeRawKey">
          {{ copied ? t('apiKeyList.rawKeyClose') : t('apiKeyList.rawKeyCloseDisabled') }}
        </el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="detailVisible" :title="t('apiKeyList.detailTitle')" size="560px">
      <el-descriptions v-if="detail" :column="1" border size="small">
        <el-descriptions-item label="ID">{{ detail.id }}</el-descriptions-item>
        <el-descriptions-item :label="t('apiKeyList.colName')">
          {{ detail.keyName }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('apiKeyList.detailScopes')">
          {{ detail.scopes }}
        </el-descriptions-item>
        <el-descriptions-item label="enabled">{{
          String(detail.enabled ?? '')
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('apiKeyList.detailExpiresAt')">
          {{ detail.expiresAt }}
        </el-descriptions-item>
        <el-descriptions-item label="revokedAt">{{ detail.revokedAt ?? '—' }}</el-descriptions-item>
        <el-descriptions-item label="revokedBy">{{ detail.revokedBy ?? '—' }}</el-descriptions-item>
        <el-descriptions-item :label="t('apiKeyList.detailRawResponse')">
          <JsonPreview :data="detail" />
        </el-descriptions-item>
      </el-descriptions>
    </el-drawer>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, reactive, computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'

  const { t } = useI18n({ useScope: 'global' })
  import { confirmDanger } from '@/composables/useDangerConfirm'
  import type { FormRules } from 'element-plus'
  import { Check, DocumentCopy, Plus } from '@element-plus/icons-vue'
  import { useFormValidate, rules } from '@/composables/useFormValidate'
  import {
    listApiKeys,
    createApiKey,
    getApiKey,
    revokeApiKey,
    type CreateApiKeyResponse,
  } from '@/api/apiKeys'
  import { toPageResult } from '@/api/adapters'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'

  const tenant = useTenantStore()
  const loading = ref(false)
  const loadError = ref<unknown>(null)
  const { filterBusy, tableBlocking, runSearch, runReset, runRefresh } =
    useListFilterFeedback(loading)
  const saving = ref(false)
  const createVisible = ref(false)
  const detailVisible = ref(false)
  // 创建成功后弹明文密钥的强制 modal
  const rawKeyVisible = ref(false)
  const createdKey = ref<CreateApiKeyResponse | null>(null)
  const copied = ref(false)

  async function copyRawKey() {
    if (!createdKey.value?.rawKey) return
    try {
      await navigator.clipboard.writeText(createdKey.value.rawKey)
      copied.value = true
      ElMessage.success(t('apiKeyList.copySuccess'))
    } catch {
      ElMessage.error(t('apiKeyList.copyFail'))
    }
  }

  function closeRawKey() {
    rawKeyVisible.value = false
    createdKey.value = null
    copied.value = false
  }
  const allRows = ref<Record<string, unknown>[]>([])
  const page = ref(1)
  const pageSize = ref(20)
  const kwDraft = ref('')
  const keyword = ref('')

  function isEnabled(row: Record<string, unknown>): boolean {
    const v = row.enabled
    if (typeof v === 'boolean') return v
    if (typeof v === 'string') return v.toLowerCase() === 'true'
    if (typeof v === 'number') return v === 1
    return true
  }

  function isRevoked(row: Record<string, unknown>): boolean {
    const v = row.revokedAt
    if (v == null) return false
    const s = String(v).trim()
    return s.length > 0 && s !== '0'
  }

  const filtered = computed(() => {
    const k = keyword.value.trim().toLowerCase()
    if (!k) return allRows.value
    return allRows.value.filter((r) =>
      String(r.keyName ?? '')
        .toLowerCase()
        .includes(k),
    )
  })

  const pagedRows = computed(
    () =>
      toPageResult(filtered.value, page.value, pageSize.value).records as unknown as Record<
        string,
        unknown
      >[],
  )

  function onSearch() {
    return runSearch(() => {
      keyword.value = kwDraft.value
      page.value = 1
    })
  }
  function onReset() {
    return runReset(() => {
      kwDraft.value = ''
      keyword.value = ''
      page.value = 1
    })
  }
  const detail = ref<Record<string, unknown> | null>(null)
  const form = reactive({ keyName: '', scopes: '', expiresAt: '' })

  const { formRef: apiKeyFormRef, validate: validateApiKeyForm } = useFormValidate()
  const apiKeyFormRules: FormRules = {
    keyName: [rules.required(t('apiKeyList.nameRequired')), rules.maxLength(128)],
  }

  async function load() {
    loading.value = true
    loadError.value = null
    try {
      allRows.value = (await listApiKeys(tenant.tenantId)) as Record<string, unknown>[]
    } catch (err) {
      loadError.value = err
      allRows.value = []
    } finally {
      loading.value = false
    }
  }

  function openCreate() {
    form.keyName = ''
    form.scopes = ''
    form.expiresAt = ''
    createVisible.value = true
  }

  async function save() {
    if (!(await validateApiKeyForm())) return
    saving.value = true
    try {
      const body: { keyName: string; scopes?: string; expiresAt?: string } = {
        keyName: form.keyName,
      }
      if (form.scopes.trim()) body.scopes = form.scopes
      if (form.expiresAt) body.expiresAt = form.expiresAt
      // BE 仅在 POST 响应里返回 rawKey 明文,之后任何 GET 都查不到 → 必须立即弹出引导用户保存
      const created = await createApiKey(tenant.tenantId, body)
      createVisible.value = false
      createdKey.value = created
      copied.value = false
      rawKeyVisible.value = true
      await load()
    } finally {
      saving.value = false
    }
  }

  async function viewDetail(row: Record<string, unknown>) {
    detail.value = (await getApiKey(row.id as number, tenant.tenantId)) as Record<string, unknown>
    detailVisible.value = true
  }

  async function confirmRevoke(row: Record<string, unknown>) {
    if (isRevoked(row)) return
    try {
      await confirmDanger({
        verb: t('apiKeyList.revokeVerb'),
        target: t('apiKeyList.revokeTarget', { name: String(row.keyName ?? '') }),
        consequence: t('apiKeyList.revokeConsequence'),
        irreversible: true,
      })
      await revokeApiKey(row.id as number, tenant.tenantId)
      ElMessage.success(t('apiKeyList.revokedToast'))
      // Optimistic UI: update row immediately (so button/text changes right away)
      row.revokedAt = new Date().toISOString()
      row.enabled = false
      await load()
    } catch {
      /* cancel */
    }
  }

  useTenantReload(load)
</script>

<style scoped>
  .raw-key-alert {
    margin-bottom: 16px;
  }

  .raw-key-block {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--color-bg-canvas);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-content);
  }

  .raw-key-block__label {
    font-size: 12px;
    color: var(--color-text-tertiary);
  }

  .raw-key-block__value {
    background: var(--color-bg-card);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-content);
    padding: 12px 14px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 13px;
    word-break: break-all;
    user-select: all;
    color: var(--color-text-primary);
  }

  .raw-key-block__copy {
    align-self: flex-start;
  }
</style>
