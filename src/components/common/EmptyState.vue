<template>
  <div class="empty-state">
    <div v-if="computedTitle" class="empty-state__title">{{ computedTitle }}</div>
    <el-empty :description="computedDescription" :image-size="imageSize">
      <template v-if="$slots.extra || $slots.action" #extra>
        <div class="empty-state__action">
          <slot name="extra"><slot name="action" /></slot>
        </div>
      </template>
    </el-empty>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'

  type EmptyStateVariant = 'empty' | 'forbidden' | 'error' | 'offline' | 'network'

  const props = withDefaults(
    defineProps<{
      /** 预设场景；与 title/description 同时存在时以后者为准 */
      variant?: EmptyStateVariant
      title?: string
      description?: string
      imageSize?: number
    }>(),
    {
      variant: 'empty',
      imageSize: 88,
    },
  )

  const presets: Record<EmptyStateVariant, { title: string; description: string }> = {
    empty: { title: '', description: '暂无数据' },
    forbidden: { title: '无权限', description: '当前账号无权查看或操作该资源。' },
    error: { title: '加载失败', description: '请求未能完成，请稍后重试或联系管理员。' },
    offline: { title: '服务不可用', description: '暂时无法连接后端，请检查网络或代理配置。' },
    network: { title: '网络异常', description: '连接超时或服务未响应，请稍后重试。' },
  }

  const computedTitle = computed(() => {
    if (props.title?.trim()) return props.title.trim()
    const p = presets[props.variant]
    return p.title || undefined
  })

  const computedDescription = computed(() => {
    if (props.description?.trim()) return props.description.trim()
    return presets[props.variant].description
  })
</script>

<style scoped>
  .empty-state {
    padding: 12px 0 8px;
  }

  .empty-state__title {
    margin-bottom: 8px;
    text-align: center;
    font-size: var(--font-size-md);
    font-weight: 650;
    color: var(--color-text-primary);
  }

  .empty-state__action {
    margin-top: 12px;
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 8px;
  }
</style>
