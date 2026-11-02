<template>
  <el-drawer
    v-model="editorVisible"
    :append-to-body="true"
    :title="
      editingId == null
        ? t('fileTemplateList.channelCreateTitle')
        : t('fileTemplateList.channelEditTitle')
    "
    direction="rtl"
    size="800px"
    destroy-on-close
  >
    <el-form :model="form" label-position="top">
      <el-form-item :label="t('fileTemplateList.fieldChannelCode')" required>
        <el-input v-if="editingId != null" v-model="form.channelCode" disabled maxlength="128" />
        <CodeNameBuilder v-else v-model="form.channelCode" default-domain="DISPATCH" />
      </el-form-item>
      <el-form-item :label="t('fileTemplateList.fieldChannelName')">
        <el-input v-model="form.channelName" maxlength="256" />
      </el-form-item>
      <el-form-item :label="t('fileTemplateList.fieldChannelType')" required>
        <MetaSelect v-model="form.channelType" enum-key="channelType" class="query-w-full" />
      </el-form-item>
      <el-form-item :label="t('fileTemplateList.fieldTargetEndpoint')">
        <el-input v-model="form.targetEndpoint" maxlength="512" />
      </el-form-item>
      <el-form-item :label="t('fileTemplateList.fieldAuthType')">
        <MetaSelect v-model="form.authType" enum-key="authType" class="query-w-full" clearable />
      </el-form-item>
      <el-form-item :label="t('fileTemplateList.fieldReceiptPolicy')">
        <MetaSelect
          v-model="form.receiptPolicy"
          enum-key="receiptPolicy"
          class="query-w-full"
          clearable
        />
      </el-form-item>
      <el-form-item :label="t('fileTemplateList.fieldTimeoutSeconds')">
        <el-input-number v-model="form.timeoutSeconds" :min="0" :max="2147483647" />
      </el-form-item>
      <el-form-item :label="t('fileTemplateList.fieldEnabled')">
        <el-switch v-model="form.enabled" />
      </el-form-item>
      <el-form-item :label="t('fileTemplateList.fieldConfigJson')">
        <JsonTextareaInput v-model="form.configJson" :rows="5" expect="object" />
        <div class="field-hint">{{ t('fileTemplateList.configJsonSecretHint') }}</div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="editorVisible = false">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="saving" @click="emit('save')">
        {{ t('common.save') }}
      </el-button>
    </template>
  </el-drawer>

  <el-drawer
    v-model="detailVisible"
    :append-to-body="true"
    :title="t('workerManagement.channelDetailTitle')"
    size="640px"
  >
    <el-descriptions v-if="detailRow" :column="isMobile ? 1 : 2" border size="small">
      <el-descriptions-item :label="t('workerManagement.channelCodeLabel')">
        {{ detailRow.channelCode }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('workerManagement.channelTypeLabel')">
        {{ detailRow.channelType }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('workerManagement.channelColEnabled')">
        {{ detailRow.enabled ? t('workerManagement.yes') : t('workerManagement.no') }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('workerManagement.channelColTimeout')">
        {{ detailRow.timeoutSeconds ?? '—' }}
      </el-descriptions-item>
      <el-descriptions-item
        :label="t('workerManagement.channelColUpdated')"
        :span="isMobile ? 1 : 2"
      >
        {{ detailRow.updatedAt || '—' }}
      </el-descriptions-item>
      <el-descriptions-item
        :label="t('workerManagement.channelDetailRawResponse')"
        :span="isMobile ? 1 : 2"
      >
        <JsonPreview :data="detailRow" />
      </el-descriptions-item>
    </el-descriptions>
  </el-drawer>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import { useResponsive } from '@/composables/useResponsive'
  import CodeNameBuilder from '@/components/common/CodeNameBuilder.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import JsonTextareaInput from '@/components/common/JsonTextareaInput.vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'
  import type { ConsoleFileChannelResponse } from '@/types/console-api'

  interface FileChannelForm {
    channelCode: string
    channelName: string
    channelType: string
    targetEndpoint: string
    authType: string
    configJson: string
    receiptPolicy: string
    timeoutSeconds: number
    enabled: boolean
  }

  defineProps<{
    editingId: number | null
    saving: boolean
    detailRow: ConsoleFileChannelResponse | null
    form: FileChannelForm
  }>()
  const editorVisible = defineModel<boolean>('editorVisible', { required: true })
  const detailVisible = defineModel<boolean>('detailVisible', { required: true })
  const emit = defineEmits<{ save: [] }>()
  const { t } = useI18n({ useScope: 'global' })
  const { isMobile } = useResponsive()
</script>
