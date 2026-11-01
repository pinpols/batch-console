<template>
  <el-alert :title="t('notificationRoutePreview.hint')" type="info" show-icon :closable="false" />
  <el-form label-position="top" @submit.prevent="runPreview">
    <el-form-item :label="t('notificationRoutePreview.eventType')" required>
      <el-select
        v-model="eventType"
        filterable
        :placeholder="t('notificationRoutePreview.selectEvent')"
      >
        <el-option
          v-for="event in events"
          :key="event.eventType"
          :label="`${event.eventType} — ${event.description}`"
          :value="event.eventType"
        />
      </el-select>
    </el-form-item>
    <el-form-item
      v-if="eventType === 'ALERT_ESCALATED'"
      :label="t('notificationRoutePreview.severity')"
      required
    >
      <el-select v-model="severity" :placeholder="t('notificationRoutePreview.selectSeverity')">
        <el-option
          v-for="option in severityOptions"
          :key="option.value"
          :value="option.value"
          :label="option.label"
        />
      </el-select>
    </el-form-item>
    <el-form-item v-if="isJobEvent" :label="t('notificationRoutePreview.jobCode')" required>
      <el-input v-model="jobCode" maxlength="128" clearable />
    </el-form-item>
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
  <section v-if="result" aria-live="polite">
    <h3>{{ t('notificationRoutePreview.rules') }}</h3>
    <el-empty
      v-if="!result.rules.length"
      :description="t('notificationRoutePreview.empty')"
      :image-size="60"
    />
    <el-table v-else :data="result.rules">
      <el-table-column prop="name" :label="t('notificationRoutePreview.ruleName')" />
      <el-table-column prop="channelCode" :label="t('notificationRoutePreview.channelCode')" />
      <el-table-column prop="channelType" :label="t('notificationRoutePreview.channelType')" />
    </el-table>
    <h3>{{ t('notificationRoutePreview.webhooks') }}</h3>
    <el-empty
      v-if="!result.webhooks.length"
      :description="t('notificationRoutePreview.empty')"
      :image-size="60"
    />
    <el-table v-else :data="result.webhooks">
      <el-table-column prop="name" :label="t('notificationRoutePreview.subscriptionName')" />
    </el-table>
  </section>
</template>

<script setup lang="ts">
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
