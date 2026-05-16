<template>
  <!--
    hideDuplicateTitle 模式下:全局顶栏已经显示标题,本组件只剩描述 / 操作按钮。
    去掉 .app-surface(卡片阴影)+ 缩小内边距,避免"卡片套卡片"的视觉层叠。
  -->
  <section
    class="page-header"
    :class="{
      'app-surface': !hideDuplicateTitle,
      'page-header--compact': effectiveCompact,
      'page-header--toolbar': toolbar,
      'page-header--summary': hideDuplicateTitle,
    }"
  >
    <div class="page-header__left">
      <button
        v-if="showBackButton"
        class="back-btn"
        :title="t('pageHeader.backTooltip')"
        @click="goBack"
      >
        <el-icon :size="16"><ArrowLeft /></el-icon>
      </button>
      <div>
        <h1
          class="title"
          :class="{ 'title--muted': toolbar, 'title--sr-only': hideDuplicateTitle }"
        >
          {{ displayTitle }}
        </h1>
        <p
          v-if="shouldShowDescription"
          class="description"
          :class="{ 'description--primary': hideDuplicateTitle }"
        >
          {{ displayDescription }}
        </p>
      </div>
    </div>
    <div v-if="$slots.actions" class="actions">
      <slot name="actions" />
    </div>
  </section>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import { ArrowLeft } from '@element-plus/icons-vue'

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

  const effectiveCompact = computed(() => props.compact ?? true)
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
  watch(
    () => route.fullPath,
    () => {
      historyBackPath.value = window.history.state?.back ?? null
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
    if (props.backTo) return true
    if (route.meta.hideBackButton === true) return false
    return !!historyBackPath.value
  })

  function goBack() {
    const hasBackEntry = !!historyBackPath.value
    if (hasBackEntry) {
      router.back()
    } else if (props.backTo) {
      router.push(props.backTo)
    }
  }
</script>

<style scoped>
  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-sm);
    border-radius: var(--radius-content);
    padding: 12px var(--page-align-inline);
    /* 与下方 SectionCard 的间距由 PageContainer 的 gap（--page-section-gap）统一控制 */
    margin-bottom: 0;
  }

  .page-header--compact {
    padding: 9px var(--page-align-inline);
  }

  .page-header--toolbar {
    align-items: center;
    padding-top: 9px;
    padding-bottom: 9px;
  }

  .page-header--summary {
    /* 列表页 summary 模式:去卡片化(无阴影 / 仅左侧 3px 主色竖条)
       + 紧凑内边距,从"卡片"降为"内容标识条" */
    align-items: center;
    padding: 6px 12px 6px 16px;
    background: transparent;
    border: none;
    border-left: 3px solid color-mix(in srgb, var(--color-primary) 60%, transparent);
    border-radius: 0;
  }

  .title {
    margin: 0;
    font-size: var(--font-size-xl);
    font-weight: 600;
    line-height: var(--line-height-tight);
  }

  .page-header--compact .title {
    font-size: var(--font-size-lg);
  }

  .title--muted {
    font-weight: 650;
    font-size: var(--font-size-md);
    color: var(--color-text-secondary);
    letter-spacing: 0.2px;
  }

  .page-header--toolbar .title {
    font-size: var(--font-size-md);
  }

  .title--sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .description {
    margin: 4px 0 0;
    color: var(--color-text-tertiary, #909399);
    font-size: var(--font-size-sm);
    font-weight: 400;
    line-height: 1.55;
    letter-spacing: 0.2px;
    /* 简介文案降一档色阶,跟标题层级拉开;字间距放一点点显得不挤 */
  }

  .page-header--compact .description {
    font-size: 12.5px;
    line-height: 1.5;
  }

  .description--primary {
    margin-top: 0;
    max-width: 900px;
    padding-left: 10px;
    border-left: 3px solid color-mix(in srgb, var(--color-primary) 76%, transparent);
    color: color-mix(in srgb, var(--color-text-primary) 74%, var(--color-text-secondary) 26%);
    font-size: 13px;
    font-weight: 550;
    line-height: 1.5;
    letter-spacing: 0;
  }

  .page-header__left {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .back-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-sm, 6px);
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .back-btn:hover {
    color: var(--el-color-primary);
    border-color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }
</style>
