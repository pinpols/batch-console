<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button type="primary" :icon="Plus" class="pretty-add-button" @click="openCreate">
          新增参数
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
        @change="slicePage"
        :error="loadError"
        :on-retry="load"
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
                placeholder="按 Key 模糊搜索"
                @keyup.enter="onSearch"
              />
            </el-form-item>
          </ListPageQueryBar>
        </template>
        <el-table-column prop="key" label="Key" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <CopyableText v-if="row.key" :text="row.key" />
            <span v-else class="cell-empty">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="value" label="Value" min-width="300" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.value || '—' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" plain type="primary" @click="openEdit(row)">编辑</el-button>
              <el-button size="small" plain type="danger" @click="confirmDelete(row)"
                >删除</el-button
              >
            </div>
          </template>
        </el-table-column>
      </ProTable>
    </SectionCard>

    <el-dialog v-model="dialogVisible" :title="editingKey ? '编辑参数' : '新增参数'" width="500px">
      <el-form label-width="100px">
        <el-form-item label="Key">
          <el-input v-model="form.key" :disabled="!!editingKey" placeholder="参数键" />
        </el-form-item>
        <el-form-item label="Value">
          <el-input v-model="form.value" type="textarea" :rows="3" placeholder="参数值" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, reactive, computed } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Plus } from '@element-plus/icons-vue'
  import {
    listSystemParameters,
    upsertSystemParameter,
    deleteSystemParameter,
  } from '@/api/systemParameters'
  import { toPageResult } from '@/api/adapters'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import CopyableText from '@/components/common/CopyableText.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'

  const tenant = useTenantStore()
  const loading = ref(false)
  const loadError = ref<unknown>(null)
  const { filterBusy, tableBlocking, runSearch, runReset, runRefresh } =
    useListFilterFeedback(loading)
  const saving = ref(false)
  const dialogVisible = ref(false)
  const editingKey = ref('')
  const allRows = ref<{ key: string; value: string }[]>([])
  const form = reactive({ key: '', value: '' })
  const page = ref(1)
  const pageSize = ref(20)
  const kwDraft = ref('')
  const keyword = ref('')

  const filtered = computed(() => {
    const k = keyword.value.trim().toLowerCase()
    if (!k) return allRows.value
    return allRows.value.filter((r) => r.key.toLowerCase().includes(k))
  })

  const pagedRows = computed(() => {
    const pr = toPageResult(filtered.value, page.value, pageSize.value)
    return pr.records
  })

  function slicePage() {}
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

  async function load() {
    loading.value = true
    loadError.value = null
    try {
      const data = await listSystemParameters(tenant.tenantId)
      allRows.value = Array.isArray(data)
        ? (data as { key: string; value: string }[])
        : Object.entries(data as Record<string, string>).map(([key, value]) => ({
            key,
            value: String(value),
          }))
    } catch (err) {
      loadError.value = err
      allRows.value = []
    } finally {
      loading.value = false
    }
  }

  function openCreate() {
    editingKey.value = ''
    form.key = ''
    form.value = ''
    dialogVisible.value = true
  }

  function openEdit(row: { key: string; value: string }) {
    editingKey.value = row.key
    form.key = row.key
    form.value = row.value
    dialogVisible.value = true
  }

  async function save() {
    if (!form.key.trim()) {
      ElMessage.warning('Key 不能为空')
      return
    }
    saving.value = true
    try {
      await upsertSystemParameter(tenant.tenantId, { key: form.key, value: form.value })
      ElMessage.success('已保存')
      dialogVisible.value = false
      await load()
    } finally {
      saving.value = false
    }
  }

  async function confirmDelete(row: { key: string }) {
    try {
      await ElMessageBox.confirm(`删除参数 "${row.key}"？`, '删除确认', { type: 'warning' })
      await deleteSystemParameter(tenant.tenantId, row.key)
      ElMessage.success('已删除')
      await load()
    } catch {
      /* cancel */
    }
  }

  useTenantReload(load)
</script>

<style scoped></style>
