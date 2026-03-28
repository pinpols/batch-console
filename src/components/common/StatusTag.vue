<template>
  <el-tag :type="meta.type" :size="size" effect="light">
    {{ meta.label }}
  </el-tag>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import {
    fileStatusMap,
    instanceStatusMap,
    logLevelMap,
    partitionStatusMap,
    workerStatusMap,
    workflowRunStatusMap,
  } from '@/constants/status'

  const props = withDefaults(
    defineProps<{
      value: string
      category?: 'instance' | 'file' | 'partition' | 'worker' | 'workflow' | 'log'
      size?: 'small' | 'default' | 'large'
      fallback?: string
    }>(),
    {
      size: 'small',
      category: 'instance',
      fallback: '',
    },
  )

  const meta = computed(() => {
    const maps = {
      instance: instanceStatusMap,
      file: fileStatusMap,
      partition: partitionStatusMap,
      worker: workerStatusMap,
      workflow: workflowRunStatusMap,
      log: logLevelMap,
    } as const

    const map: Record<string, { label: string; type: 'primary' | 'success' | 'warning' | 'danger' | 'info' }> =
      maps[props.category]
    return map[props.value] ?? { label: props.value || props.fallback, type: 'info' }
  })
</script>
