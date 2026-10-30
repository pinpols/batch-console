<template>
  <div>
    <ListPageQueryBar
      :filter-busy="filterBusy"
      :refresh-busy="loadingTags"
      @search="() => runSearch(loadTags)"
      @reset="() => runReset(resetTagFilter)"
      @refresh="() => runRefresh(loadTags)"
    >
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
                :icon="Save"
                :loading="savingKey === String(row.tagKey)"
                :disabled="!loadedIdentityMatchesQuery"
                @click="saveRow(row)"
              >
                {{ t('common.save') }}
              </el-button>
              <el-button
                size="small"
                plain
                type="danger"
                :icon="Trash2"
                :loading="deletingKey === String(row.tagKey)"
                :disabled="!loadedIdentityMatchesQuery"
                @click="confirmDeleteTag(row)"
              >
                {{ t('tagResourceTab.btnDelete') }}
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </DataState>

    <el-drawer
      :append-to-body="true"
      v-model="newDialogVisible"
      :title="t('tagResourceTab.dialogTitle')"
      direction="rtl"
      size="480px"
    >
      <el-form label-width="88px" class="new-dialog-form">
        <el-form-item :label="t('tagResourceTab.fieldTagKey')" required>
          <el-input
            v-model="newTag.tagKey"
            :placeholder="t('tagResourceTab.tagKeyPlaceholder')"
            maxlength="64"
          />
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
            {{ t('common.cancel') }}
          </el-button>
          <el-button type="primary" :loading="savingNew" @click="saveNewTag">
            {{ t('common.save') }}
          </el-button>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
  import { Save, Trash2 } from '@lucide/vue'
  import { ref, reactive, computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'

  const { t } = useI18n({ useScope: 'global' })
  import { confirmDanger } from '@/composables/useDangerConfirm'
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
  import { tagResourceIdentityMatches } from './tagResourceIdentity'
  import type { TagResourceIdentity } from './tagResourceIdentity'

  const tenant = useTenantStore()
  const { data: metaEnums } = useConsoleMetaEnumsQuery()
  const resourceTypeOptions = computed(() =>
    pickMetaEnumGroup(metaEnums.value, 'triggerResourceType'),
  )

  const { loading: loadingTags, error: loadTagsError, run: runLoadTags } = useListLoadState()
  const { filterBusy, runSearch, runReset, runRefresh } = useListFilterFeedback(loadingTags)
  const queryForm = reactive({ resourceType: '' as string, resourceCode: '' })
  const canCreate = computed(
    () => !!queryForm.resourceType && queryForm.resourceCode.trim().length > 0,
  )
  // 父组件(TagManagement)的「新增」按钮按此 gating。此前父组件靠 ref 读本组件 expose 的
  // computed(resourceTabRef.value?.canCreate?.value),跨组件 computed 依赖追踪偶发不触发 → 表单填好
  // 按钮却不解锁(e2e 实测 ~1/3 偶发)。改为显式 emit,父组件用普通 ref 接,reactivity 可靠。
  const emit = defineEmits<{ canCreateChange: [boolean] }>()
  watch(canCreate, (v) => emit('canCreateChange', v), { immediate: true })
  const editValueByKey = reactive<Record<string, string>>({})
  const savingKey = ref('')
  const deletingKey = ref('')
  const tagRows = ref<Record<string, unknown>[]>([])
  const loadedIdentity = ref<TagResourceIdentity | null>(null)
  let loadGeneration = 0
  const currentIdentity = (): TagResourceIdentity => ({
    tenantId: String(tenant.tenantId),
    resourceType: queryForm.resourceType,
    resourceCode: queryForm.resourceCode,
  })
  const loadedIdentityMatchesQuery = computed(() =>
    tagResourceIdentityMatches(loadedIdentity.value, currentIdentity()),
  )

  function resetTagFilter() {
    loadGeneration += 1
    queryForm.resourceType = ''
    queryForm.resourceCode = ''
    tagRows.value = []
    loadedIdentity.value = null
  }

  const savingNew = ref(false)
  const newTag = reactive({ tagKey: '', tagValue: '' })
  const newDialogVisible = ref(false)

  async function loadTags() {
    if (!queryForm.resourceType || !queryForm.resourceCode.trim()) {
      ElMessage.warning(t('tagResourceTab.needResourceTypeCode'))
      return
    }
    const requestIdentity = currentIdentity()
    const requestGeneration = ++loadGeneration
    await runLoadTags(async () => {
      const data = await listResourceTags(
        requestIdentity.tenantId,
        requestIdentity.resourceType as ResourceType,
        requestIdentity.resourceCode,
      )
      const requestWasSuperseded = requestGeneration !== loadGeneration
      if (requestWasSuperseded) return
      const responseMatchesCurrentResource = tagResourceIdentityMatches(
        requestIdentity,
        currentIdentity(),
      )
      if (!responseMatchesCurrentResource) return
      tagRows.value = Array.isArray(data) ? (data as Record<string, unknown>[]) : []
      loadedIdentity.value = requestIdentity
      Object.keys(editValueByKey).forEach((k) => delete editValueByKey[k])
      tagRows.value.forEach((row) => {
        const tagKey = String(row.tagKey ?? '')
        editValueByKey[tagKey] = row.tagValue ? String(row.tagValue) : ''
      })
    }).catch(() => {
      if (requestGeneration === loadGeneration) {
        tagRows.value = []
        loadedIdentity.value = null
      }
    })
  }

  async function upsertTag(
    tagKey: string,
    tagValue: string,
    identity: TagResourceIdentity = currentIdentity(),
  ) {
    if (!identity.resourceType || !identity.resourceCode.trim()) {
      ElMessage.warning(t('tagResourceTab.selectAbove'))
      return
    }
    if (!tagKey.trim()) {
      ElMessage.warning(t('tagResourceTab.tagKeyRequired'))
      return
    }
    try {
      await upsertResourceTag(identity.tenantId, {
        resourceType: identity.resourceType as ResourceType,
        resourceCode: identity.resourceCode,
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
    if (!loadedIdentityMatchesQuery.value || !loadedIdentity.value) {
      ElMessage.warning(t('tagResourceTab.selectAbove'))
      return
    }
    const k = String(row.tagKey ?? '')
    savingKey.value = k
    try {
      await upsertTag(k, editValueByKey[k] ?? '', loadedIdentity.value)
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
    if (!loadedIdentityMatchesQuery.value || !loadedIdentity.value) {
      ElMessage.warning(t('tagResourceTab.selectAbove'))
      return
    }
    const identity = { ...loadedIdentity.value }
    deletingKey.value = String(row.tagKey ?? '')
    try {
      await confirmDanger({
        verb: t('tagResourceTab.deleteVerb'),
        target: t('tagResourceTab.deleteTarget', { key: row.tagKey }),
        consequence: t('tagResourceTab.deleteConsequence', {
          type: identity.resourceType,
          code: identity.resourceCode,
        }),
        irreversible: false,
      })
      const identityAfterConfirmation = currentIdentity()
      if (!tagResourceIdentityMatches(identity, identityAfterConfirmation)) {
        ElMessage.warning(t('tagResourceTab.selectAbove'))
        return
      }
      await deleteResourceTag(
        identity.tenantId,
        identity.resourceType,
        identity.resourceCode,
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
    loadGeneration += 1
    tagRows.value = []
    loadedIdentity.value = null
  })

  defineExpose({ openNewDialog, canCreate })
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
