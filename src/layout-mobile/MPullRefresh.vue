<template>
  <div
    class="m-pull"
    @touchstart.passive="onStart"
    @touchmove.passive="onMove"
    @touchend="onEnd"
    @touchcancel="onEnd"
  >
    <div
      v-show="pulling || refreshing"
      class="m-pull__indicator"
      :style="{ transform: `translateY(${indicatorY}px)` }"
    >
      <el-icon class="m-pull__icon" :class="{ 'm-pull__icon--rotating': refreshing }">
        <Refresh v-if="!refreshing" />
        <Loading v-else />
      </el-icon>
      <span class="m-pull__text">{{ hintText }}</span>
    </div>
    <div :style="{ transform: contentTransform }" class="m-pull__content">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { RefreshCw as Refresh, LoaderCircle as Loading } from 'lucide-vue-next'

  const { t } = useI18n({ useScope: 'global' })

  const props = withDefaults(
    defineProps<{
      /** 触发刷新的阈值（px） */
      threshold?: number
      /** 下拉最大可视偏移（阻尼）*/
      maxDrag?: number
      /** 刷新回调（return Promise，完成时结束 loading）*/
      onRefresh?: () => Promise<unknown>
    }>(),
    { threshold: 60, maxDrag: 110 },
  )

  const pulling = ref(false)
  const refreshing = ref(false)
  const dragY = ref(0)
  const startY = ref(0)
  let captured = false

  const indicatorY = computed(() => Math.min(dragY.value, props.maxDrag))
  const contentTransform = computed(() => {
    if (refreshing.value) return `translateY(${props.threshold}px)`
    if (pulling.value) return `translateY(${Math.min(dragY.value, props.maxDrag)}px)`
    return 'translateY(0)'
  })
  const hintText = computed(() => {
    if (refreshing.value) return t('mPullRefresh.refreshing')
    return dragY.value >= props.threshold
      ? t('mPullRefresh.releaseToRefresh')
      : t('mPullRefresh.pullToRefresh')
  })

  function scrollTopOfApp(): number {
    // 滚动容器是 MobileLayout 的 main.mobile-layout__content（它 overflow: auto）
    const el = document.querySelector('.mobile-layout__content') as HTMLElement | null
    return el?.scrollTop ?? window.scrollY
  }

  function onStart(e: TouchEvent) {
    if (refreshing.value) return
    // 只在顶到底的时候接管
    if (scrollTopOfApp() > 0) return
    captured = true
    startY.value = e.touches[0]?.clientY ?? 0
    dragY.value = 0
    pulling.value = false
  }

  function onMove(e: TouchEvent) {
    if (!captured || refreshing.value) return
    const y = e.touches[0]?.clientY ?? 0
    const delta = y - startY.value
    if (delta <= 0) {
      dragY.value = 0
      return
    }
    // 带阻尼的 pull 距离
    dragY.value = Math.min(delta * 0.5, props.maxDrag)
    pulling.value = true
  }

  async function onEnd() {
    if (!captured) return
    captured = false
    if (pulling.value && dragY.value >= props.threshold && props.onRefresh) {
      refreshing.value = true
      try {
        await props.onRefresh()
      } finally {
        refreshing.value = false
      }
    }
    pulling.value = false
    dragY.value = 0
  }
</script>

<style scoped>
  .m-pull {
    position: relative;
    overflow: hidden;
  }

  .m-pull__content {
    transition: transform 0.2s cubic-bezier(0.33, 1, 0.68, 1);
    will-change: transform;
  }

  .m-pull__indicator {
    position: absolute;
    top: -48px;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 48px;
    color: var(--color-text-tertiary);
    font-size: 12px;
    pointer-events: none;
    transition: transform 0.18s cubic-bezier(0.33, 1, 0.68, 1);
  }

  .m-pull__icon {
    font-size: 16px;
  }

  .m-pull__icon--rotating {
    animation: m-pull-rotate 0.9s linear infinite;
  }

  @keyframes m-pull-rotate {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
