<template>
  <div class="trigger-pause">
    <el-alert
      type="info"
      :closable="false"
      show-icon
      :title="t('selfServicePanel.descTriggerPause')"
      class="trigger-pause__intro"
    />

    <el-form label-width="88px" class="form-section" @submit.prevent="submit">
      <el-form-item :label="t('selfServicePanel.triggerWorkflowCodeLabel')">
        <el-select
          v-model="workflowCode"
          filterable
          :loading="listLoading"
          :placeholder="t('selfServicePanel.triggerWorkflowCodePlaceholder')"
          class="query-w-full"
        >
          <el-option
            v-for="t in triggers"
            :key="t.workflowCode"
            :label="t.workflowCode"
            :value="t.workflowCode"
          >
            <span class="opt-row">
              <span>{{ t.workflowCode }}</span>
              <el-tag size="small" effect="plain" :type="t.paused ? 'info' : 'success'">
                {{
                  t.paused
                    ? $t('selfServicePanel.triggerStatusPaused')
                    : $t('selfServicePanel.triggerStatusActive')
                }}
              </el-tag>
            </span>
          </el-option>
        </el-select>
      </el-form-item>

      <el-form-item :label="t('selfServicePanel.triggerActionLabel')">
        <el-radio-group v-model="action">
          <el-radio-button value="pause">
            {{ t('selfServicePanel.triggerActionPause') }}
          </el-radio-button>
          <el-radio-button value="resume">
            {{ t('selfServicePanel.triggerActionResume') }}
          </el-radio-button>
        </el-radio-group>
      </el-form-item>

      <el-form-item class="form-actions">
        <el-button native-type="button" :disabled="submitting" @click="resetTriggerForm">
          {{ t('common.reset') }}
        </el-button>
        <el-button
          type="primary"
          native-type="submit"
          :loading="submitting"
          :disabled="!workflowCode"
        >
          {{ t('selfServicePanel.triggerSubmit') }}
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useTenantRequestScope } from '@/composables/useTenantRequestScope'
  import {
    listTriggers,
    pauseTrigger,
    resumeTrigger,
    type TriggerStatusResponse,
  } from '@/api/triggers'

  interface TriggerRow {
    workflowCode: string
    paused?: boolean
  }

  const { t } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()

  const listLoading = ref(false)
  const submitting = ref(false)
  const triggers = ref<TriggerRow[]>([])
  const workflowCode = ref<string>('')
  const action = ref<'pause' | 'resume'>('pause')

  const loadScope = useTenantRequestScope()
  const submitScope = useTenantRequestScope()
  async function loadTriggers() {
    const request = loadScope.begin()
    if (!request.tenantId) return
    listLoading.value = true
    try {
      const raw = await listTriggers()
      if (!loadScope.isCurrent(request)) return
      const tenantRows = raw.filter((row) => row.tenantId === request.tenantId)
      const items = extractTriggers(tenantRows)
      triggers.value = items
    } catch {
      if (!loadScope.isCurrent(request)) return
      triggers.value = []
    } finally {
      if (loadScope.isCurrent(request)) listLoading.value = false
    }
  }

  /** 固定数组契约；缺失作业编码的条目不能成为运维动作目标。 */
  function extractTriggers(rows: TriggerStatusResponse[]): TriggerRow[] {
    return rows.flatMap((row) => {
      const code = row.workflowCode?.trim()
      if (!code) return []
      const normalizedStatus = row.status?.toUpperCase()
      return [{ workflowCode: code, paused: normalizedStatus === 'PAUSED' }]
    })
  }

  function resetTriggerForm() {
    workflowCode.value = ''
    action.value = 'pause'
  }

  async function submit() {
    if (!workflowCode.value || !tenant.tenantId || submitting.value) return
    const request = submitScope.begin()
    const selectedWorkflow = workflowCode.value
    const selectedAction = action.value
    submitting.value = true
    try {
      if (selectedAction === 'pause') {
        await pauseTrigger(selectedWorkflow, request.tenantId)
        if (!submitScope.isCurrent(request)) return
        ElMessage.success(t('selfServicePanel.triggerSuccessPause', { code: selectedWorkflow }))
      } else {
        await resumeTrigger(selectedWorkflow, request.tenantId)
        if (!submitScope.isCurrent(request)) return
        ElMessage.success(t('selfServicePanel.triggerSuccessResume', { code: selectedWorkflow }))
      }
      void loadTriggers()
    } finally {
      if (submitScope.isCurrent(request)) submitting.value = false
    }
  }

  watch(
    () => tenant.tenantId,
    () => {
      resetTriggerForm()
      triggers.value = []
      listLoading.value = false
      submitting.value = false
    },
    { flush: 'sync' },
  )
  useTenantReload(loadTriggers)
</script>

<style scoped>
  .trigger-pause__intro {
    margin-bottom: 16px;
  }

  .opt-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    width: 100%;
  }

  .query-w-full {
    width: 100%;
  }
</style>
