<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    :title="t('workflowDefinitionList.triggerTitle')"
    width="min(440px, calc(100% - 32px))"
  >
    <el-form label-position="top">
      <el-form-item :label="t('workflowDefinitionList.triggerBizDate')" required>
        <el-date-picker
          :model-value="bizDate"
          @update:model-value="emit('update:bizDate', $event)"
          type="date"
          value-format="YYYY-MM-DD"
          :placeholder="t('workflowDefinitionList.triggerBizDatePlaceholder')"
          class="w-full"
        />
      </el-form-item>
      <el-alert :title="t('workflowDefinitionList.triggerHint')" type="info" :closable="false" />
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">{{ t('common.cancel') }}</el-button>
      <el-button
        type="primary"
        :icon="Play"
        :loading="busy"
        :disabled="!bizDate"
        @click="emit('submit')"
      >
        {{ t('workflowDefinitionList.actionTrigger') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import { Play } from '@lucide/vue'

  defineProps<{ modelValue: boolean; bizDate: string; busy: boolean }>()
  const emit = defineEmits<{
    'update:modelValue': [value: boolean]
    'update:bizDate': [value: string]
    submit: []
  }>()
  const { t } = useI18n({ useScope: 'global' })
</script>
