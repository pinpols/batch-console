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
  import { Send as Promotion, RotateCcw as RefreshLeft } from 'lucide-vue-next'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { listTriggers, pauseTrigger, resumeTrigger } from '@/api/triggers'

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
      const raw = await listTriggers(tenant.tenantId)
      const items = extractTriggers(raw)
      triggers.value = items
    } catch {
      triggers.value = []
    } finally {
      listLoading.value = false
    }
  }

  /** BE 返回 shape 不确定:可能是数组、可能是 { items } 包裹,容忍处理 */
  function extractTriggers(raw: unknown): TriggerRow[] {
    const arr: unknown[] = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as { items?: unknown })?.items)
        ? (raw as { items: unknown[] }).items
        : []
    const out: TriggerRow[] = []
    for (const it of arr) {
      if (!it || typeof it !== 'object') continue
      const r = it as Record<string, unknown>
      const code = String(r.jobCode ?? r.code ?? '').trim()
      if (!code) continue
      const status = String(r.triggerStatus ?? r.status ?? '').toUpperCase()
      const paused = status === 'PAUSED' || r.paused === true
      out.push({ jobCode: code, paused })
    }
    return out
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
