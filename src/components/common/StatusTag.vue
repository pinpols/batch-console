<template>
  <el-tag :type="meta.type" :size="size" effect="light">
    {{ meta.label }}
  </el-tag>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import {
    alertSeverityMap,
    alertStatusMap,
    approvalStatusMap,
    arrivalStateMap,
    batchDayStatusMap,
    channelTypeMap,
    configStatusMap,
    deliveryStatusMap,
    fileStatusMap,
    instanceStatusMap,
    logLevelMap,
    logTypeMap,
    operationResultMap,
    outboxPublishStatusMap,
    partitionStatusMap,
    slaStatusMap,
    tenantConfigInitActionMap,
    tenantStatusMap,
    triggerResourceTypeMap,
    triggerStatusMap,
    workerStatusMap,
    workflowDefinitionStatusMap,
    workflowRunStatusMap,
    ynStatusMap,
  } from '@/constants/status'

  const props = withDefaults(
    defineProps<{
      value: string
      category?:
        | 'instance'
        | 'file'
        | 'partition'
        | 'worker'
        | 'workflow'
        | 'workflowDefinition'
        | 'log'
        | 'logType'
        | 'approval'
        | 'outboxPublishStatus'
        | 'alertSeverity'
        | 'alertStatus'
        | 'batchDay'
        | 'sla'
        | 'arrival'
        | 'operationResult'
        | 'configStatus'
        | 'yn'
        | 'tenant'
        | 'trigger'
        | 'triggerResourceType'
        | 'tenantConfigInitAction'
        | 'channelType'
        | 'deliveryStatus'
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
    const maps: Record<
      typeof props.category,
      Record<string, { label: string; type: 'primary' | 'success' | 'warning' | 'danger' | 'info' }>
    > = {
      instance: instanceStatusMap,
      file: fileStatusMap,
      partition: partitionStatusMap,
      worker: workerStatusMap,
      workflow: workflowRunStatusMap,
      workflowDefinition: workflowDefinitionStatusMap,
      log: logLevelMap,
      logType: logTypeMap,
      approval: approvalStatusMap,
      outboxPublishStatus: outboxPublishStatusMap,
      alertSeverity: alertSeverityMap,
      alertStatus: alertStatusMap,
      batchDay: batchDayStatusMap,
      sla: slaStatusMap,
      arrival: arrivalStateMap,
      operationResult: operationResultMap,
      configStatus: configStatusMap,
      yn: ynStatusMap,
      tenant: tenantStatusMap,
      trigger: triggerStatusMap,
      triggerResourceType: triggerResourceTypeMap,
      tenantConfigInitAction: tenantConfigInitActionMap,
      channelType: channelTypeMap,
      deliveryStatus: deliveryStatusMap,
    }

    const map = maps[props.category] ?? {}
    return (
      map[props.value] ?? { label: props.value || props.fallback || '—', type: 'info' as const }
    )
  })
</script>
