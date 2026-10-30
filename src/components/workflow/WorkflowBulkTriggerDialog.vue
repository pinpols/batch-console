<template>
  <el-dialog v-model="visible" :title="t('workflowDefinitionList.bulk.title')" width="900px"
    :close-on-click-modal="!bulk.running.value" :close-on-press-escape="!bulk.running.value"
    :show-close="!bulk.running.value">
    <el-alert :title="t('workflowDefinitionList.bulk.hint')" type="info" :closable="false" />
    <el-form label-position="top">
      <el-form-item :label="t('workflowDefinitionList.triggerBizDate')" required>
        <el-date-picker v-model="bizDate" type="date" value-format="YYYY-MM-DD"
          :disabled="bulk.entries.value.length > 0 || bulk.running.value"
          :placeholder="t('workflowDefinitionList.triggerBizDatePlaceholder')" />
      </el-form-item>
    </el-form>
    <el-alert v-if="bulk.validationError.value" type="error" :closable="false"
      :title="t(`workflowDefinitionList.bulk.validation.${bulk.validationError.value}`)" />
    <el-alert v-if="bulk.hasUnknown.value" type="warning" :closable="false"
      :title="t('workflowDefinitionList.bulk.unknownHint')" />
    <el-table :data="displayRows" row-key="workflowDefinitionId" :max-height="400">
      <el-table-column prop="workflowCode" :label="t('workflowDefinitionList.colCode')" min-width="140" />
      <el-table-column prop="bizDate" :label="t('workflowDefinitionList.triggerBizDate')" width="120" />
      <el-table-column :label="t('workflowDefinitionList.bulk.stateLabel')" min-width="130">
        <template #default="{ row }">
          <!-- Element Plus 注册列时用空行探测插槽，此时没有业务状态。 -->
          <span v-if="row.state">{{ t(`workflowDefinitionList.bulk.states.${row.state}`) }}</span>
          <span v-if="row.requestStatus"> / {{ row.requestStatus }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="receipt" :label="t('workflowDefinitionList.bulk.receipt')" min-width="150" show-overflow-tooltip />
      <el-table-column prop="idempotencyKey" :label="t('workflowDefinitionList.bulk.key')" min-width="150" show-overflow-tooltip />
      <el-table-column prop="error" :label="t('workflowDefinitionList.bulk.error')" min-width="160" show-overflow-tooltip />
    </el-table>
    <template #footer>
      <el-button :disabled="bulk.running.value" @click="visible = false">{{ t('common.close') }}</el-button>
      <el-button v-if="bulk.entries.value.length" :disabled="bulk.running.value || bulk.hasUnknown.value"
        @click="bulk.clear()">{{ t('workflowDefinitionList.bulk.newBatch') }}</el-button>
      <el-button v-if="bulk.hasUnknown.value" :loading="bulk.running.value" :disabled="!canTrigger"
        @click="bulk.reconcile()">{{ t('workflowDefinitionList.bulk.reconcile') }}</el-button>
      <el-button v-if="bulk.hasRetryable.value" :loading="bulk.running.value" :disabled="!canTrigger"
        @click="bulk.retryFailed()">{{ t('workflowDefinitionList.bulk.retryFailed') }}</el-button>
      <el-button v-if="!bulk.entries.value.length || hasPending" type="primary" :loading="bulk.running.value"
        :disabled="!canTrigger || !bizDate || (!bulk.entries.value.length && !targets.length)"
        @click="submit">{{ t('workflowDefinitionList.bulk.confirm', { n: displayRows.length }) }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useWorkflowBulkTrigger, type WorkflowBulkTarget } from '@/composables/useWorkflowBulkTrigger'

  const props = defineProps<{ tenantId: string; canTrigger: boolean; targets: WorkflowBulkTarget[] }>()
  const visible = defineModel<boolean>({ default: false })
  const { t } = useI18n({ useScope: 'global' })
  const bulk = useWorkflowBulkTrigger({ tenantId: () => props.tenantId, canTrigger: () => props.canTrigger })
  // 业务日必须显式选择；不从浏览器时区猜测业务日历结算日期。
  const bizDate = ref('')
  const hasPending = computed(() => bulk.entries.value.some((item) => item.state === 'PENDING'))
  const displayRows = computed(() => bulk.entries.value.length ? bulk.entries.value : props.targets.map((item) => ({
    workflowDefinitionId: item.id, workflowCode: item.workflowCode, bizDate: bizDate.value, state: 'PENDING',
  })))

  watch(() => props.tenantId, () => { visible.value = false; bizDate.value = '' })
  watch(visible, (opened) => {
    if (opened && bulk.entries.value.length) bizDate.value = bulk.entries.value[0].bizDate
  })
  watch(() => bulk.entries.value[0]?.bizDate, (date) => {
    if (date) bizDate.value = date
  })

  async function submit() {
    if (!bulk.entries.value.length && !bulk.prepare(props.targets, bizDate.value)) return
    await bulk.submit()
  }
</script>
