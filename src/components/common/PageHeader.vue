<template>
  <!--
    hideDuplicateTitle 模式下:全局顶栏已经显示标题,本组件只剩描述 / 操作按钮。
    去掉 .app-surface(卡片阴影)+ 缩小内边距,避免"卡片套卡片"的视觉层叠。
  -->
  <section class="page-header">
    <div class="page-header__left">
      <div>
        <h1 class="title">{{ displayTitle }}</h1>
        <p v-if="shouldShowDescription" class="description">
          {{ displayDescription }}
        </p>
      </div>
    </div>
    <div v-if="$slots.actions || showBackButton || showForwardButton" class="actions">
      <slot name="actions" />
      <div v-if="showBackButton || showForwardButton" class="nav-arrows">
        <button
          v-if="showBackButton"
          class="nav-arrow-btn"
          :title="t('pageHeader.backTooltip')"
          :aria-label="t('pageHeader.backTooltip')"
          @click="goBack"
        >
          <el-icon :size="16"><ArrowLeft /></el-icon>
        </button>
        <button
          v-if="showForwardButton"
          class="nav-arrow-btn"
          :class="{ 'is-disabled': forwardDisabled }"
          :title="t('pageHeader.forwardTooltip')"
          :aria-label="t('pageHeader.forwardTooltip')"
          :disabled="forwardDisabled"
          @click="goForward"
        >
          <el-icon :size="16"><ArrowRight /></el-icon>
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import { ArrowLeft, ArrowRight } from 'lucide-vue-next'

  const { t } = useI18n({ useScope: 'global' })

  const props = withDefaults(
    defineProps<{
      title?: string
      description?: string
      /** 紧凑模式：减少上下 padding、缩小标题字号 */
      compact?: boolean
      /** 工具条风格：弱化标题，突出右侧按钮（用于减少与顶栏标题重复感） */
      toolbar?: boolean
      /**
       * 是否显示 description。**默认 true**(只要传了非空 description 就当简介展示),
       * 仅以 `GET/POST/...` 开头的接口文案自动隐藏(老页面遗留)。
       */
      showDescription?: boolean
      /** 返回按钮目标路由；传入后在标题左侧显示返回箭头 */
      backTo?: string
      /**
       * 是否显示标题。默认 auto：普通列表页若已由全局页头展示相同标题，则
       * 这里视觉隐藏标题，只保留页面说明/操作区；详情返回页仍显示。
       */
      showTitle?: boolean
    }>(),
    {
      compact: undefined,
      toolbar: true,
      showDescription: true,
    },
  )

  const router = useRouter()
  const route = useRoute()

  /** route.meta.title/description 是中文兜底,优先用 i18n `page.<pathKey>.*` 跟随语言切换。 */
  function i18nByPathKey(field: 'title' | 'description'): string {
    const pathKey = typeof route.meta.pathKey === 'string' ? route.meta.pathKey : ''
    if (!pathKey) return ''
    const key = `page.${pathKey}.${field}`
    const v = t(key)
    return v && v !== key ? v : ''
  }
  const displayTitle = computed(() => {
    const explicit = props.title?.trim()
    if (explicit) return explicit
    const i18nVal = i18nByPathKey('title')
    if (i18nVal) return i18nVal
    return typeof route.meta.title === 'string' ? route.meta.title : ''
  })
  const displayDescription = computed(() => {
    const explicit = props.description?.trim()
    if (explicit) return explicit
    const i18nVal = i18nByPathKey('description')
    if (i18nVal) return i18nVal
    return typeof route.meta.description === 'string' ? route.meta.description : ''
  })
  const hideDuplicateTitle = computed(() => {
    if (props.showTitle != null) return !props.showTitle
    if (props.backTo) return false
    const routeTitle = typeof route.meta.title === 'string' ? route.meta.title.trim() : ''
    return routeTitle !== '' && routeTitle === displayTitle.value.trim()
  })

  const shouldShowDescription = computed(() => {
    const d = displayDescription.value.trim()
    if (!d) return false
    if (!props.showDescription) return false
    // 老页面遗留的"GET /api/..."这类接口文案默认不显示
    if (/^(GET|POST|PUT|DELETE|PATCH)\s/i.test(d)) return false
    return true
  })

  // history.state 在 vue-router 导航后会变,但不是响应式的;用 ref + route 监听同步
  const historyBackPath = ref<unknown>(null)
  const historyForwardPath = ref<unknown>(null)
  watch(
    () => route.fullPath,
    () => {
      historyBackPath.value = window.history.state?.back ?? null
      historyForwardPath.value = window.history.state?.forward ?? null
    },
    { immediate: true },
  )

  /**
   * 是否显示返回按钮(三种触发条件,任一满足即可):
   * 1. 显式 backTo 属性(老用法,保留兼容)
   * 2. 历史栈有上一条 in-app 记录 + 当前页未通过 meta.hideBackButton 主动关闭
   * 仪表盘、登录页等入口页设置 meta.hideBackButton = true
   */
  const showBackButton = computed(() => {
    if (hideDuplicateTitle.value && !props.backTo) return false
    if (props.backTo) return true
    if (route.meta.hideBackButton === true) return false
    return !!historyBackPath.value
  })

  // 列表页按 redesign 稿隐藏历史导航;详情页或显式开启的页面才显示前进按钮。
  const showForwardButton = computed(
    () =>
      !hideDuplicateTitle.value &&
      route.meta.hideBackButton !== true &&
      route.meta.showForwardButton === true,
  )
  const forwardDisabled = computed(() => !historyForwardPath.value)

  function goBack() {
    const hasBackEntry = !!historyBackPath.value
    if (hasBackEntry) {
      router.back()
    } else if (props.backTo) {
      router.push(props.backTo)
    }
  }

  function goForward() {
    if (historyForwardPath.value) router.forward()
  }
</script>

<style scoped>
  /* 还原设计:页面以大标题 H1 领起 + 灰副标题,右侧操作;透明无卡片。 */
  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-md);
    padding: 10px 0 2px;
    margin-bottom: 0;
    background: transparent;
  }

  .title {
    margin: 0;
    font-size: var(--font-size-2xl);
    font-weight: 650;
    line-height: var(--line-height-tight);
    letter-spacing: -0.01em;
    color: var(--color-text-primary);
  }

  .description {
    margin: 6px 0 0;
    color: var(--color-text-secondary);
    font-size: var(--font-size-md);
    font-weight: 400;
    line-height: 1.5;
  }

  .page-header__left {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .nav-arrows {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .nav-arrow-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-sm, 6px);
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .nav-arrow-btn:hover {
    color: var(--el-color-primary);
    border-color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }

  .nav-arrow-btn.is-disabled,
  .nav-arrow-btn:disabled {
    cursor: not-allowed;
    color: var(--color-text-tertiary);
    opacity: 0.45;
  }

  .nav-arrow-btn.is-disabled:hover,
  .nav-arrow-btn:disabled:hover {
    color: var(--color-text-tertiary);
    border-color: var(--color-border-light);
    background: transparent;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }
</style>
