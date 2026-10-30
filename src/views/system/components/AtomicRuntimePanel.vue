<template>
  <SectionCard v-if="canRead" data-testid="atomic-runtime-panel">
    <template #header
      ><span>{{ t('atomicRuntime.title') }}</span
      ><el-button :loading="loading" @click="load">{{ t('common.refresh') }}</el-button></template
    >
    <p>{{ t('atomicRuntime.scope') }}</p>
    <DataState
      :loading="loading"
      :error="loadError"
      :error-text="t('atomicRuntime.loadError')"
      :has-data="Boolean(runtime)"
      :on-retry="load"
    >
      <template v-if="runtime">
        <p v-if="readAt">{{ t('atomicRuntime.readAt') }} <DatetimeText :value="readAt" /></p>
        <el-alert
          v-if="!runtime.available"
          :title="unavailableText"
          type="warning"
          :closable="false"
        />
        <template v-else>
          <p>
            {{
              t('atomicRuntime.worker', {
                code: runtime.workerCode || t('atomicRuntime.unknown'),
                type: runtime.workerType || t('atomicRuntime.unknown'),
              })
            }}
          </p>
          <el-table :data="rows" :aria-label="t('atomicRuntime.title')">
            <el-table-column :label="t('atomicRuntime.executor')" min-width="140"
              ><template #default="{ row }">{{
                executorLabel(row?.executor)
              }}</template></el-table-column
            >
            <el-table-column :label="t('atomicRuntime.enabled')" min-width="110"
              ><template #default="{ row }"
                ><el-tag
                  :type="
                    row.enabled === true ? 'success' : row.enabled === false ? 'info' : 'warning'
                  "
                  >{{
                    t(
                      row.enabled === true
                        ? 'atomicRuntime.on'
                        : row.enabled === false
                          ? 'atomicRuntime.off'
                          : 'atomicRuntime.unknown',
                    )
                  }}</el-tag
                ></template
              ></el-table-column
            >
            <el-table-column :label="t('atomicRuntime.gates')" min-width="300"
              ><template #default="{ row }"
                ><p v-for="detail in row.details" :key="detail.key">
                  {{ t(`atomicRuntime.fields.${detail.key}`) }}: {{ detailText(detail) }}
                </p></template
              ></el-table-column
            >
          </el-table>
        </template>
      </template>
    </DataState>
  </SectionCard>
</template>
<script setup lang="ts">
  import { computed, onBeforeUnmount, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { getAtomicRuntimeStatus, type AtomicRuntimeStatus } from '@/api/atomicRuntime'
  import { usePermission } from '@/composables/usePermission'
  import { atomicRuntimeRows, type RuntimeDetail } from '../atomicRuntimeModel'
  import SectionCard from '@/components/common/SectionCard.vue'
  import DataState from '@/components/common/DataState.vue'
  import DatetimeText from '@/components/common/DatetimeText.vue'
  const { t } = useI18n()
  function executorLabel(executor: unknown) {
    return typeof executor === 'string'
      ? t(`atomicRuntime.executors.${executor}`)
      : t('atomicRuntime.unknown')
  }
  const { hasPermission } = usePermission()
  const canRead = computed(() => hasPermission('ROLE_ADMIN') || hasPermission('ROLE_TENANT_ADMIN'))
  const loading = ref(false)
  const loadError = ref(false)
  const runtime = ref<AtomicRuntimeStatus | null>(null)
  const readAt = ref<string | null>(null)
  const rows = computed(() => atomicRuntimeRows(runtime.value))
  const unavailableText = computed(() => {
    const key =
      runtime.value?.unavailableReason === 'batch.console.atomic-worker.enabled=false'
        ? 'disabled'
        : runtime.value?.unavailableReason === 'atomic worker unreachable'
          ? 'unreachable'
          : runtime.value?.unavailableReason === 'empty response from atomic worker'
            ? 'empty'
            : 'other'
    return t(`atomicRuntime.unavailable.${key}`)
  })
  function detailText(detail: RuntimeDetail) {
    if (detail.value == null || detail.value === 'unknown') return t('atomicRuntime.unknown')
    if (detail.value === 'n/a') return t('atomicRuntime.notApplicable')
    if (detail.source)
      return ['explicit', 'prod-default', 'dev-default', 'absent'].includes(String(detail.value))
        ? t(`atomicRuntime.sources.${detail.value}`)
        : t('atomicRuntime.unknown')
    if (typeof detail.value === 'boolean') return t(detail.value ? 'common.yes' : 'common.no')
    return detail.value
  }
  let sequence = 0
  async function load() {
    const version = ++sequence
    runtime.value = null
    readAt.value = null
    loadError.value = false
    if (!canRead.value) {
      loading.value = false
      return
    }
    loading.value = true
    try {
      const response = await getAtomicRuntimeStatus()
      if (version === sequence && canRead.value) {
        runtime.value = response
        readAt.value = new Date().toISOString()
      }
    } catch {
      if (version === sequence) loadError.value = true
    } finally {
      if (version === sequence) loading.value = false
    }
  }
  watch(canRead, load, { immediate: true })
  onBeforeUnmount(() => {
    ++sequence
  })
</script>
