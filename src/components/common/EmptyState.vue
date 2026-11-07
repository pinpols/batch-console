<template>
  <div class="empty-state">
    <el-empty :image-size="48">
      <template #image>
        <slot name="image">
          <div class="empty-state__image" :class="`empty-state__image--${variant}`">
            <component :is="computedIcon" :size="22" :stroke-width="2" aria-hidden="true" />
          </div>
        </slot>
      </template>
      <template #description>
        <div class="empty-state__copy">
          <div v-if="computedTitle" class="empty-state__title">{{ computedTitle }}</div>
          <p class="empty-state__description">{{ computedDescription }}</p>
        </div>
      </template>
      <template v-if="hasAction" #default>
        <div class="empty-state__action">
          <slot name="extra"><slot name="action" /></slot>
        </div>
      </template>
    </el-empty>
  </div>
</template>

<script setup lang="ts">
  import {
    Building2,
    Inbox,
    SearchX,
    ServerOff,
    ShieldAlert,
    TriangleAlert,
    WifiOff,
  } from '@lucide/vue'
  import { computed, useSlots } from 'vue'
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
      /**
       * 保留给旧调用。图标底板固定 48px，不再随该值放大，
       * 避免表格空态里出现一块发虚的大盒子。
       */
      imageSize?: number
    }>(),
    {
      variant: 'empty',
      imageSize: 48,
    },
  )

  const { t } = useI18n({ useScope: 'global' })
  const slots = useSlots()
  const hasAction = computed(() => Boolean(slots.extra || slots.action))

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
    const normalizedTitle = props.title?.trim()
    if (normalizedTitle) return normalizedTitle
    const p = presets.value[props.variant]
    return p.title || undefined
  })

  const computedDescription = computed(() => {
    const normalizedDescription = props.description?.trim()
    if (normalizedDescription) return normalizedDescription
    return presets.value[props.variant].description
  })

  const computedIcon = computed(() => {
    const icons: Record<EmptyStateVariant, typeof Inbox> = {
      empty: Inbox,
      forbidden: ShieldAlert,
      error: TriangleAlert,
      offline: WifiOff,
      network: WifiOff,
      'filter-empty': SearchX,
      'tenant-empty': Building2,
      'no-permission': ShieldAlert,
      'service-down': ServerOff,
    }

    return icons[props.variant]
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

  /* 底板用中性表面，线条用次级文字色。主色浅洗在深色表格上会和底融成一块影子。 */
  .empty-state__image {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    margin: 0 auto;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-content);
    color: var(--color-text-secondary);
    background: var(--color-bg-subtle);
  }

  .empty-state__image--filter-empty {
    color: var(--color-primary-text);
  }

  .empty-state__image--error,
  .empty-state__image--service-down {
    color: var(--color-danger);
    background: var(--color-danger-light);
  }

  .empty-state__image--offline,
  .empty-state__image--network,
  .empty-state__image--forbidden,
  .empty-state__image--no-permission {
    color: var(--color-warning);
    background: var(--color-warning-light);
  }

  /* Element Plus 会把空态 SVG 填成 monochrome grey，线条图标会变成一块暗影。 */
  .empty-state :deep(.el-empty__image svg) {
    color: inherit;
    fill: none;
    width: 22px;
    height: 22px;
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
