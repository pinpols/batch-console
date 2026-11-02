<template>
  <el-popover
    ref="popoverRef"
    :width="`min(${popoverWidth}px, calc(100vw - 24px))`"
    :placement="resolvedPlacement"
    :popper-options="viewportPopperOptions"
    :trigger="['hover', 'click']"
    :show-after="180"
    :hide-after="120"
    :focus-on-target="true"
    :teleported="true"
    popper-class="json-preview-popover"
    @before-enter="onOpen"
    @before-leave="popoverOpen = false"
    @after-leave="onClose"
  >
    <template #reference>
      <button
        ref="triggerRef"
        class="json-preview-popover__trigger"
        type="button"
        :aria-label="t('common.viewJson')"
        @keydown.esc="onEscape"
      >
        <el-icon :size="16"><Eye /></el-icon>
      </button>
    </template>
    <div class="json-preview-popover__content" @keydown.esc="onEscape">
      <JsonPreview :data="data" />
    </div>
  </el-popover>
</template>

<script setup lang="ts">
  import { ElIcon, ElPopover, type PopoverInstance } from 'element-plus'
  import { Eye } from '@lucide/vue'
  import { onBeforeUnmount, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { BP } from '@/constants/breakpoints'
  import JsonPreview from './JsonPreview.vue'

  const props = withDefaults(
    defineProps<{
      data: unknown
      popoverWidth?: number
      placement?:
        | 'top'
        | 'top-start'
        | 'top-end'
        | 'bottom'
        | 'bottom-start'
        | 'bottom-end'
        | 'left'
        | 'right'
    }>(),
    { popoverWidth: 560, placement: 'left' },
  )

  const { t } = useI18n({ useScope: 'global' })
  const popoverRef = ref<PopoverInstance>()
  const triggerRef = ref<HTMLButtonElement>()
  const popoverOpen = ref(false)
  const resolvedPlacement = ref(props.placement)
  const viewportPopperOptions = {
    modifiers: [{ name: 'preventOverflow', options: { padding: 12 } }],
  }

  function updatePlacement() {
    resolvedPlacement.value = window.innerWidth <= BP.sm ? 'bottom' : props.placement
  }

  function onOpen() {
    popoverOpen.value = true
    updatePlacement()
    window.addEventListener('resize', updatePlacement, { passive: true })
  }

  function onClose() {
    window.removeEventListener('resize', updatePlacement)
  }

  function onEscape(event: KeyboardEvent) {
    if (!popoverOpen.value) return
    event.stopPropagation()
    popoverRef.value?.hide()
    triggerRef.value?.focus()
  }

  onBeforeUnmount(onClose)
</script>

<style scoped>
  .json-preview-popover__trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    padding: 0;
    border: 1px solid var(--color-border-light);
    border-radius: 6px;
    background: var(--color-bg-subtle);
    color: var(--color-text-secondary);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }

  .json-preview-popover__trigger:hover,
  .json-preview-popover__trigger:focus-visible {
    border-color: var(--color-primary);
    color: var(--color-primary);
    outline: none;
  }
</style>
