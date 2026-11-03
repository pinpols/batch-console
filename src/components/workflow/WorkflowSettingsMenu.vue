<template>
  <el-dropdown trigger="click" @command="onCommand">
    <el-button :icon="Settings">{{ t('workflowDesignerMvp.actionSettings') }}</el-button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item command="schedule">
          {{ t('workflowDefinitionList.actionSchedule') }}
        </el-dropdown-item>
        <el-dropdown-item command="monitoring">
          {{ t('workflowDefinitionList.monitoring.action') }}
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
  <WorkflowScheduleDialog
    v-model="scheduleVisible"
    :workflow-id="workflowId"
    :tenant-id="tenant.tenantId"
    :can-edit="canMutateConfig"
    @saved="emit('saved')"
  />
  <WorkflowMonitoringPolicyDialog
    v-model="monitoringVisible"
    :workflow-id="workflowId"
    :workflow-code="workflowCode"
    :can-edit="canMutateConfig"
  />
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { Settings } from '@lucide/vue'
  import { usePermission } from '@/composables/usePermission'
  import { useTenantStore } from '@/stores/tenant'
  import WorkflowScheduleDialog from './WorkflowScheduleDialog.vue'
  import WorkflowMonitoringPolicyDialog from './WorkflowMonitoringPolicyDialog.vue'

  /**
   * 工作流设置入口（调度、时限告警）。多节点工作流在设计器工具栏提供同一入口；
   * 单作业工作流不能进设计器，由查看页挂载本组件，保证每个工作流只有一个设置入口。
   */
  defineProps<{ workflowId: number; workflowCode: string }>()
  const emit = defineEmits<{ saved: [] }>()
  const { t } = useI18n({ useScope: 'global' })
  const { canMutateConfig } = usePermission()
  const tenant = useTenantStore()
  const scheduleVisible = ref(false)
  const monitoringVisible = ref(false)

  function onCommand(command: string) {
    if (command === 'schedule') scheduleVisible.value = true
    if (command === 'monitoring') monitoringVisible.value = true
  }
</script>
