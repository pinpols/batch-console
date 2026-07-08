<template>
  <el-tag
    class="status-tag"
    :class="{ 'status-tag--enum': !showDot }"
    :type="meta.type"
    :size="size"
    effect="light"
  >
    <span v-if="showDot" class="status-tag__dot" aria-hidden="true" />
    {{ meta.label }}
  </el-tag>
</template>

<style scoped>
  .status-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 500;
  }

  .status-tag--enum {
    gap: 0;
  }

  .status-tag__dot {
    width: 6px;
    height: 6px;
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
</script>
