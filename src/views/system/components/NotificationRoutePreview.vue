<template>
  <div class="route-sim">
    <el-alert :title="t('notificationRoutePreview.hint')" type="info" show-icon :closable="false" />
    <el-form class="route-sim__form" label-position="top" @submit.prevent="runPreview">
      <el-form-item
        class="route-sim__field route-sim__field--event"
        :label="t('notificationRoutePreview.eventType')"
        required
      >
        <el-select
          v-model="eventType"
          filterable
          :placeholder="t('notificationRoutePreview.selectEvent')"
        >
          <el-option
            v-for="event in events"
            :key="event.eventType"
            :label="t(`notificationRoutePreview.eventNames.${event.eventType}`, event.description)"
            :value="event.eventType"
          />
        </el-select>
      </el-form-item>
      <el-form-item
        v-if="eventType === 'ALERT_ESCALATED'"
        class="route-sim__field"
        :label="t('notificationRoutePreview.severity')"
        required
      >
        <el-select v-model="severity" :placeholder="t('notificationRoutePreview.selectSeverity')">
          <el-option
            v-for="option in severityOptions"
            :key="option.value"
            :value="option.value"
            :label="t(`enum.severity.${option.value}`, option.label)"
          />
        </el-select>
      </el-form-item>
      <el-form-item
        v-if="isJobEvent"
        class="route-sim__field"
        :label="t('notificationRoutePreview.jobCode')"
        required
      >
        <el-input v-model="jobCode" maxlength="128" clearable />
      </el-form-item>
      <div class="route-sim__action">
        <el-button
          type="primary"
          native-type="submit"
          :loading="loading"
          :disabled="
            !eventType ||
            !tenant.tenantId ||
            (isJobEvent && !jobCode.trim()) ||
            (isAlertEvent && !severity)
          "
        >
          {{ t('notificationRoutePreview.run') }}
        </el-button>
      </div>
    </el-form>
    <el-alert
      v-if="catalogError"
      :title="t('notificationRoutePreview.catalogError')"
      type="error"
      :closable="false"
    />
    <el-alert
      v-if="isAlertEvent && severityOptionsError"
      :title="t('notificationRoutePreview.severityError')"
      type="error"
      :closable="false"
    />
    <el-alert
      v-if="error"
      :title="t('notificationRoutePreview.error')"
      type="error"
      :closable="false"
    />
    <section v-if="result" class="route-sim__result" aria-live="polite">
      <p class="route-sim__summary">
        {{
          t('notificationRoutePreview.summary', {
            rules: result.rules.length,
            webhooks: result.webhooks.length,
          })
        }}
      </p>
      <div class="route-sim__panels">
        <div class="route-sim__panel">
          <header class="route-sim__panel-head">
            <h3>{{ t('notificationRoutePreview.rules') }}</h3>
            <span class="route-sim__count">{{ result.rules.length }}</span>
          </header>
          <el-empty
            v-if="!result.rules.length"
            :description="t('notificationRoutePreview.empty')"
            :image-size="48"
          />
          <el-table v-else :data="result.rules" size="small" class="console-table">
            <el-table-column prop="name" :label="t('notificationRoutePreview.ruleName')">
              <template #default="{ row }">
                <CopyableText v-if="row.name" :text="String(row.name)" />
                <span v-else class="cell-empty">—</span>
              </template>
            </el-table-column>
            <el-table-column prop="channelCode" :label="t('notificationRoutePreview.channelCode')">
              <template #default="{ row }">
                <CopyableText v-if="row.channelCode" :text="String(row.channelCode)" />
                <span v-else class="cell-empty">—</span>
              </template>
            </el-table-column>
            <el-table-column
              prop="channelType"
              :label="t('notificationRoutePreview.channelType')"
              width="120"
            />
          </el-table>
        </div>
        <div class="route-sim__panel">
          <header class="route-sim__panel-head">
            <h3>{{ t('notificationRoutePreview.webhooks') }}</h3>
            <span class="route-sim__count">{{ result.webhooks.length }}</span>
          </header>
          <el-empty
            v-if="!result.webhooks.length"
            :description="t('notificationRoutePreview.empty')"
            :image-size="48"
          />
          <el-table v-else :data="result.webhooks" size="small" class="console-table">
            <el-table-column prop="name" :label="t('notificationRoutePreview.subscriptionName')">
              <template #default="{ row }">
                <CopyableText v-if="row.name" :text="String(row.name)" />
                <span v-else class="cell-empty">—</span>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </section>
    <p v-else-if="!loading && !error" class="route-sim__idle">
      {{ t('notificationRoutePreview.idle') }}
    </p>
  </div>
</template>

