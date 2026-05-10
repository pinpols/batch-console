<template>
  <el-select v-model="model" v-bind="$attrs">
    <el-option
      v-for="opt in options"
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
   * 用法:
   *   <MetaSelect
   *     v-model="queryDraft.severity"
   *     :options="severityOptions"
   *     enum-key="severity"
   *     class="query-w-180"
   *     clearable
   *     filterable
   *     placeholder="全部"
   *   />
   *
   * 行为:
   *  - 传 `enumKey`(对应 /meta/enums 的分组,如 severity / instanceStatus)时,
   *    label 优先走 i18n `enum.<enumKey>.<value>`;缺失时回退到 BE label
   *  - 不传 enumKey 时按旧行为渲染:`${BE label} (${CODE})`(纯字符串列表只显示 value)
   *  - 其他 el-select 属性透传到底层 <el-select>
   */
  import { useI18n } from 'vue-i18n'
  import type { MetaOption } from '@/api/meta'
  import { formatMetaOptionLabel } from '@/utils/formatMetaOptionLabel'

  defineOptions({ inheritAttrs: true })

  const props = defineProps<{
    options: readonly MetaOption[]
    enumKey?: string
  }>()

  const model = defineModel<string | number | boolean | null | undefined>()

  const { t, te } = useI18n()

  function formatLabel(opt: MetaOption): string {
    if (props.enumKey && opt.value) {
      const key = `enum.${props.enumKey}.${opt.value}`
      if (te(key)) return `${t(key)} (${opt.value})`
    }
    return formatMetaOptionLabel(opt)
  }
</script>
