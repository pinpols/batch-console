<template>
  <section class="attention" :aria-label="t('opsToday.attentionTitle')">
    <header class="attention__head">
      <h2>{{ t('opsToday.attentionTitle') }}</h2>
      <span v-if="items.length">{{ t('opsToday.attentionHint') }}</span>
    </header>
    <p v-if="items.length === 0" class="attention__clear">
      <span class="attention__ok" aria-hidden="true" />{{ t('opsToday.attentionClear') }}
    </p>
    <ul v-else class="attention__list">
      <li v-for="item in items" :key="item.key">
        <button
          type="button"
          class="attention__item"
          :class="`is-${item.tone}`"
          @click="emit('open', item.action)"
        >
          <span class="attention__text">
            {{ t(`opsToday.attention.${item.key}`, { count: item.count }) }}
          </span>
          <span class="attention__action">{{ t(`opsToday.attentionAction.${item.key}`) }}</span>
        </button>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { buildAttentionItems, type AttentionAction, type AttentionSummary } from '../attention'

  const props = defineProps<{ summary: AttentionSummary }>()
  const emit = defineEmits<{ open: [action: AttentionAction] }>()
  const { t } = useI18n()

  const items = computed(() => buildAttentionItems(props.summary))
</script>

<style scoped>
  .attention {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-content);
  }

  .attention__head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 12px;
    padding: 14px 18px;
    border-bottom: 1px solid var(--color-border-light);
  }

  .attention__head h2 {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
  }

  .attention__head span {
    color: var(--color-text-tertiary);
    font-size: var(--font-size-sm);
  }

  .attention__clear {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    padding: 14px 18px;
    color: var(--color-text-secondary);
  }

  .attention__ok {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-success);
    flex-shrink: 0;
  }

  .attention__list {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .attention__list li + li {
    border-top: 1px solid var(--color-border-light);
  }

  .attention__item {
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
    padding: 11px 18px 11px 15px;
    border: 0;
    border-left: 3px solid transparent;
    background: transparent;
    color: var(--color-text-primary);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .attention__item:hover {
    background: var(--table-row-hover-bg);
  }

  .attention__item:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
  }

  .attention__item.is-danger {
    border-left-color: var(--color-danger);
  }

  .attention__item.is-warning {
    border-left-color: var(--color-warning);
  }

  .attention__text {
    flex: 1;
    font-weight: 600;
  }

  .attention__action {
    color: var(--color-primary);
    font-size: var(--font-size-sm);
    font-weight: 600;
    white-space: nowrap;
  }
</style>
