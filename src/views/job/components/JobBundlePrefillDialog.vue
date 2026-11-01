<template>
        <el-dialog
          v-model="visible"
          :title="t('jobDefinitionWizard.prefillDialogTitle')"
          width="640px"
          append-to-body
          :close-on-click-modal="false"
        >
          <el-alert type="info" :closable="false" show-icon class="prefill-dialog__hint">
            <template #title>
              <div class="prefill-hint">
                <div>
                  {{ t('jobDefinitionWizard.prefillSourcePrefix') }}
                  <el-link type="primary" underline="never" @click="emit('source')">
                    {{ t('jobDefinitionWizard.prefillSourceJobList') }}
                  </el-link>
                  {{ t('jobDefinitionWizard.prefillSourceMiddle') }}
                  <strong>{{ t('jobDefinitionWizard.prefillExportBundle') }}</strong>
                  {{ t('jobDefinitionWizard.prefillSourceSuffix') }}
                  <code>job-bundle-&lt;jobCode&gt;.json</code>
                </div>
                <div class="prefill-hint__sub">
                  {{ t('jobDefinitionWizard.prefillSourceHint') }}
                </div>
              </div>
            </template>
          </el-alert>
          <JsonTextareaInput
            v-model="json"
            :rows="10"
            expect="object"
            :placeholder="t('jobDefinitionWizard.bundlePrefillJsonPlaceholder')"
          />
          <template #footer>
            <el-button @click="visible = false">{{ t('common.cancel') }}</el-button>
            <el-button
              type="primary"
              :disabled="!json.trim()"
              @click="emit('apply')"
            >
              {{ t('jobDefinitionWizard.prefillConfirm') }}
            </el-button>
          </template>
        </el-dialog>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import JsonTextareaInput from '@/components/common/JsonTextareaInput.vue'

  const visible = defineModel<boolean>({ required: true })
  const json = defineModel<string>('json', { required: true })
  const emit = defineEmits<{ source: []; apply: [] }>()
  const { t } = useI18n({ useScope: 'global' })
</script>

<style scoped>
  .prefill-dialog__hint {
    margin-bottom: 12px;
  }

  .prefill-hint {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-weight: 400;
    line-height: 1.5;
  }
  .prefill-hint code {
    background: var(--color-bg-page);
    padding: 0 4px;
    border-radius: 3px;
    font-family: 'SF Mono', Monaco, monospace;
    font-size: 12px;
  }
  .prefill-hint__sub {
    font-size: 12px;
    color: var(--color-text-tertiary);
  }

  .prefill-dialog__textarea :deep(.el-textarea__inner) {
    font-family: var(--font-family-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    font-size: 12px;
    line-height: 1.55;
  }

</style>
