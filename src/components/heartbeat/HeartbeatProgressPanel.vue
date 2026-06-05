<template>
  <div class="hb-panel">
    <div class="hb-panel__head">
      <div class="hb-panel__title">
        <span>{{ t('heartbeatPanel.title', { taskId }) }}</span>
        <el-tag v-if="details?.cancelRequested" size="small" type="warning" effect="plain">
          {{ t('heartbeatPanel.cancelRequested') }}
        </el-tag>
        <el-tag
          v-if="details?.taskStatus"
          size="small"
          :type="statusType(details.taskStatus)"
          effect="plain"
        >
          {{ details.taskStatus }}
        </el-tag>
      </div>
      <div class="hb-panel__actions">
        <el-switch
          v-model="autoRefresh"
          :active-text="t('heartbeatPanel.autoRefresh')"
          inline-prompt
          size="small"
        />
        <el-button :icon="Refresh" :loading="loading" size="small" @click="load">
          {{ t('common.refresh') }}
        </el-button>
      </div>
    </div>

    <div v-if="loadError" class="hb-panel__row">
      <el-alert
        type="error"
        show-icon
        :closable="false"
        :title="t('heartbeatPanel.loadError')"
      />
    </div>

    <div v-else-if="loading && !details" class="hb-panel__row">
      <el-skeleton :rows="2" animated />
    </div>

    <div v-else-if="notFound" class="hb-panel__row">
      <el-alert
        type="info"
        show-icon
        :closable="false"
        :title="t('heartbeatPanel.notFoundTitle')"
      >
        <template #default>{{ t('heartbeatPanel.notFoundBody') }}</template>
      </el-alert>
    </div>

    <template v-else-if="details">
      <div v-if="percent !== null" class="hb-panel__progress">
        <el-progress :percentage="percent" :stroke-width="12" />
      </div>

      <div class="hb-panel__meta">
        <span>
          {{ t('heartbeatPanel.heartbeatAt') }}:
          <strong v-if="details.heartbeatAt">{{ fmtDatetime(details.heartbeatAt) }}</strong>
          <span v-else class="muted">{{ t('heartbeatPanel.noHeartbeat') }}</span>
        </span>
      </div>

      <div v-if="details.details" class="hb-panel__details">
        <JsonPreview :data="details.details" />
      </div>
      <el-alert
        v-else
        type="info"
        show-icon
        :closable="false"
        class="hb-panel__row"
        :title="t('heartbeatPanel.noDetailsTitle')"
      >
        <template #default>{{ t('heartbeatPanel.noDetailsBody') }}</template>
      </el-alert>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { Refresh } from '@element-plus/icons-vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'
  import { fmtDatetime } from '@/utils/datetime'
  import { useAutoRefresh } from '@/composables/useAutoRefresh'
  import {
    getTaskHeartbeatDetails,
    extractProgressPercent,
    type TaskHeartbeatDetails,
  } from '@/api/taskHeartbeat'
  import { useTenantStore } from '@/stores/tenant'

  const { t } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()

  const props = defineProps<{ taskId: number; pollMs?: number }>()

  const details = ref<TaskHeartbeatDetails | null>(null)
  const loading = ref(false)
  const loadError = ref(false)
  const notFound = ref(false)
  const autoRefresh = ref(false)

  const percent = computed(() => extractProgressPercent(details.value?.details))

  function statusType(s: string): 'success' | 'info' | 'warning' | 'danger' {
    switch (s) {
      case 'SUCCESS':
        return 'success'
      case 'RUNNING':
      case 'READY':
        return 'info'
      case 'FAILED':
      case 'TERMINATED':
        return 'danger'
      default:
        return 'warning'
    }
  }

  async function load() {
    loading.value = true
    loadError.value = false
    try {
      const r = await getTaskHeartbeatDetails(props.taskId, tenant.tenantId)
      if (r === null) {
        notFound.value = true
        details.value = null
      } else {
        notFound.value = false
        details.value = r
      }
    } catch {
      loadError.value = true
    } finally {
      loading.value = false
    }
  }

  watch(
    () => props.taskId,
    (id) => {
      if (id) void load()
    },
    { immediate: true },
  )

  // useAutoRefresh:tab 不可见自动暂停 + 卸载自动清理。autoRefresh 关时不发请求。
  useAutoRefresh(() => {
    if (autoRefresh.value && props.taskId) void load()
  }, props.pollMs ?? 10_000)
</script>

<style scoped>
  .hb-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .hb-panel__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }

  .hb-panel__title {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .hb-panel__actions {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .hb-panel__progress {
    padding-block: 4px;
  }

  .hb-panel__meta {
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  .hb-panel__row {
    margin-block: 4px;
  }

  .hb-panel__details {
    max-height: 360px;
    overflow: auto;
  }

  .muted {
    color: var(--color-text-tertiary);
  }
</style>
