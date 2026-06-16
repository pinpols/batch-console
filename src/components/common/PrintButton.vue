<template>
  <el-button class="no-print" :size="size" :icon="Printer" :text="text" @click="doPrint">
    <slot>{{ t('print.label') }}</slot>
  </el-button>
</template>

<script setup lang="ts">
  import { nextTick } from 'vue'
  import { Printer } from '@element-plus/icons-vue'
  import { useI18n } from 'vue-i18n'

  withDefaults(
    defineProps<{
      size?: 'large' | 'default' | 'small'
      /** 文字按钮样式(无边框) */
      text?: boolean
    }>(),
    { size: 'default', text: false },
  )

  const { t } = useI18n({ useScope: 'global' })

  async function doPrint() {
    // 等一帧让任何因点击触发的 UI 收起(如下拉)后再唤起打印对话框
    await nextTick()
    window.print()
  }
</script>
