<template>
  <section
    class="page-header app-surface"
    :class="{
      'page-header--compact': effectiveCompact,
      'page-header--toolbar': toolbar,
    }"
  >
    <div class="page-header__left">
      <button v-if="backTo" class="back-btn" title="返回" @click="goBack">
        <el-icon :size="16"><ArrowLeft /></el-icon>
      </button>
      <div>
        <h1 class="title" :class="{ 'title--muted': toolbar }">{{ title }}</h1>
        <p v-if="shouldShowDescription" class="description">{{ description }}</p>
      </div>
    </div>
    <div v-if="$slots.actions" class="actions">
      <slot name="actions" />
    </div>
  </section>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useRouter } from 'vue-router'
  import { ArrowLeft } from '@element-plus/icons-vue'

  const props = withDefaults(
    defineProps<{
      title: string
      description?: string
      /** 紧凑模式：减少上下 padding、缩小标题字号 */
      compact?: boolean
      /** 工具条风格：弱化标题，突出右侧按钮（用于减少与顶栏标题重复感） */
      toolbar?: boolean
      /** 强制显示 description（默认会自动隐藏 GET /api... 这类"接口文案"） */
      showDescription?: boolean
      /** 返回按钮目标路由；传入后在标题左侧显示返回箭头 */
      backTo?: string
    }>(),
    {
      compact: undefined,
      toolbar: true,
      showDescription: false,
    },
  )

  const router = useRouter()

  const effectiveCompact = computed(() => props.compact ?? true)

  const shouldShowDescription = computed(() => {
    const d = String(props.description ?? '').trim()
    if (!d) return false
    return props.showDescription
  })

  function goBack() {
    if (props.backTo) {
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

  .description {
    margin: 6px 0 0;
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    line-height: var(--line-height-base);
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
