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
          {{ t('tagResourceTab.btnAddTag') }}
        </el-button>
      </template>
      <el-form-item :label="t('tagResourceTab.resourceTypeLabel')">
        <MetaSelect
          v-model="queryForm.resourceType"
          clearable
          :placeholder="t('tagResourceTab.resourceTypePlaceholder')"
          class="tag-query__type"
          :options="resourceTypeOptions"
        />
      </el-form-item>
      <el-form-item :label="t('tagResourceTab.resourceCodeLabel')">
        <el-input
          v-model="queryForm.resourceCode"
          clearable
          :placeholder="t('tagResourceTab.resourceCodePlaceholder')"
          class="tag-query__code"
          @keyup.enter="loadTags"
        />
      </el-form-item>
    </ListPageQueryBar>

    <DataState
      :loading="loadingTags"
      :error="loadTagsError"
      :has-data="tagRows.length > 0"
      :on-retry="loadTags"
    >
      <el-table
        v-loading="loadingTags"
        :data="tagRows"
        stripe
        border
        size="small"
        :empty-text="t('common.noData')"
        class="console-table"
      >
        <el-table-column
          prop="tagKey"
          :label="t('tagResourceTab.colTagKey')"
          min-width="220"
          show-overflow-tooltip
        />
        <el-table-column :label="t('tagResourceTab.colTagValue')" min-width="260">
          <template #default="{ row }">
            <el-input
              v-model="editValueByKey[String(row.tagKey)]"
              clearable
              :placeholder="t('tagResourceTab.valuePlaceholder')"
            />
          </template>
        </el-table-column>
        <el-table-column :label="t('tagResourceTab.colActions')" width="170" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button
                size="small"
                plain
                type="primary"
                :loading="savingKey === String(row.tagKey)"
                @click="saveRow(row)"
              >
                {{ t('tagResourceTab.btnSave') }}
              </el-button>
              <el-button
                size="small"
                plain
                type="danger"
                :loading="deletingKey === String(row.tagKey)"
                @click="confirmDeleteTag(row)"
              >
                {{ t('tagResourceTab.btnDelete') }}
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </DataState>

    <el-dialog v-model="newDialogVisible" :title="t('tagResourceTab.dialogTitle')" width="480px">
      <el-form label-width="100px" class="new-dialog-form">
        <el-form-item :label="t('tagResourceTab.fieldTagKey')" required>
          <el-input v-model="newTag.tagKey" placeholder="tagKey" />
        </el-form-item>
        <el-form-item :label="t('tagResourceTab.fieldTagValue')">
          <el-input
            v-model="newTag.tagValue"
            :placeholder="t('tagResourceTab.tagValueOptionalPlaceholder')"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="newDialogVisible = false">
            {{ t('tagResourceTab.btnCancel') }}
          </el-button>
          <el-button type="primary" :loading="savingNew" @click="saveNewTag">
            {{ t('tagResourceTab.btnSave') }}
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'

  const { t } = useI18n({ useScope: 'global' })
  import { confirmDanger } from '@/composables/useDangerConfirm'
  import { Plus } from '@element-plus/icons-vue'
  import { listResourceTags, upsertResourceTag, deleteResourceTag } from '@/api/tags'
  import type { ResourceType } from '@/api/tags'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useListLoadState } from '@/composables/useListLoadState'
  import DataState from '@/components/common/DataState.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'

  const tenant = useTenantStore()
  const { data: metaEnums } = useConsoleMetaEnumsQuery()
  const resourceTypeOptions = computed(() =>
    pickMetaEnumGroup(metaEnums.value, 'triggerResourceType'),
  )

  const { loading: loadingTags, error: loadTagsError, run: runLoadTags } = useListLoadState()
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
      ElMessage.warning(t('tagResourceTab.needResourceTypeCode'))
      return
    }
    await runLoadTags(async () => {
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
    }).catch(() => {
      tagRows.value = []
    })
  }

  async function upsertTag(tagKey: string, tagValue: string) {
    if (!queryForm.resourceType || !queryForm.resourceCode.trim()) {
      ElMessage.warning(t('tagResourceTab.selectAbove'))
      return
    }
    if (!tagKey.trim()) {
      ElMessage.warning(t('tagResourceTab.tagKeyRequired'))
      return
    }
    try {
      await upsertResourceTag(tenant.tenantId, {
        resourceType: queryForm.resourceType as ResourceType,
        resourceCode: queryForm.resourceCode,
        tagKey,
        ...(tagValue ? { tagValue } : {}),
      })
      ElMessage.success(t('tagResourceTab.savedToast'))
      await loadTags()
    } catch {
      ElMessage.error(t('tagResourceTab.saveFailed'))
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
      ElMessage.warning(t('tagResourceTab.tagKeyRequired'))
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
      await confirmDanger({
        verb: t('tagResourceTab.deleteVerb'),
        target: t('tagResourceTab.deleteTarget', { key: row.tagKey }),
        consequence: t('tagResourceTab.deleteConsequence', {
          type: queryForm.resourceType,
          code: queryForm.resourceCode,
        }),
        irreversible: false,
      })
      await deleteResourceTag(
        tenant.tenantId,
        queryForm.resourceType,
        queryForm.resourceCode,
        String(row.tagKey),
      )
      ElMessage.success(t('tagResourceTab.deletedToast'))
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
