<template>
    <SectionCard>
      <h2>{{ t('configBatchRecovery.title') }}</h2>
      <el-alert v-if="recoveryStorageBlocked" type="warning" :closable="false"
        :title="t('configBatchRecovery.storageUnavailable')" />
      <div v-for="command in recoveryCommands" :key="command.key">
        <p>{{ t('configBatchRecovery.record', { tenant: command.auditTenantId, kind: recoveryKindLabel(command), time: new Date(command.createdAt).toLocaleString() }) }}</p>
        <el-button :disabled="!!recoveryLoadingKey" @click="emit('check', command)">
          {{ t('configBatchRecovery.check') }}
        </el-button>
        <div v-if="recoveryCurrent?.key === command.key" aria-live="polite">
          <p v-if="recoveryCurrent.error">{{ t(recoveryCurrent.error) }}</p>
          <template v-if="recoveryCurrent.result">
            <p v-if="recoveryCurrent.result.status === 'COMPLETE'">{{ t('configBatchRecovery.complete') }}</p>
            <ul>
              <li v-for="target in recoveryCurrent.result.targets" :key="target.ordinal">
                {{ target.ordinal + 1 }}. {{ target.tenantId }} —
                {{ t(target.status === 'UNKNOWN' || !target.result ? 'configBatchRecovery.unknown' : target.result.success ? 'configBatchRecovery.success' : 'configBatchRecovery.failed') }}
                <span v-if="target.result?.errorMessage">{{ target.result.errorMessage }}</span>
              </li>
            </ul>
            <el-button v-if="recoveryCurrent.result.status === 'COMPLETE'" @click="emit('acknowledge', command)">
              {{ t('configBatchRecovery.acknowledge') }}
            </el-button>
          </template>
          <el-button v-if="canStopRecovery(command)" @click="emit('stop', command)">
            {{ t('configBatchRecovery.stopTracking') }}
          </el-button>
        </div>
      </div>
    </SectionCard>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import SectionCard from '@/components/common/SectionCard.vue'
  import type { ConfigBatchRecovery } from '@/utils/configBatchRecovery'
  import type { ConfigBatchRecoveryResponse } from '@/api/configBatchRecovery'

  defineProps<{
    recoveryCommands: ConfigBatchRecovery[]
    recoveryStorageBlocked: boolean
    recoveryLoadingKey: string
    recoveryCurrent?: { key: string; result?: ConfigBatchRecoveryResponse; error?: string }
    recoveryKindLabel: (command: ConfigBatchRecovery) => string
    canStopRecovery: (command: ConfigBatchRecovery) => boolean
  }>()
  const emit = defineEmits<{
    check: [command: ConfigBatchRecovery]
    acknowledge: [command: ConfigBatchRecovery]
    stop: [command: ConfigBatchRecovery]
  }>()
  const { t } = useI18n({ useScope: 'global' })
</script>
