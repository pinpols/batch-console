<template>
  <el-tag :type="meta.type" :size="size" effect="light">
    {{ meta.label }}
  </el-tag>
</template>

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
</script>
