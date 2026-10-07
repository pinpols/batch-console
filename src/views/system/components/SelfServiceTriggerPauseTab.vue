<template>
  <div class="trigger-pause">
    <el-alert
      type="info"
      :closable="false"
      show-icon
      :title="t('selfServicePanel.descTriggerPause')"
      class="trigger-pause__intro"
    />

    <el-form label-width="88px" class="form-section" @submit.prevent>
      <el-form-item :label="t('selfServicePanel.triggerJobCodeLabel')">
        <el-select
          v-model="jobCode"
          filterable
          :loading="listLoading"
          :placeholder="t('selfServicePanel.triggerJobCodePlaceholder')"
          class="query-w-full"
        >
          <el-option v-for="t in triggers" :key="t.jobCode" :label="t.jobCode" :value="t.jobCode">
            <span class="opt-row">
              <span>{{ t.jobCode }}</span>
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
        <el-button :icon="RefreshLeft" :disabled="submitting" @click="resetTriggerForm">
          {{ t('common.reset') }}
        </el-button>
        <el-button
          type="primary"
          class="pretty-primary-button"
          :icon="Promotion"
          :loading="submitting"
          :disabled="!jobCode"
          @click="submit"
        >
          {{ t('selfServicePanel.triggerSubmit') }}
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { Send as Promotion, RotateCcw as RefreshLeft } from '@lucide/vue'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import {
    listTriggers,
    pauseTrigger,
    resumeTrigger,
    type TriggerStatusResponse,
  } from '@/api/triggers'

  interface TriggerRow {
    jobCode: string
    paused?: boolean
  }

  const { t } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()

  const listLoading = ref(false)
  const submitting = ref(false)
  const triggers = ref<TriggerRow[]>([])
  const jobCode = ref<string>('')
  const action = ref<'pause' | 'resume'>('pause')

  async function loadTriggers() {
    if (!tenant.tenantId) return
    listLoading.value = true
    try {
      const raw = await listTriggers()
      const items = extractTriggers(raw)
      triggers.value = items
    } catch {
      triggers.value = []
    } finally {
      listLoading.value = false
    }
  }

  /** 固定数组契约；缺失作业编码的条目不能成为运维动作目标。 */
  function extractTriggers(rows: TriggerStatusResponse[]): TriggerRow[] {
    return rows.flatMap((row) => {
      const code = row.jobCode?.trim()
      return code ? [{ jobCode: code, paused: row.status?.toUpperCase() === 'PAUSED' }] : []
    })
  }

  function resetTriggerForm() {
    jobCode.value = ''
    action.value = 'pause'
  }

  async function submit() {
    if (!jobCode.value || !tenant.tenantId) return
    submitting.value = true
    try {
      if (action.value === 'pause') {
        await pauseTrigger(jobCode.value, tenant.tenantId)
        ElMessage.success(t('selfServicePanel.triggerSuccessPause', { code: jobCode.value }))
      } else {
        await resumeTrigger(jobCode.value, tenant.tenantId)
        ElMessage.success(t('selfServicePanel.triggerSuccessResume', { code: jobCode.value }))
      }
      void loadTriggers()
    } finally {
      submitting.value = false
    }
  }

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
