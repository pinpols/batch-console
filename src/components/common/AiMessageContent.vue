<template>
  <div
    class="ai-message-content"
    :class="{ 'ai-message-content--plain': role === 'user' }"
    @click="copyCode"
  >
    <div
      v-if="role === 'assistant' && !streaming && markdownHtml"
      v-safe-html="markdownHtml"
      class="ai-message-content__markdown"
    />
    <span v-else>{{ content }}</span>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, shallowRef } from 'vue'
  import { ElMessage } from 'element-plus'
  import { useI18n } from 'vue-i18n'

  const props = defineProps<{ content: string; role: 'user' | 'assistant'; streaming?: boolean }>()
  const { t } = useI18n({ useScope: 'global' })
  const render = shallowRef<((content: string, copyLabel: string) => string) | null>(null)
  const markdownHtml = computed(() => render.value?.(props.content, t('aiChat.copyCode')) ?? '')

  onMounted(async () => {
    if (props.role !== 'assistant') return
    try {
      const module = await import('@/utils/aiMarkdown')
      render.value = module.renderAiMarkdown
    } catch {
      // Keep the plain-text answer visible if the optional Markdown chunk cannot load.
    }
  })

  async function copyCode(event: MouseEvent) {
    const target = event.target
    const root = event.currentTarget
    if (!(target instanceof Element) || !(root instanceof HTMLElement)) return
    const button = target.closest<HTMLButtonElement>('[data-ai-copy-code]')
    if (!button || !root.contains(button)) return
    const code = button.closest('.ai-markdown__code')?.querySelector('code')?.textContent
    if (code == null) return
    try {
      await navigator.clipboard.writeText(code)
      ElMessage.success(t('aiChat.codeCopied'))
    } catch {
      ElMessage.error(t('aiChat.codeCopyFailed'))
    }
  }
</script>

<style scoped>
  .ai-message-content {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .ai-message-content--plain,
  .ai-message-content > span {
    white-space: pre-wrap;
  }
  .ai-message-content__markdown {
    white-space: normal;
  }
  .ai-message-content__markdown :deep(:first-child) {
    margin-top: 0;
  }
  .ai-message-content__markdown :deep(:last-child) {
    margin-bottom: 0;
  }
  .ai-message-content__markdown :deep(.ai-markdown__code) {
    max-width: 100%;
    margin-block: var(--space-sm);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
    overflow: hidden;
    background: var(--color-fill-light);
  }
  .ai-message-content__markdown :deep(.ai-markdown__code-head) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-xs) var(--space-sm);
    border-bottom: 1px solid var(--color-border-light);
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }
  .ai-message-content__markdown :deep(.ai-markdown__code-head button) {
    border: 0;
    padding: 0;
    background: transparent;
    color: var(--color-primary);
    cursor: pointer;
    font: inherit;
  }
  .ai-message-content__markdown :deep(pre) {
    margin: 0;
    padding: var(--space-sm);
    overflow-x: auto;
    white-space: pre;
  }
  .ai-message-content__markdown :deep(code) {
    font-family: var(--font-family-mono);
  }
  .ai-message-content__markdown :deep(a) {
    overflow-wrap: anywhere;
  }
</style>
