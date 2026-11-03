<template>
  <el-tag
    class="status-tag"
    :class="{ 'status-tag--enum': !showDot }"
    :type="tagType"
    :size="size"
    effect="light"
  >
    <span v-if="showDot" class="status-tag__dot" aria-hidden="true" />
    {{ meta.label }}
  </el-tag>
</template>

<style scoped>
  /* 时刻表方向：状态为带圆点的胶囊，分类枚举为中性方角标签；均使用正文字体 */
  .status-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0 9px 0 7px;
    border-radius: 999px;
    font-size: var(--font-size-xs);
    font-weight: 500;
  }

  .status-tag--enum {
    gap: 0;
    padding: 0 7px;
    border-radius: var(--radius-control);
  }

  .status-tag__dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: currentColor;
    flex-shrink: 0;
  }
</style>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { resolveStatusMeta, type StatusTagCategory } from '@/components/common/statusTagResolve'

  const props = withDefaults(
    defineProps<{
      value: string
      category?: StatusTagCategory
      size?: 'small' | 'default' | 'large'
      fallback?: string
    }>(),
    {
      size: 'small',
      category: 'instance',
      fallback: '',
    },
  )

  const { data: metaEnums } = useConsoleMetaEnumsQuery()
  const { t, te } = useI18n({ useScope: 'global' })

  const meta = computed(() =>
    resolveStatusMeta(props.value, props.category, metaEnums.value, props.fallback, {
      exists: (key: string) => te(key),
      translate: (key: string) => t(key),
    }),
  )

  const showDot = computed(() => !['executionMode', 'jobType'].includes(props.category))
  // 分类枚举不表达状态，统一中性色，避免类型标签按颜色区分
  const tagType = computed(() => (showDot.value ? meta.value.type : 'info'))
</script>
