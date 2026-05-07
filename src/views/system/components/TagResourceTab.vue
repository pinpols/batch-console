<template>
  <div>
    <ListPageQueryBar
      :filter-busy="filterBusy"
      :refresh-busy="loadingTags"
      @search="() => runSearch(loadTags)"
      @reset="
        () =>
          runReset(() => {
            queryForm.resourceType = ''
            queryForm.resourceCode = ''
            tagRows.value = []
          })
      "
      @refresh="() => runRefresh(loadTags)"
    >
      <template #prepend>
        <el-button type="primary" :icon="Plus" class="pretty-add-button" @click="openNewDialog">
          新增标签
        </el-button>
      </template>
      <el-form-item label="资源类型">
        <el-select
          v-model="queryForm.resourceType"
          clearable
          placeholder="请选择"
          class="tag-query__type"
        >
          <el-option
            v-for="opt in resourceTypeOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="资源编码">
        <el-input
          v-model="queryForm.resourceCode"
          clearable
          placeholder="必填"
          class="tag-query__code"
          @keyup.enter="loadTags"
        />
      </el-form-item>
    </ListPageQueryBar>

    <el-table
      v-loading="loadingTags"
      :data="tagRows"
      stripe
      border
      size="small"
      empty-text="暂无数据"
      class="console-table"
    >
      <el-table-column prop="tagKey" label="标签键" min-width="220" show-overflow-tooltip />
      <el-table-column label="标签值" min-width="260">
        <template #default="{ row }">
          <el-input v-model="editValueByKey[String(row.tagKey)]" clearable placeholder="可选" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="170" fixed="right">
        <template #default="{ row }">
          <div class="table-actions">
            <el-button
              size="small"
              plain
              type="primary"
              :loading="savingKey === String(row.tagKey)"
              @click="saveRow(row)"
            >
              保存
            </el-button>
            <el-button
              size="small"
              plain
              type="danger"
              :loading="deletingKey === String(row.tagKey)"
              @click="confirmDeleteTag(row)"
            >
              删除
            </el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="newDialogVisible" title="新增标签" width="520px">
      <el-form label-width="84px" class="new-dialog-form">
        <el-form-item label="标签键" required>
          <el-input v-model="newTag.tagKey" placeholder="tagKey" />
        </el-form-item>
        <el-form-item label="标签值">
          <el-input v-model="newTag.tagValue" placeholder="tagValue（可选）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="newDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="savingNew" @click="saveNewTag">保存</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Plus } from '@element-plus/icons-vue'
  import { listResourceTags, upsertResourceTag, deleteResourceTag } from '@/api/tags'
  import type { ResourceType } from '@/api/tags'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'

  const tenant = useTenantStore()
  const { data: metaEnums } = useConsoleMetaEnumsQuery()
  const resourceTypeOptions = computed(() =>
    pickMetaEnumGroup(metaEnums.value, 'triggerResourceType'),
  )

  const loadingTags = ref(false)
  const { filterBusy, runSearch, runReset, runRefresh } = useListFilterFeedback(loadingTags)
  const queryForm = reactive({ resourceType: '' as string, resourceCode: '' })
  const editValueByKey = reactive<Record<string, string>>({})
  const savingKey = ref('')
  const deletingKey = ref('')
  const tagRows = ref<Record<string, unknown>[]>([])

  const savingNew = ref(false)
  const newTag = reactive({ tagKey: '', tagValue: '' })
  const newDialogVisible = ref(false)

  async function loadTags() {
    if (!queryForm.resourceType || !queryForm.resourceCode.trim()) {
      ElMessage.warning('请输入资源类型和编码')
      return
    }
    loadingTags.value = true
    try {
      const data = await listResourceTags(
        tenant.tenantId,
        queryForm.resourceType as ResourceType,
        queryForm.resourceCode,
      )
      tagRows.value = Array.isArray(data) ? (data as Record<string, unknown>[]) : []
      Object.keys(editValueByKey).forEach((k) => delete editValueByKey[k])
      tagRows.value.forEach((row) => {
        const tagKey = String(row.tagKey ?? '')
        editValueByKey[tagKey] = row.tagValue ? String(row.tagValue) : ''
      })
    } catch {
      tagRows.value = []
    } finally {
      loadingTags.value = false
    }
  }

  async function upsertTag(tagKey: string, tagValue: string) {
    if (!queryForm.resourceType || !queryForm.resourceCode.trim()) {
      ElMessage.warning('请先在上方选择资源类型和编码')
      return
    }
    if (!tagKey.trim()) {
      ElMessage.warning('Tag Key 不能为空')
      return
    }
    try {
      await upsertResourceTag(tenant.tenantId, {
        resourceType: queryForm.resourceType as ResourceType,
        resourceCode: queryForm.resourceCode,
        tagKey,
        ...(tagValue ? { tagValue } : {}),
      })
      ElMessage.success('已保存')
      await loadTags()
    } catch {
      ElMessage.error('保存失败')
    }
  }

  async function saveRow(row: Record<string, unknown>) {
    const k = String(row.tagKey ?? '')
    savingKey.value = k
    try {
      await upsertTag(k, editValueByKey[k] ?? '')
    } finally {
      savingKey.value = ''
    }
  }

  async function saveNewTag() {
    if (!newTag.tagKey.trim()) {
      ElMessage.warning('Tag Key 不能为空')
      return
    }
    savingNew.value = true
    try {
      await upsertTag(newTag.tagKey.trim(), newTag.tagValue.trim())
      newTag.tagKey = ''
      newTag.tagValue = ''
      newDialogVisible.value = false
    } finally {
      savingNew.value = false
    }
  }

  function openNewDialog() {
    newTag.tagKey = ''
    newTag.tagValue = ''
    newDialogVisible.value = true
  }

  async function confirmDeleteTag(row: Record<string, unknown>) {
    deletingKey.value = String(row.tagKey ?? '')
    try {
      await ElMessageBox.confirm(`删除标签 "${row.tagKey}"？`, '删除确认', { type: 'warning' })
      await deleteResourceTag(
        tenant.tenantId,
        queryForm.resourceType,
        queryForm.resourceCode,
        String(row.tagKey),
      )
      ElMessage.success('已删除')
      await loadTags()
    } catch {
      /* cancel */
    } finally {
      deletingKey.value = ''
    }
  }

  useTenantReload(() => {
    tagRows.value = []
  })
</script>

<style scoped>
  .tag-query__type {
    width: 160px;
  }

  .tag-query__code {
    width: 260px;
  }

  @media (max-width: 900px) {
    .tag-query__code {
      width: min(320px, 100%);
    }
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }

  .new-dialog-form {
    padding-top: 4px;
  }
</style>
