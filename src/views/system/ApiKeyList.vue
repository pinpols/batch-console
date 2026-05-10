<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button
          type="primary"
          :icon="Plus"
          class="pretty-add-button"
          v-track-click="'新增 API Key'"
          @click="openCreate"
        >
          新增 API Key
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
            <el-form-item label="关键字">
              <el-input
                class="query-w-200"
                v-model="kwDraft"
                clearable
                placeholder="按名称模糊搜索"
                @keyup.enter="onSearch"
              />
            </el-form-item>
          </ListPageQueryBar>
        </template>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="keyName" label="名称" min-width="160" show-overflow-tooltip />
        <el-table-column prop="scopes" label="权限范围" min-width="180" show-overflow-tooltip />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <StatusTag
              :value="String(isRevoked(row) ? 'REVOKED' : isEnabled(row) ? 'ENABLED' : 'DISABLED')"
              category="apiKey"
            />
          </template>
        </el-table-column>
        <DatetimeColumn prop="expiresAt" label="过期时间" width="160" />
        <DatetimeColumn prop="revokedAt" label="吊销时间" width="160" />
        <DatetimeColumn prop="createdAt" label="创建时间" width="160" />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" plain type="primary" @click="viewDetail(row)">详情</el-button>
              <el-button
                size="small"
                plain
                type="danger"
                v-track-click="{ action: '吊销 API Key', id: row.id }"
                @click="confirmRevoke(row)"
                :disabled="isRevoked(row)"
              >
                {{ isRevoked(row) ? '已吊销' : '吊销' }}
              </el-button>
            </div>
          </template>
        </el-table-column>
      </ProTable>
    </SectionCard>

    <el-dialog v-model="createVisible" title="新增 API Key" width="500px">
      <el-form ref="apiKeyFormRef" :model="form" :rules="apiKeyFormRules" label-width="100px">
        <el-form-item label="名称" prop="keyName">
          <el-input v-model="form.keyName" placeholder="Key 名称" maxlength="128" />
        </el-form-item>
        <el-form-item label="权限范围" prop="scopes">
          <el-input v-model="form.scopes" placeholder="逗号分隔，如 READ,WRITE" />
        </el-form-item>
        <el-form-item label="过期时间" prop="expiresAt">
          <el-date-picker
            v-model="form.expiresAt"
            type="datetime"
            value-format="YYYY-MM-DDTHH:mm:ss"
            placeholder="可选，不填则永久"
            class="query-w-full"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">创建</el-button>
      </template>
    </el-dialog>

    <!-- 创建成功后强制弹出明文密钥(只显示这一次) -->
    <el-dialog
      v-model="rawKeyVisible"
      title="🔑 API Key 已创建"
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
        title="这是密钥的唯一一次完整显示"
        description="关闭此窗口后将不再显示。请立即复制保存到安全的地方(密码管理器 / KMS)。"
        class="raw-key-alert"
      />
      <div class="raw-key-block">
        <div class="raw-key-block__label">名称:{{ createdKey?.keyName }}</div>
        <div class="raw-key-block__value">
          <code>{{ createdKey?.rawKey }}</code>
        </div>
        <el-button
          type="primary"
          :icon="copied ? Check : DocumentCopy"
          class="raw-key-block__copy"
          @click="copyRawKey"
        >
          {{ copied ? '已复制' : '复制密钥' }}
        </el-button>
      </div>
      <template #footer>
        <el-button :disabled="!copied" type="primary" @click="closeRawKey">
          {{ copied ? '我已保存,关闭' : '请先复制再关闭' }}
        </el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="detailVisible" title="API Key 详情" size="560px">
      <el-descriptions v-if="detail" :column="1" border size="small">
        <el-descriptions-item label="ID">{{ detail.id }}</el-descriptions-item>
        <el-descriptions-item label="名称">{{ detail.keyName }}</el-descriptions-item>
        <el-descriptions-item label="权限范围">{{ detail.scopes }}</el-descriptions-item>
        <el-descriptions-item label="enabled">{{
          String(detail.enabled ?? '')
        }}</el-descriptions-item>
        <el-descriptions-item label="过期时间">{{ detail.expiresAt }}</el-descriptions-item>
        <el-descriptions-item label="revokedAt">{{ detail.revokedAt ?? '—' }}</el-descriptions-item>
        <el-descriptions-item label="revokedBy">{{ detail.revokedBy ?? '—' }}</el-descriptions-item>
        <el-descriptions-item label="原始响应">
          <JsonPreview :data="detail" />
        </el-descriptions-item>
      </el-descriptions>
    </el-drawer>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, reactive, computed } from 'vue'
  import { ElMessage } from 'element-plus'
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
      ElMessage.success('已复制到剪贴板')
    } catch {
      ElMessage.error('剪贴板写入失败,请手动选中复制')
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
    keyName: [rules.required('名称必填'), rules.maxLength(128)],
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
        verb: '吊销',
        target: ` API Key 「${row.keyName}」`,
        consequence:
          '该密钥立即失效;所有使用此密钥的后台调用、SDK 客户端、CI/CD 流水线会立即收到 401。',
        irreversible: true,
      })
      await revokeApiKey(row.id as number, tenant.tenantId)
      ElMessage.success('已吊销')
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
