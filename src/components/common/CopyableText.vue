<template>
  <span class="copyable-text">
    <span
      v-if="!iconOnly"
      class="copyable-text__value"
      :class="{ 'copyable-text__value--copyable': text && copyOnClick && copyable }"
      :role="$slots.default || !copyOnClick || !copyable || !text ? undefined : 'button'"
      :tabindex="$slots.default || !copyOnClick || !copyable || !text ? undefined : 0"
      @click="text && copyOnClick && copyable && copy()"
      @keydown="onValueKeydown"
      ><slot>{{ text }}</slot></span
    >
    <el-popover
      v-if="text"
      ref="popoverRef"
      trigger="click"
      placement="top"
      width="min(420px, calc(100vw - 32px))"
      @before-enter="popoverOpen = true"
      @before-leave="popoverOpen = false"
      @after-enter="onPopoverOpened"
    >
      <template #reference>
        <button
          type="button"
          ref="triggerRef"
          class="copyable-text__inspect"
          :aria-label="t('common.viewFullValue')"
          @click.stop
          @keydown.esc="onEscape"
        >
          <el-icon class="copyable-text__icon"><Eye /></el-icon>
        </button>
      </template>
      <div
        ref="detailsRef"
        class="copyable-text__details"
        @click.stop
        @keydown.esc="onEscape"
        @keydown.tab="onDetailsTab"
        @focusout="onDetailsFocusOut"
      >
        <div
          ref="valueRef"
          class="copyable-text__full-value"
          role="region"
          :aria-label="t('common.viewFullValue')"
          tabindex="0"
        >
          {{ text }}
        </div>
        <el-button v-if="copyable" class="copyable-text__copy" size="small" @click.stop="copy">
          {{ t('common.copy') }}
        </el-button>
      </div>
    </el-popover>
  </span>
</template>

<script setup lang="ts">
  import { Eye } from '@lucide/vue'
  import { nextTick, ref } from 'vue'
  import { isTabbable, tabbable } from 'tabbable'
  import type { PopoverInstance } from 'element-plus'
  import { useI18n } from 'vue-i18n'
  import { useCopy } from '@/composables/useCopy'

  const props = withDefaults(
    defineProps<{ text: string; iconOnly?: boolean; copyOnClick?: boolean; copyable?: boolean }>(),
    {
      copyOnClick: true,
      copyable: true,
    },
  )
  const { t } = useI18n({ useScope: 'global' })
  const { copy: copyText } = useCopy()
  const popoverRef = ref<PopoverInstance>()
  const triggerRef = ref<HTMLButtonElement>()
  const detailsRef = ref<HTMLElement>()
  const valueRef = ref<HTMLElement>()
  const popoverOpen = ref(false)
  const focusScopeSelector =
    '[role="dialog"], [role="alertdialog"], .el-popper, dialog, [aria-modal]'
  function onPopoverOpened() {
    if (document.activeElement === triggerRef.value) valueRef.value?.focus()
  }
  function onDetailsFocusOut(event: FocusEvent) {
    const next = event.relatedTarget
    if (next instanceof Node && next !== triggerRef.value && !detailsRef.value?.contains(next)) {
      popoverRef.value?.hide()
    }
  }
  function findFocusScope(trigger: HTMLElement): HTMLElement | null {
    const scope = trigger.closest<HTMLElement>(focusScopeSelector)
    if (!scope) return document.body
    const knownModal =
      '.el-overlay-dialog[role="dialog"][aria-modal="true"], .el-drawer[role="dialog"][aria-modal="true"]'
    if (!scope.matches(knownModal) || scope.closest('.is-penetrable')) return null
    return scope
  }
  function onDetailsTab(event: KeyboardEvent) {
    const details = detailsRef.value
    const trigger = triggerRef.value
    if (event.altKey || event.ctrlKey || event.metaKey || !details || !trigger) return
    const current = document.activeElement
    const controls = tabbable(details)
    if (event.shiftKey && current !== controls[0]) return
    if (!event.shiftKey && current !== controls.at(-1)) return
    const scope = findFocusScope(trigger)
    if (!scope) return
    let target: HTMLElement | SVGElement | undefined
    if (event.shiftKey) {
      if (!scope.contains(trigger) || !isTabbable(trigger)) return
      target = trigger
    } else {
      const popper = details.closest('.el-popper')
      const targets = tabbable(scope).filter((element) => !popper?.contains(element))
      const index = targets.indexOf(trigger)
      if (index < 0) return
      target = targets[index + 1] ?? (scope !== document.body ? targets[0] : undefined)
    }
    if (!target) return
    const targetScope = target.closest(focusScopeSelector)
    if (scope === document.body ? !!targetScope : targetScope !== scope) return
    event.preventDefault()
    event.stopPropagation()
    popoverRef.value?.hide()
    void nextTick(() => {
      const active = document.activeElement
      if (active !== current && active !== trigger) return
      if (!scope.isConnected || !scope.contains(target) || !isTabbable(target)) return
      const currentScope = target.closest(focusScopeSelector)
      if (scope === document.body ? !!currentScope : currentScope !== scope) return
      target.focus()
    })
  }
  function onEscape(event: KeyboardEvent) {
    if (!popoverOpen.value) return
    event.stopPropagation()
    popoverRef.value?.hide()
    triggerRef.value?.focus()
  }
  function copy() {
    void copyText(props.text)
  }
  function onValueKeydown(event: KeyboardEvent) {
    if (
      props.text &&
      props.copyOnClick &&
      props.copyable &&
      event.target === event.currentTarget &&
      (event.key === 'Enter' || event.key === ' ')
    ) {
      event.preventDefault()
      copy()
    }
  }
</script>

<style scoped>
  .copyable-text {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: 100%;
    min-width: 0;
  }

  .copyable-text__value {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .copyable-text__value--copyable {
    cursor: pointer;
  }

  .copyable-text__value :deep(a) {
    display: inline-block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: bottom;
  }

  .copyable-text__inspect {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    min-width: 24px;
    min-height: 24px;
    padding: 3px;
    border: 0;
    border-radius: var(--el-border-radius-base);
    color: var(--el-text-color-secondary);
    background: transparent;
    cursor: pointer;
  }

  .copyable-text__inspect:hover,
  .copyable-text__inspect:focus-visible {
    color: var(--el-color-primary);
  }

  /* 表格内每行都常驻眼睛图标会形成噪点：桌面指针设备上仅在行悬停、自身获得焦点或浮层打开时显示，
     触屏设备无悬停，保持常显 */
  @media (hover: hover) and (pointer: fine) {
    /* scoped 只给末段加属性，祖先 .el-table__row 可直接写 */
    .el-table__row .copyable-text__inspect {
      opacity: 0;
      transition: opacity 0.12s ease;
    }

    .el-table__row:hover .copyable-text__inspect,
    .el-table__row .copyable-text__inspect:focus-visible,
    .el-table__row .copyable-text__inspect[aria-expanded='true'] {
      opacity: 1;
    }
  }

  .copyable-text__inspect:focus-visible,
  .copyable-text__value:focus-visible,
  .copyable-text__full-value:focus-visible {
    outline: 2px solid var(--el-color-primary);
    outline-offset: 2px;
  }

  .copyable-text__icon {
    font-size: 14px;
  }

  .copyable-text__full-value {
    overflow-wrap: anywhere;
    white-space: pre-wrap;
    max-height: 40vh;
    overflow-y: auto;
    user-select: text;
  }

  .copyable-text__copy {
    margin-top: 8px;
  }
</style>
