<template>
  <el-collapse>
    <el-collapse-item :title="t('fileTemplateList.mappingAssistant')" name="mapping">
      <p>{{ t('fileTemplateList.mappingAssistantHint') }}</p>
      <el-alert
        v-if="direction === 'EXPORT'"
        :title="t('fileTemplateMappingHelp.exportSqlRequired')"
        type="info"
        :closable="false"
        show-icon
      />
      <div>
        <el-form-item :label="t('fileTemplateList.mappingSchema')">
          <el-input v-model="schemaName" maxlength="64" />
        </el-form-item>
        <el-form-item :label="t('fileTemplateList.mappingTable')">
          <el-input v-model="tableName" maxlength="128" />
        </el-form-item>
        <div v-for="(field, index) in fields" :key="index" class="mapping-field">
          <el-form-item :label="t('fileTemplateList.mappingSource')">
            <el-input v-model="field.sourceColumn" maxlength="128" />
          </el-form-item>
          <el-form-item
            :label="
              t(
                direction === 'IMPORT'
                  ? 'fileTemplateList.mappingTarget'
                  : 'fileTemplateList.mappingHeader',
              )
            "
          >
            <el-input v-model="field.destination" maxlength="128" />
          </el-form-item>
          <el-button :disabled="fields.length === 1" @click="fields.splice(index, 1)">{{
            t('common.delete')
          }}</el-button>
        </div>
        <el-button @click="fields.push({ sourceColumn: '', destination: '' })">{{
          t('fileTemplateList.mappingAddField')
        }}</el-button>
        <el-button type="primary" :loading="loading" :disabled="!canApply" @click="generate">{{
          t('fileTemplateList.mappingGenerate')
        }}</el-button>
      </div>
      <template v-if="draft">
        <el-alert
          v-for="warning in draft.warnings"
          :key="warning"
          :title="warning"
          type="warning"
          :closable="false"
          show-icon
        />
        <el-form-item :label="t('fileTemplateList.fieldFieldMappingsJson')">
          <el-input :model-value="draft.fieldMappingsJson" type="textarea" :rows="4" readonly />
        </el-form-item>
        <el-form-item :label="t('fileTemplateList.fieldQueryParamSchemaJson')">
          <el-input :model-value="draft.queryParamSchemaJson" type="textarea" :rows="4" readonly />
        </el-form-item>
        <el-form-item v-if="draft.defaultQuerySql" :label="t('fileTemplateList.mappingSqlHint')">
          <el-input :model-value="draft.defaultQuerySql" type="textarea" :rows="3" readonly />
        </el-form-item>
        <el-button type="primary" :disabled="!canApply" @click="apply">{{
          t('fileTemplateList.mappingApply')
        }}</el-button>
      </template>
    </el-collapse-item>
  </el-collapse>
</template>

<script setup lang="ts">
  import { onScopeDispose, ref, watch } from 'vue'
  import { ElMessage } from 'element-plus'
  import { useI18n } from 'vue-i18n'
  import { draftFileTemplateMapping, type FileTemplateMappingDraftResponse } from '@/api/system'

  const props = defineProps<{
    tenantId: string
    direction: 'IMPORT' | 'EXPORT'
    canApply: boolean
  }>()
  const emit = defineEmits<{ apply: [value: FileTemplateMappingDraftResponse] }>()
  const { t } = useI18n()
  const schemaName = ref('')
  const tableName = ref('')
  const fields = ref([{ sourceColumn: '', destination: '' }])
  const draft = ref<FileTemplateMappingDraftResponse | null>(null)
  const loading = ref(false)
  let revision = 0

  function invalidate() {
    revision += 1
    draft.value = null
    loading.value = false
  }
  watch(
    [
      schemaName,
      tableName,
      fields,
      () => props.tenantId,
      () => props.direction,
      () => props.canApply,
    ],
    invalidate,
    { deep: true, flush: 'sync' },
  )
  onScopeDispose(invalidate)

  async function generate() {
    if (!props.canApply || !props.tenantId) return
    if (!tableName.value.trim() || fields.value.some((field) => !field.sourceColumn.trim())) {
      ElMessage.warning(t('fileTemplateList.mappingNeedsFields'))
      return
    }
    const requestRevision = ++revision
    draft.value = null
    loading.value = true
    try {
      const result = await draftFileTemplateMapping({
        tenantId: props.tenantId,
        direction: props.direction,
        schemaName: schemaName.value.trim() || undefined,
        tableName: tableName.value.trim(),
        fields: fields.value.map((field) => ({
          sourceColumn: field.sourceColumn.trim(),
          ...(props.direction === 'IMPORT'
            ? { targetColumn: field.destination.trim() || undefined }
            : { header: field.destination.trim() || undefined }),
        })),
      })
      if (requestRevision === revision) draft.value = result
    } catch {
      // 请求错误由统一客户端展示；旧请求不得修改当前草案。
    } finally {
      if (requestRevision === revision) loading.value = false
    }
  }

  function apply() {
    if (props.canApply && draft.value?.fieldMappingsJson && draft.value.queryParamSchemaJson)
      emit('apply', draft.value)
  }
</script>

<style scoped>
  .mapping-field {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }
  .mapping-field .el-form-item {
    flex: 1;
    min-width: 0;
  }
  @media (max-width: 600px) {
    .mapping-field {
      flex-wrap: wrap;
    }
  }
</style>
