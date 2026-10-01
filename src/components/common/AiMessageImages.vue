<template>
  <div v-if="images.length" ref="root" class="ai-message-images">
    <button
      v-for="image in images"
      :key="image.id"
      type="button"
      class="ai-message-images__item"
      :aria-label="t('aiChat.imagePreviewTitle')"
      @click="openPreview(image.id)"
    >
      <img
        v-if="urls.get(image.id)"
        :src="urls.get(image.id)"
        :alt="t('aiChat.imagePreviewTitle')"
      />
      <ImageIcon v-else :size="22" aria-hidden="true" />
    </button>
    <el-dialog
      v-model="previewOpen"
      :title="t('aiChat.imagePreviewTitle')"
      width="min(90vw, 42rem)"
    >
      <img
        v-if="previewId && urls.get(previewId)"
        class="ai-message-images__large"
        :src="urls.get(previewId)"
        :alt="t('aiChat.imagePreviewTitle')"
      />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { Image as ImageIcon } from '@lucide/vue'
  import { getAiAttachmentContent, type AiAttachmentSummary } from '@/api/ai'

  const props = defineProps<{ images: AiAttachmentSummary[] }>()
  const { t } = useI18n({ useScope: 'global' })
  const root = ref<HTMLElement | null>(null)
  const urls = reactive(new Map<string, string>())
  const pending = new Set<string>()
  const previewId = ref('')
  const previewOpen = computed({
    get: () => Boolean(previewId.value),
    set: (value: boolean) => {
      if (!value) previewId.value = ''
    },
  })
  let observer: IntersectionObserver | null = null
  let disposed = false

  async function load(id: string) {
    if (urls.has(id) || pending.has(id)) return
    pending.add(id)
    try {
      const blob = await getAiAttachmentContent(id).catch(() => null)
      if (!blob || disposed || !props.images.some((image) => image.id === id)) return
      urls.set(id, URL.createObjectURL(blob))
    } finally {
      pending.delete(id)
    }
  }

  function openPreview(id: string) {
    previewId.value = id
    void load(id)
  }

  onMounted(() => {
    if (!root.value) return
    if (!('IntersectionObserver' in window)) {
      props.images.forEach((image) => void load(image.id))
      return
    }
    observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        props.images.forEach((image) => void load(image.id))
        observer?.disconnect()
      }
    })
    observer.observe(root.value)
  })

  watch(
    () => props.images,
    (next) => {
      for (const [id, url] of urls) {
        if (!next.some((image) => image.id === id)) {
          URL.revokeObjectURL(url)
          urls.delete(id)
        }
      }
    },
  )

  onBeforeUnmount(() => {
    disposed = true
    observer?.disconnect()
    urls.forEach((url) => URL.revokeObjectURL(url))
    urls.clear()
  })
</script>

<style scoped>
  .ai-message-images {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
  }
  .ai-message-images__item {
    display: grid;
    place-items: center;
    width: 4rem;
    height: 4rem;
    padding: 0;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
    background: var(--color-fill-light);
    color: var(--color-text-secondary);
    cursor: pointer;
    overflow: hidden;
  }
  .ai-message-images__item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .ai-message-images__large {
    display: block;
    max-width: 100%;
    max-height: 70vh;
    margin: auto;
    object-fit: contain;
  }
</style>
