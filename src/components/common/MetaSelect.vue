<template>
  <el-select v-model="model" v-bind="$attrs">
    <el-option
      v-for="opt in resolvedOptions"
      :key="opt.value"
      :label="formatLabel(opt)"
      :value="opt.value"
    />
  </el-select>
</template>

<script setup lang="ts">
  /**
   * 元数据下拉(包后端 enum 字典 + 中英双显 + i18n 兜底)。
   *
   * 用法 1:外部传 options(沿用旧 API)
   *   <MetaSelect v-model="x" :options="myOpts" enum-key="severity" />
   *
   * 用法 2:enum-key only(组件自取 /meta/enums,共享 vue-query 缓存)
   *   <MetaSelect v-model="form.jobType" enum-key="jobType" />
   *
   * 行为:
   *  - 传 `enumKey` 时 label 优先走 i18n `enum.<enumKey>.<value>`,缺失回退 BE label
   *  - 显式 `options` 优先;不传时根据 `enumKey` 自取后端字典(用 useConsoleMetaEnumsQuery
   *    全局缓存,多个 MetaSelect 共享同一份 /meta/enums 响应)
   *  - 其他 el-select 属性透传到底层 <el-select>
   */
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import type { MetaOption } from '@/api/meta'
  import { formatMetaOptionLabel } from '@/utils/formatMetaOptionLabel'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'

  defineOptions({ inheritAttrs: true })

  const props = withDefaults(
    defineProps<{
      options?: readonly MetaOption[]
      enumKey?: string
    }>(),
    { options: () => [] },
  )

  const model = defineModel<string | number | boolean | null | undefined>()

  const { t, te } = useI18n({ useScope: 'global' })

  // 只有当外部没传 options 且声明了 enumKey 时,才订阅 /meta/enums 全局查询。
  // vue-query 内部 dedupe + 2min staleTime,多个 MetaSelect 共享同一份响应,
  // 不会因为多页/多控件渲染就多次 HTTP。
  const shouldAutoFetch = computed(() => !!props.enumKey && props.options.length === 0)
  const { data: metaEnums } = useConsoleMetaEnumsQuery()

  const resolvedOptions = computed<readonly MetaOption[]>(() => {
    if (props.options.length > 0) return props.options
    if (!shouldAutoFetch.value) return props.options
    const groups = metaEnums.value as Record<string, MetaOption[]> | undefined
    return groups?.[props.enumKey as string] ?? []
  })

  function formatLabel(opt: MetaOption): string {
    if (props.enumKey && opt.value) {
      const key = `enum.${props.enumKey}.${opt.value}`
      if (te(key)) return `${t(key)} (${opt.value})`
    }
    return formatMetaOptionLabel(opt)
  }
</script>