<script setup lang="ts">
  import CopyableText from '@/components/common/CopyableText.vue'
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { listEventTypes, type EventCatalogTypeRow } from '@/api/eventCatalog'
  import { previewNotificationRoute } from '@/api/notifications'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantRequestScope } from '@/composables/useTenantRequestScope'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'

  const { t } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()
  const scope = useTenantRequestScope()
  const eventType = ref('')
  const severity = ref('')
  const jobCode = ref('')
  const isJobEvent = computed(
    () => eventType.value === 'JOB_SUCCESS' || eventType.value === 'JOB_FAILED',
  )
  const isAlertEvent = computed(() => eventType.value === 'ALERT_ESCALATED')
  const { data: metaEnums, isError: severityOptionsError } = useConsoleMetaEnumsQuery()
  const severityOptions = computed(() => pickMetaEnumGroup(metaEnums.value, 'severity'))
  const events = ref<EventCatalogTypeRow[]>([])
  const result = ref<Awaited<ReturnType<typeof previewNotificationRoute>> | null>(null)
  const loading = ref(false)
  const error = ref(false)
  const catalogError = ref(false)
  // 与当前后端预览支持的实际事件载荷保持一致，目录扩展时不能展示暂不支持的模拟项。
  const supportedEvents = new Set([
    'JOB_SUCCESS',
    'JOB_FAILED',
    'WORKFLOW_SUCCESS',
    'WORKFLOW_FAILED',
    'ALERT_ESCALATED',
  ])

  listEventTypes()
    .then((rows) => {
      events.value = rows.filter((row) => supportedEvents.has(row.eventType))
      catalogError.value = events.value.length === 0
    })
    .catch(() => {
      catalogError.value = true
    })
  watch(
    eventType,
    () => {
      severity.value = ''
      jobCode.value = ''
    },
    { flush: 'sync' },
  )
  watch(
    [eventType, severity, jobCode, () => tenant.tenantId],
    () => {
      scope.begin()
      result.value = null
      error.value = false
      loading.value = false
    },
    { flush: 'sync' },
  )

  async function runPreview() {
    if (
      !tenant.tenantId ||
      !eventType.value ||
      (isJobEvent.value && !jobCode.value.trim()) ||
      (isAlertEvent.value && !severity.value)
    )
      return
    const request = scope.begin()
    loading.value = true
    result.value = null
    error.value = false
    try {
      const response = await previewNotificationRoute(
        request.tenantId,
        eventType.value,
        severity.value.trim(),
        jobCode.value.trim(),
      )
      if (scope.isCurrent(request)) result.value = response
    } catch {
      if (scope.isCurrent(request)) error.value = true
    } finally {
      if (scope.isCurrent(request)) loading.value = false
    }
  }
</script>

<style scoped>
  .route-sim {
    display: flex;
    flex-direction: column;
    gap: var(--page-block-gap, 16px);
  }

  /* 条件区：字段横排，按钮与输入框底边对齐，避免整行拉满与按钮孤立 */
  .route-sim__form {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 0 16px;
    padding: 16px 20px 0;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
  }

  .route-sim__field {
    flex: 0 1 240px;
    min-width: 200px;
    margin-bottom: 16px;
  }

  .route-sim__field--event {
    flex-basis: 320px;
  }

  .route-sim__field :deep(.el-select) {
    width: 100%;
  }

  .route-sim__action {
    margin-bottom: 16px;
  }

  .route-sim__summary {
    margin: 0 0 12px;
    color: var(--color-text-primary);
    font-size: var(--font-size-md);
    font-weight: 600;
  }

  .route-sim__panels {
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    gap: 16px;
  }

  .route-sim__panel {
    min-width: 0;
    padding: 14px 16px 16px;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
  }

  .route-sim__panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
  }

  .route-sim__panel-head h3 {
    margin: 0;
    font-size: var(--font-size-md);
    font-weight: 600;
  }

  .route-sim__count {
    min-width: 24px;
    padding: 1px 8px;
    border-radius: 999px;
    background: var(--color-bg-canvas);
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    font-variant-numeric: tabular-nums;
    text-align: center;
  }

  .route-sim__panel :deep(.el-empty) {
    padding: 12px 0;
  }

  .route-sim__idle {
    margin: 0;
    padding: 28px 20px;
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-content);
    color: var(--color-text-tertiary);
    font-size: var(--font-size-sm);
    text-align: center;
  }

  @media (max-width: 960px) {
    .route-sim__panels {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @media (max-width: 640px) {
    .route-sim__field,
    .route-sim__field--event {
      flex: 1 1 100%;
    }

    .route-sim__action,
    .route-sim__action :deep(.el-button) {
      width: 100%;
    }
  }
</style>
