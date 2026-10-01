<template>
  <div v-if="chat.imageCapabilities.value?.imageInput" class="ai-images">
    <input
      ref="fileInput"
      class="ai-images__file"
      type="file"
      accept="image/png,image/jpeg,image/webp"
      multiple
      @change="onFileChange"
    />
    <el-tooltip :content="t('aiChat.addImage')">
      <el-button
        :icon="ImagePlus"
        :disabled="disabled"
        :aria-label="t('aiChat.addImage')"
        @click="fileInput?.click()"
      />
    </el-tooltip>
    <span class="ai-images__notice">{{ t('aiChat.imageProviderNotice') }}</span>
    <div v-if="chat.images.value.length" class="ai-images__list">
      <div
        v-for="image in chat.images.value"
        :key="image.clientAttachmentId"
        class="ai-images__item"
      >
        <button
          type="button"
          class="ai-images__preview"
          :aria-label="t('aiChat.previewImage', { name: image.name })"
          @click="previewUrl = image.previewUrl"
        >
          <img :src="image.previewUrl" :alt="image.name" />
        </button>
        <div class="ai-images__detail">
          <span class="ai-images__name" :title="image.name">{{ image.name }}</span>
          <small>{{ statusLabel(image.status) }}</small>
        </div>
        <el-button
          text
          :icon="X"
          :disabled="disabled"
          :aria-label="t('aiChat.removeImage', { name: image.name })"
          @click="chat.removeImage(image)"
        />
      </div>
    </div>
    <el-dialog
      v-model="previewOpen"
      :title="t('aiChat.imagePreviewTitle')"
      width="min(90vw, 42rem)"
    >
      <img
        v-if="previewUrl"
        class="ai-images__large"
        :src="previewUrl"
        :alt="t('aiChat.imagePreviewTitle')"
      />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ImagePlus, X } from '@lucide/vue'
  import type { AiImageDraft, useAiChatSession } from '@/composables/useAiChatSession'

  const props = defineProps<{ chat: ReturnType<typeof useAiChatSession>; disabled?: boolean }>()
  const { t } = useI18n({ useScope: 'global' })
  const fileInput = ref<HTMLInputElement | null>(null)
  const previewUrl = ref('')
  const previewOpen = computed({
    get: () => Boolean(previewUrl.value),
    set: (value: boolean) => {
      if (!value) previewUrl.value = ''
    },
  })

  function statusLabel(status: AiImageDraft['status']) {
    return t(`aiChat.imageStatus.${status}`)
  }

  function onFileChange(event: Event) {
    const input = event.target as HTMLInputElement
    void props.chat.addImages(Array.from(input.files ?? []))
    input.value = ''
  }

  function onPaste(event: ClipboardEvent) {
    if (props.disabled) return
    const files = Array.from(event.clipboardData?.items ?? [])
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file != null)
    if (!files.length) return
    event.preventDefault()
    void props.chat.addImages(files)
  }

  function onDrop(event: DragEvent) {
    if (props.disabled) return
    const files = Array.from(event.dataTransfer?.files ?? []).filter((file) =>
      file.type.startsWith('image/'),
    )
    if (!files.length) return
    event.preventDefault()
    void props.chat.addImages(files)
  }

  function onDragOver(event: DragEvent) {
    if (!props.disabled && event.dataTransfer?.types.includes('Files')) event.preventDefault()
  }

  defineExpose({ onPaste, onDrop, onDragOver })
</script>

<style scoped>
  .ai-images {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-xs);
  }
  .ai-images__file {
    display: none;
  }
  .ai-images__notice {
    color: var(--color-text-tertiary);
    font-size: var(--font-size-sm);
  }
  .ai-images__list {
    display: flex;
    flex-basis: 100%;
    flex-wrap: wrap;
    gap: var(--space-xs);
  }
  .ai-images__item {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    max-width: 100%;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
    padding: var(--space-xs);
  }
  .ai-images__preview {
    width: 3.5rem;
    height: 3.5rem;
    flex: none;
    border: 0;
    padding: 0;
    background: transparent;
    cursor: pointer;
  }
  .ai-images__preview img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: var(--radius-content);
  }
  .ai-images__detail {
    display: grid;
    min-width: 0;
    max-width: 10rem;
  }
  .ai-images__name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ai-images__detail small {
    color: var(--color-text-tertiary);
  }
  .ai-images__large {
    display: block;
    max-width: 100%;
    max-height: 70vh;
    margin: auto;
    object-fit: contain;
  }
</style>
