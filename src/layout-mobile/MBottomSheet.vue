<template>
  <Teleport to="body">
    <transition name="m-sheet">
      <div v-if="modelValue" class="m-sheet-backdrop" @click="onBackdrop">
        <div
          class="m-sheet"
          :style="{ maxHeight: maxHeight }"
          role="dialog"
          aria-modal="true"
          @click.stop
        >
          <div class="m-sheet__grabber" />
          <div v-if="title || $slots.header" class="m-sheet__header">
            <slot name="header">
              <div class="m-sheet__title">{{ title }}</div>
            </slot>
          </div>
          <div class="m-sheet__body">
            <slot />
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { watch } from 'vue'

  const props = withDefaults(
    defineProps<{
      modelValue: boolean
      /** 顶部标题(可选,也可用 #header 槽完全自定义) */
      title?: string
      /** sheet 最大高度。默认 85vh(给 backdrop 留点透出) */
      maxHeight?: string
      /** 点 backdrop 是否关闭。默认 true */
      closeOnBackdrop?: boolean
      /** 是否锁滚动(打开期间 body 不可滚动)。默认 true */
      lockScroll?: boolean
    }>(),
    { title: '', maxHeight: '85vh', closeOnBackdrop: true, lockScroll: true },
  )

  const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

  function onBackdrop() {
    if (props.closeOnBackdrop) emit('update:modelValue', false)
  }

  // 锁 body 滚动,避免 sheet 打开时背景跟着滚
  let savedOverflow = ''
  watch(
    () => props.modelValue,
    (open) => {
      if (!props.lockScroll) return
      if (open) {
        savedOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
      } else {
        document.body.style.overflow = savedOverflow
      }
    },
  )
</script>

<style scoped>
  /* iOS Bottom Sheet:从底部滑上来,顶部一根 grabber,圆角顶部,半透白 + 毛玻璃。
     backdrop 黑半透 40%,点击关。
     用 Teleport 挂到 body,不嵌在 mobile-layout 里,避免被 transform 容器截断。 */
  .m-sheet-backdrop {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 40%);
    z-index: 1999;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }

  .m-sheet {
    width: 100%;
    max-width: 640px;
    background: rgba(255 255 255 / 96%);
    -webkit-backdrop-filter: saturate(180%) blur(24px);
    backdrop-filter: saturate(180%) blur(24px);
    border-radius: 18px 18px 0 0;
    padding-bottom: env(safe-area-inset-bottom, 0);
    box-shadow: 0 -8px 32px rgb(0 0 0 / 18%);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-family:
      -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Helvetica Neue', sans-serif;
    color: #000;
  }

  html.dark .m-sheet {
    background: rgba(40 40 42 / 96%);
    color: #fff;
  }

  /* iOS 顶部 grabber:36×5px 灰色短条,提示"可拖拽" */
  .m-sheet__grabber {
    width: 36px;
    height: 5px;
    border-radius: 2.5px;
    background: rgb(60 60 67 / 30%);
    margin: 6px auto 4px;
    flex-shrink: 0;
  }

  html.dark .m-sheet__grabber {
    background: rgb(235 235 245 / 30%);
  }

  .m-sheet__header {
    padding: 4px 16px 8px;
    flex-shrink: 0;
  }

  .m-sheet__title {
    font-size: 17px;
    font-weight: 600;
    letter-spacing: -0.02em;
    text-align: center;
  }

  .m-sheet__body {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    padding: 4px 16px 16px;
  }

  /* enter/leave transition:backdrop fade + sheet slide-up cubic-bezier (iOS 标准) */
  .m-sheet-enter-active,
  .m-sheet-leave-active {
    transition: background 0.26s ease;
  }
  .m-sheet-enter-active .m-sheet,
  .m-sheet-leave-active .m-sheet {
    transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
  }
  .m-sheet-enter-from,
  .m-sheet-leave-to {
    background: rgb(0 0 0 / 0%);
  }
  .m-sheet-enter-from .m-sheet,
  .m-sheet-leave-to .m-sheet {
    transform: translateY(100%);
  }
</style>
