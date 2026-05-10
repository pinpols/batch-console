<template>
  <el-select v-model="model" v-bind="$attrs">
    <el-option
      v-for="opt in options"
      :key="opt.value"
      :label="formatMetaOptionLabel(opt)"
      :value="opt.value"
    />
  </el-select>
</template>

<script setup lang="ts">
  /**
   * 元数据下拉(包后端 enum 字典 + 中英双显)。
   *
   * 用法:
   *   <MetaSelect
   *     v-model="queryDraft.severity"
   *     :options="severityOptions"
   *     class="query-w-180"
   *     clearable
   *     filterable
   *     placeholder="全部"
   *   />
   *
   * 行为:
   *  - label 渲染为 `${中文} (${CODE})`,如 `严重 (CRITICAL)`,方便排障对接口
   *  - label === value(无翻译,如 jobCode/calendarCode 这类纯字符串列表)时只渲染 value
   *  - 其他 el-select 属性(class / clearable / filterable / placeholder /
   *    allow-create / @keyup.enter ...)透传到底层 <el-select>,不做拦截
   */
  import type { MetaOption } from '@/api/meta'
  import { formatMetaOptionLabel } from '@/utils/formatMetaOptionLabel'

  defineOptions({ inheritAttrs: true })

  defineProps<{
    options: readonly MetaOption[]
  }>()

  const model = defineModel<string | number | boolean | null | undefined>()
</script>
