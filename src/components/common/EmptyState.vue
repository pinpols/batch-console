<template>
  <div class="empty-state">
    <el-empty :image-size="imageSize">
      <template v-if="$slots.image" #image>
        <slot name="image" />
      </template>
      <template #description>
        <div class="empty-state__copy">
          <div v-if="computedTitle" class="empty-state__title">{{ computedTitle }}</div>
          <p class="empty-state__description">{{ computedDescription }}</p>
        </div>
      </template>
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
  import { useI18n } from 'vue-i18n'

  type EmptyStateVariant =
    | 'empty'
    | 'forbidden'
    | 'error'
    | 'offline'
    | 'network'
    | 'filter-empty' // 用户加了筛选条件,无匹配
    | 'tenant-empty' // 当前租户内空(可切换其它租户)
    | 'no-permission' // 角色权限不足
    | 'service-down' // BE 服务不可用

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

  const { t } = useI18n({ useScope: 'global' })

  const presets = computed<Record<EmptyStateVariant, { title: string; description: string }>>(
    () => ({
      empty: { title: '', description: t('empty.default') },
      forbidden: { title: t('error.forbidden'), description: t('error.forbiddenSub') },
      error: { title: t('empty.error'), description: t('error.subtitle') },
      offline: { title: t('error.networkTitle'), description: t('error.networkSub') },
      network: { title: t('error.networkTitle'), description: t('error.networkSub') },
      'filter-empty': {
        title: t('empty.filterTitle'),
        description: t('empty.filterDescription'),
      },
      'tenant-empty': {
        title: t('empty.tenantTitle'),
        description: t('empty.tenantDescription'),
      },
      'no-permission': {
        title: t('empty.noPermissionTitle'),
        description: t('empty.noPermissionDescription'),
      },
      'service-down': {
        title: t('empty.serviceDownTitle'),
        description: t('empty.serviceDownDescription'),
      },
    }),
  )

  const computedTitle = computed(() => {
    if (props.title?.trim()) return props.title.trim()
    const p = presets.value[props.variant]
    return p.title || undefined
  })

  const computedDescription = computed(() => {
    if (props.description?.trim()) return props.description.trim()
    return presets.value[props.variant].description
  })
</script>

<style scoped>
  .empty-state {
    width: 100%;
    padding: 20px 16px;
  }

  .empty-state :deep(.el-empty) {
    padding: 16px 0;
  }

  .empty-state__copy {
    display: grid;
    gap: 6px;
    max-width: 520px;
    margin: 0 auto;
  }

  .empty-state__title {
    text-align: center;
    font-size: var(--font-size-md);
    font-weight: 650;
    color: var(--color-text-primary);
  }

  .empty-state__description {
    margin: 0;
    color: var(--color-text-tertiary);
    font-size: var(--font-size-sm);
    line-height: 1.6;
    text-align: center;
  }

  .empty-state__action {
    margin-top: 12px;
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 8px;
  }
</style>
