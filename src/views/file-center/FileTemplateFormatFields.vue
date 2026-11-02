<template>
  <div class="form-section">
    <div class="section-title">{{ t('fileTemplateList.sectionFormat') }}</div>
    <el-form-item :label="t('fileTemplateList.fieldFileFormatType')">
      <MetaSelect
        v-model="fileFormatType"
        enum-key="fileTemplateFormat"
        class="query-w-full"
        clearable
      />
    </el-form-item>
    <template v-if="fileFormatType === 'DELIMITED'">
      <el-form-item :label="t('fileTemplateList.fieldDelimiter')">
        <el-input v-model="delimiter" class="form-control--short" maxlength="8" />
      </el-form-item>
      <el-form-item :label="t('fileTemplateList.fieldLineSeparator')">
        <el-input v-model="lineSeparator" class="form-control--short" maxlength="16" />
      </el-form-item>
    </template>
    <el-form-item>
      <el-button
        type="primary"
        link
        :aria-expanded="showAdvanced"
        @click="showAdvanced = !showAdvanced"
      >
        {{ showAdvanced ? t('fileTemplateList.hideAdvanced') : t('fileTemplateList.showAdvanced') }}
      </el-button>
    </el-form-item>
    <template v-if="showAdvanced">
      <el-form-item :label="t('fileTemplateList.fieldCharset')">
        <el-input v-model="charset" class="form-control--short" maxlength="32" />
      </el-form-item>
      <el-form-item :label="t('fileTemplateList.fieldTargetCharset')">
        <el-input v-model="targetCharset" class="form-control--short" maxlength="32" />
      </el-form-item>
      <el-form-item :label="t('fileTemplateList.fieldWithBom')">
        <el-checkbox v-model="withBom" />
      </el-form-item>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import MetaSelect from '@/components/common/MetaSelect.vue'

  const { t } = useI18n({ useScope: 'global' })
  const fileFormatType = defineModel<string>('fileFormatType', { required: true })
  const delimiter = defineModel<string>('delimiter', { required: true })
  const lineSeparator = defineModel<string>('lineSeparator', { required: true })
  const charset = defineModel<string>('charset', { required: true })
  const targetCharset = defineModel<string>('targetCharset', { required: true })
  const withBom = defineModel<boolean>('withBom', { required: true })
  const showAdvanced = defineModel<boolean>('showAdvanced', { required: true })
</script>
