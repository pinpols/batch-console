<template>
  <div class="ai-attachment">
    <input
      ref="input"
      class="ai-attachment__input"
      type="file"
      accept=".txt,.md,.log"
      :aria-label="t('aiChat.attachText')"
      @change="selectFile"
    />
    <el-button
      v-if="!modelValue"
      :icon="Paperclip"
      text
      :disabled="disabled"
      @click="input?.click()"
    >
      {{ t('aiChat.attachText') }}
    </el-button>
    <div v-else class="ai-attachment__selected">
      <span :title="modelValue.name">{{ modelValue.name }}</span>
      <el-button
        :icon="X"
        text
        :disabled="disabled"
        :aria-label="t('aiChat.removeAttachment')"
        @click="emit('update:modelValue', null)"
      />
    </div>
    <span v-if="error" class="ai-attachment__error" role="alert">{{
      t(`aiChat.attachmentError.${error}`)
    }}</span>
    <small v-if="modelValue" class="ai-attachment__note">{{
      t('aiChat.attachmentRetention')
    }}</small>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { Paperclip, X } from '@lucide/vue'
  import {
    AiTextAttachmentError,
    readAiTextAttachment,
    type AiTextAttachment,
  } from '@/utils/aiTextAttachment'

  defineProps<{ modelValue: AiTextAttachment | null; disabled?: boolean }>()
  const emit = defineEmits<{ 'update:modelValue': [value: AiTextAttachment | null] }>()
  const { t } = useI18n({ useScope: 'global' })
  const input = ref<HTMLInputElement | null>(null)
  const error = ref<AiTextAttachmentError['reason'] | null>(null)

  async function selectFile(event: Event) {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    target.value = ''
    if (!file) return
    try {
      const result = await readAiTextAttachment(file)
      emit('update:modelValue', result)
      error.value = null
    } catch (cause) {
      error.value = cause instanceof AiTextAttachmentError ? cause.reason : 'encoding'
    }
  }
</script>

<style scoped>
  .ai-attachment {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-xs);
  }
  .ai-attachment__input {
    display: none;
  }
  .ai-attachment__selected {
    display: flex;
    align-items: center;
    min-width: 0;
    max-width: 100%;
  }
  .ai-attachment__selected span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ai-attachment__error {
    color: var(--color-danger);
    font-size: var(--font-size-sm);
  }
  .ai-attachment__note {
    flex-basis: 100%;
    color: var(--color-text-secondary);
  }
</style>
