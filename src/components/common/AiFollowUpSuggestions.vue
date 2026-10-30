<template>
  <div v-if="question && !hasDraft" class="ai-follow-ups">
    <el-button text size="small" @click="choose('next')">{{ t('aiChat.followUpNext') }}</el-button>
    <el-button text size="small" @click="choose('evidence')">{{
      t('aiChat.followUpEvidence')
    }}</el-button>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import type { AiChatMessage } from '@/composables/useAiChatSession'

  const props = defineProps<{ messages: AiChatMessage[]; hasDraft?: boolean }>()
  const emit = defineEmits<{ select: [value: string] }>()
  const { t } = useI18n({ useScope: 'global' })
  const question = computed(() => {
    const last = props.messages.at(-1)
    const lastAssistantTurnAllowsFollowUp =
      last?.role === 'assistant' && last.status === 'COMPLETE' && last.decision === 'APPROVED'
    if (!lastAssistantTurnAllowsFollowUp) return ''
    const newestFirstMessages = [...props.messages].reverse()
    const latestUserMessage = newestFirstMessages.find((item) => item.role === 'user')
    const questionExcerpt = latestUserMessage?.content.slice(0, 120) ?? ''
    return questionExcerpt
  })

  function choose(kind: 'next' | 'evidence') {
    emit(
      'select',
      t(kind === 'next' ? 'aiChat.followUpNextPrompt' : 'aiChat.followUpEvidencePrompt', {
        question: question.value,
      }),
    )
  }
</script>

<style scoped>
  .ai-follow-ups {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
  }
</style>
