<template>
  <span class="help-label">
    <slot>{{ label }}</slot>
    <el-tooltip v-if="tip" :content="tip" placement="top" :show-after="300">
      <el-icon class="help-label__icon"><QuestionFilled /></el-icon>
    </el-tooltip>
  </span>
</template>

<script setup lang="ts">
  import { CircleHelp as QuestionFilled } from 'lucide-vue-next'

  defineProps<{
    label?: string
    tip: string
  }>()
</script>

<style scoped>
  .help-label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .help-label__icon {
    font-size: 14px;
    color: var(--el-text-color-placeholder);
    cursor: help;
  }
</style>
