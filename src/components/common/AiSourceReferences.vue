<template>
  <div v-if="sources.length" class="ai-sources" :aria-label="t('aiChat.sources')">
    <span class="ai-sources__label">{{ t('aiChat.sources') }}</span>
    <el-tag v-for="source in sources" :key="source.source" size="small" effect="plain">
      {{ source.source }}
    </el-tag>
  </div>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import type { AiChatResponse } from '@/types/console-api'

  defineProps<{ sources: AiChatResponse['sources'] }>()
  const { t } = useI18n({ useScope: 'global' })
</script>

<style scoped>
  .ai-sources {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-xs);
    margin-top: var(--space-xs);
  }

  .ai-sources__label {
    color: var(--color-text-tertiary);
    font-size: var(--font-size-sm);
  }
</style>
