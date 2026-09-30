<template>
  <div v-if="visible" class="ai-launcher">
    <el-tooltip :content="t('aiPanel.open')" placement="bottom">
      <button
        ref="trigger"
        type="button"
        class="ai-launcher__button"
        :aria-label="t('aiPanel.open')"
        @click="openPanel"
      >
        <Sparkles :size="18" aria-hidden="true" />
      </button>
    </el-tooltip>
    <el-drawer
      v-model="open"
      append-to-body
      direction="rtl"
      :modal="false"
      :size="mobile ? '100%' : 'min(440px, 100vw)'"
      :title="t('aiPanel.title')"
      class="ai-assistant-drawer"
      @closed="trigger?.focus()"
    >
      <div class="ai-panel">
        <el-segmented v-model="mode" :options="modeOptions" :disabled="chat.sending.value" />
        <div v-if="mode === 'page'" class="ai-panel__context">
          <span>{{ t('aiPanel.pageContext', { page: capturedPageLabel }) }}</span>
          <el-button v-if="contextStale" text type="primary" @click="capturePage">{{
            t('aiPanel.updateContext')
          }}</el-button>
        </div>
        <div v-if="!chat.messages.value.length" class="ai-panel__empty">
          {{ t('aiPanel.empty') }}
        </div>
        <div v-else class="ai-panel__messages" aria-live="polite">
          <div
            v-for="message in chat.messages.value"
            :key="message.id"
            class="ai-panel__message"
            :class="`ai-panel__message--${message.role}`"
          >
            <strong>{{
              message.role === 'user' ? t('aiChat.bubbleMe') : t('aiChat.bubbleAi')
            }}</strong>
            <span>{{ message.content }}</span>
            <small v-if="message.refusalReason">{{ message.refusalReason }}</small>
          </div>
        </div>
        <div class="ai-panel__composer">
          <div v-if="chat.sendError.value" class="ai-panel__error" role="alert">
            {{ t('aiChat.sendError') }}
          </div>
          <el-input
            ref="input"
            v-model="chat.prompt.value"
            type="textarea"
            :rows="4"
            :placeholder="t('aiChat.inputPlaceholder')"
            :aria-label="t('aiChat.promptLabel')"
          />
          <div class="ai-panel__actions">
            <el-button :icon="Plus" :aria-label="t('aiChat.btnNewSession')" @click="chat.reset()" />
            <el-button
              type="primary"
              :loading="chat.sending.value"
              :disabled="!chat.prompt.value.trim()"
              @click="send"
            >
              {{ t('aiChat.btnSend') }}
            </el-button>
          </div>
          <RouterLink v-if="!mobile" to="/system/ai-chat" @click="open = false">{{
            t('aiPanel.fullPage')
          }}</RouterLink>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
  import { computed, nextTick, ref } from 'vue'
  import { useRoute } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { Plus, Sparkles } from '@lucide/vue'
  import type { InputInstance } from 'element-plus'
  import { useAiChatSession } from '@/composables/useAiChatSession'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useAuthStore } from '@/stores/auth'
  import { useTenantStore } from '@/stores/tenant'
  import { aiPageLabelKey, aiPageType } from '@/utils/aiPageContext'

  defineProps<{ mobile?: boolean }>()
  const { t } = useI18n({ useScope: 'global' })
  const auth = useAuthStore()
  const tenant = useTenantStore()
  const route = useRoute()
  const chat = useAiChatSession()
  const trigger = ref<HTMLElement | null>(null)
  const input = ref<InputInstance | null>(null)
  const open = ref(false)
  const mode = ref<'system' | 'page'>('system')
  const capturedPageType = ref<string | undefined>()
  const capturedPageLabel = computed(() => {
    const key = aiPageLabelKey(capturedPageType.value)
    return key ? t(key) : t('aiPanel.noPageContext')
  })
  const visible = computed(
    () => auth.isLoggedIn && auth.hasPermission('ROLE_ADMIN') && Boolean(tenant.tenantId),
  )
  const currentPageType = computed(() => aiPageType(route.name))
  const contextStale = computed(
    () => mode.value === 'page' && currentPageType.value !== capturedPageType.value,
  )
  const modeOptions = computed(() => [
    { label: t('aiPanel.systemMode'), value: 'system' },
    { label: t('aiPanel.pageMode'), value: 'page', disabled: !currentPageType.value },
  ])

  function capturePage() {
    capturedPageType.value = currentPageType.value
    if (!capturedPageType.value) mode.value = 'system'
  }

  function openPanel() {
    capturePage()
    open.value = true
    void nextTick(() => input.value?.focus())
  }

  async function send() {
    await chat.send(
      t('aiChat.emptyAnswer'),
      mode.value === 'page' ? capturedPageType.value : undefined,
    )
  }

  useTenantReload(() => {
    chat.reset()
    open.value = false
  })
</script>

<style scoped>
  .ai-launcher__button {
    display: inline-grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border: 0;
    border-radius: var(--radius-button);
    color: var(--color-text-secondary);
    background: transparent;
    cursor: pointer;
  }
  .ai-launcher__button:hover {
    color: var(--color-primary);
    background: var(--color-fill-light);
  }
  .ai-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    gap: var(--space-md);
    padding-bottom: env(safe-area-inset-bottom);
  }
  .ai-panel__context {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }
  .ai-panel__empty {
    flex: 1;
    display: grid;
    place-items: center;
    color: var(--color-text-tertiary);
  }
  .ai-panel__messages {
    flex: 1;
    min-height: 0;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }
  .ai-panel__message {
    display: grid;
    gap: var(--space-xs);
    max-width: 90%;
    padding: var(--space-sm);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .ai-panel__message--user {
    align-self: flex-end;
    background: var(--color-fill-light);
  }
  .ai-panel__message--assistant {
    align-self: flex-start;
    background: var(--color-bg-card);
  }
  .ai-panel__message strong,
  .ai-panel__message small {
    font-size: var(--font-size-sm);
  }
  .ai-panel__composer {
    display: grid;
    gap: var(--space-sm);
  }
  .ai-panel__actions {
    display: flex;
    justify-content: space-between;
  }
  .ai-panel__error {
    color: var(--color-danger);
    font-size: var(--font-size-sm);
  }
</style>
