<template>
  <el-drawer
    :append-to-body="true"
    v-model="visible"
    :title="
      queueEditingId == null ? t('queueConfig.queueCreateTitle') : t('queueConfig.queueEditTitle')
    "
    direction="rtl"
    size="640px"
    destroy-on-close
  >
    <el-form :model="queueForm" label-width="120px">
      <el-form-item :label="t('queueConfig.fieldQueueCode')" :error="errors?.queueCode" required>
        <el-input
          v-model="queueForm.queueCode"
          :disabled="queueEditingId != null"
          maxlength="128"
        />
      </el-form-item>
      <el-form-item :label="t('queueConfig.fieldQueueName')"
        ><el-input v-model="queueForm.queueName" maxlength="256"
      /></el-form-item>
      <el-form-item :label="t('queueConfig.fieldQueueType')" :error="errors?.queueType" required
        ><MetaSelect v-model="queueForm.queueType" enum-key="queueType" class="query-w-full"
      /></el-form-item>
      <div class="queue-limits">
        <el-form-item :label="t('queueConfig.fieldMaxRunningJobs')" label-position="top">
          <el-input-number v-model="queueForm.maxRunningJobs" :min="0" :max="INT32_MAX" />
        </el-form-item>
        <el-form-item :label="t('queueConfig.fieldMaxRunningPartitions')" label-position="top">
          <el-input-number v-model="queueForm.maxRunningPartitions" :min="0" :max="INT32_MAX" />
        </el-form-item>
        <el-form-item :label="t('queueConfig.fieldMaxQps')" label-position="top">
          <el-input-number v-model="queueForm.maxQps" :min="0" :max="INT32_MAX" />
        </el-form-item>
      </div>
      <el-form-item :label="t('queueConfig.fieldWorkerGroup')"
        ><el-input v-model="queueForm.workerGroup" maxlength="128"
      /></el-form-item>
      <el-form-item :label="t('queueConfig.fieldResourceTag')"
        ><el-input v-model="queueForm.resourceTag" maxlength="64"
      /></el-form-item>
      <el-form-item :label="t('queueConfig.fieldPriorityPolicy')"
        ><MetaSelect
          v-model="queueForm.priorityPolicy"
          enum-key="priorityPolicy"
          class="query-w-full"
          clearable
      /></el-form-item>
      <el-form-item :label="t('queueConfig.fieldFairShareWeight')"
        ><el-input-number v-model="queueForm.fairShareWeight" :min="1" :max="INT32_MAX"
      /></el-form-item>
      <el-form-item :label="t('queueConfig.fieldEnabled')"
        ><el-switch v-model="queueForm.enabled"
      /></el-form-item>
      <el-form-item :label="t('queueConfig.fieldDescription')"
        ><el-input v-model="queueForm.description" type="textarea" maxlength="512" show-word-limit
      /></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="saving" @click="emit('save')">{{
        t('common.save')
      }}</el-button>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import MetaSelect from '@/components/common/MetaSelect.vue'

  defineProps<{
    queueForm: {
      queueCode: string
      queueName: string
      queueType: string
      maxRunningJobs: number | undefined
      maxRunningPartitions: number | undefined
      maxQps: number | undefined
      workerGroup: string
      resourceTag: string
      priorityPolicy: string
      fairShareWeight: number | undefined
      enabled: boolean
      description: string
    }
    queueEditingId: number | null
    errors?: { queueCode: string; queueType: string }
    saving: boolean
  }>()
  const visible = defineModel<boolean>({ required: true })
  const emit = defineEmits<{ save: [] }>()
  const { t } = useI18n({ useScope: 'global' })
  const INT32_MAX = 2147483647
</script>

<style scoped>
  .queue-limits {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 0 var(--space-md);
  }

  .queue-limits :deep(.el-input-number) {
    width: 100%;
  }

  .queue-limits :deep(.el-form-item:last-child) {
    margin-bottom: var(--space-md);
  }
</style>
