<template>
  <PageContainer>
    <PageHeader title="API Key" description="API Key 的创建、查看与吊销。">
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
      <el-form label-width="100px">
        <el-form-item label="名称">
          <el-input v-model="form.keyName" placeholder="Key 名称" />
        </el-form-item>
        <el-form-item label="权限范围">
          <el-input v-model="form.scopes" placeholder="逗号分隔，如 READ,WRITE" />
        </el-form-item>
        <el-form-item label="过期时间">
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
          <pre class="json-preview">{{ JSON.stringify(detail, null, 2) }}</pre>
        </el-descriptions-item>
      </el-descriptions>
    </el-drawer>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, reactive, computed } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Plus } from '@element-plus/icons-vue'
  import { listApiKeys, createApiKey, getApiKey, revokeApiKey } from '@/api/apiKeys'
  import { toPageResult } from '@/api/adapters'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'

  const tenant = useTenantStore()
  const loading = ref(false)
  const { filterBusy, tableBlocking, runSearch, runReset, runRefresh } =
    useListFilterFeedback(loading)
  const saving = ref(false)
  const createVisible = ref(false)
  const detailVisible = ref(false)
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

  async function load() {
    loading.value = true
    try {
      allRows.value = (await listApiKeys(tenant.tenantId)) as Record<string, unknown>[]
    } catch {
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
    if (!form.keyName.trim()) {
      ElMessage.warning('名称不能为空')
      return
    }
    saving.value = true
    try {
      const body: { keyName: string; scopes?: string; expiresAt?: string } = {
        keyName: form.keyName,
      }
      if (form.scopes.trim()) body.scopes = form.scopes
      if (form.expiresAt) body.expiresAt = form.expiresAt
      await createApiKey(tenant.tenantId, body)
      ElMessage.success('已创建')
      createVisible.value = false
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
      await ElMessageBox.confirm(`吊销 API Key #${row.id}（${row.keyName}）？`, '吊销确认', {
        type: 'warning',
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

<style scoped></style>
