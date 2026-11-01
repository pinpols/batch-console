<template>
  <el-drawer
    :append-to-body="true"
    v-model="visible"
    :title="t('fileTemplateList.detailTitle')"
    size="800px"
  >
    <el-descriptions v-if="detail" :column="2" border size="small">
      <el-descriptions-item :label="t('fileTemplateList.descTemplateCode')">{{
        detail.templateCode
      }}</el-descriptions-item>
      <el-descriptions-item :label="t('fileTemplateList.descTemplateName')">{{
        detail.templateName
      }}</el-descriptions-item>
      <el-descriptions-item :label="t('fileTemplateList.descTemplateType')">{{
        detail.templateType
      }}</el-descriptions-item>
      <el-descriptions-item :label="t('fileTemplateList.descFileFormatType')">{{
        detail.fileFormatType
      }}</el-descriptions-item>
      <el-descriptions-item :label="t('fileTemplateList.descBizType')">{{
        detail.bizType
      }}</el-descriptions-item>
      <el-descriptions-item :label="t('fileTemplateList.descVersion')">{{
        detail.version
      }}</el-descriptions-item>
      <el-descriptions-item :label="t('fileTemplateList.descCharset')">{{
        detail.charset
      }}</el-descriptions-item>
      <el-descriptions-item :label="t('fileTemplateList.descTargetCharset')">{{
        detail.targetCharset
      }}</el-descriptions-item>
      <el-descriptions-item :label="t('fileTemplateList.descWithBom')">{{
        detail.withBom ? t('common.yes') : t('common.no')
      }}</el-descriptions-item>
      <el-descriptions-item :label="t('fileTemplateList.descDelimiter')">{{
        detail.delimiter || '—'
      }}</el-descriptions-item>
      <el-descriptions-item :label="t('fileTemplateList.descLineSeparator')">{{
        detail.lineSeparator || '—'
      }}</el-descriptions-item>
      <el-descriptions-item :label="t('fileTemplateList.descQueryParamSchema')" :span="2">
        <JsonPreview :data="detail.queryParamSchema || '—'" />
      </el-descriptions-item>
      <el-descriptions-item :label="t('fileTemplateList.descFieldMappings')" :span="2">
        <JsonPreview :data="detail.fieldMappings || '—'" />
      </el-descriptions-item>
      <el-descriptions-item :label="t('fileTemplateList.descDescription')" :span="2">
        <JsonPreview :data="detail.description || '—'" />
      </el-descriptions-item>
    </el-descriptions>
  </el-drawer>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import JsonPreview from '@/components/common/JsonPreview.vue'
  import type { ConsoleFileTemplateResponse } from '@/types/console-api'

  defineProps<{ detail: ConsoleFileTemplateResponse | null }>()
  const visible = defineModel<boolean>({ required: true })
  const { t } = useI18n({ useScope: 'global' })
</script>
