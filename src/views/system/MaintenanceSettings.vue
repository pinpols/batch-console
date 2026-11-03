<template>
  <PageContainer>
    <PageHeader />

    <SectionCard class="maintenance-settings__card">
      <template #header>
        <div class="maintenance-settings__summary">
          <div class="maintenance-settings__section-heading">
            <span>{{ t('maintenanceSettings.currentState') }}</span>
            <el-tag :type="statusTagType" effect="plain">
              {{ statusLabel }}
            </el-tag>
          </div>
          <dl v-if="state" class="maintenance-settings__metadata">
            <div>
              <dt>{{ t('maintenanceSettings.versionLabel') }}</dt>
              <dd>{{ state.version ?? '—' }}</dd>
            </div>
            <div>
              <dt>{{ t('maintenanceSettings.updatedAtLabel') }}</dt>
              <dd>{{ formatTimestamp(state.updatedAt) }}</dd>
            </div>
          </dl>
        </div>
      </template>

      <el-alert
        v-if="form.enabled"
        class="maintenance-settings__alert"
        :title="
          isScheduled
            ? t('maintenanceSettings.scheduledEffect')
            : form.readOnly
              ? t('maintenanceSettings.readOnlyEffect')
              : t('maintenanceSettings.fullFreezeEffect')
        "
        type="warning"
        :closable="false"
        show-icon
      />

      <el-form label-position="top" class="maintenance-settings__form">
        <el-form-item :label="t('maintenanceSettings.enabledLabel')">
          <el-switch
            v-model="form.enabled"
            :active-text="t('maintenanceSettings.enabled')"
            :inactive-text="t('maintenanceSettings.disabled')"
          />
        </el-form-item>

        <el-form-item :label="t('maintenanceSettings.modeLabel')">
          <el-radio-group v-model="form.readOnly" :disabled="!form.enabled">
            <el-radio-button :value="true">
              {{ t('maintenanceSettings.readOnlyMode') }}
            </el-radio-button>
            <el-radio-button :value="false">
              {{ t('maintenanceSettings.fullFreezeMode') }}
            </el-radio-button>
          </el-radio-group>
          <div class="maintenance-settings__hint">
            {{ t('maintenanceSettings.modeHint') }}
          </div>
        </el-form-item>

        <el-form-item :label="t('maintenanceSettings.etaLabel')">
          <el-date-picker
            v-model="form.etaAt"
            type="datetime"
            value-format="YYYY-MM-DDTHH:mm:ss.SSSZ"
            :placeholder="t('maintenanceSettings.etaPlaceholder')"
            :clearable="true"
          />
          <div class="maintenance-settings__hint">{{ t('maintenanceSettings.etaHint') }}</div>
        </el-form-item>

        <el-form-item :label="t('maintenanceSettings.startsAtLabel')">
          <el-date-picker
            v-model="form.startsAt"
            type="datetime"
            value-format="YYYY-MM-DDTHH:mm:ss.SSSZ"
            :placeholder="t('maintenanceSettings.startsAtPlaceholder')"
            :clearable="true"
            :disabled="!form.enabled"
          />
          <div class="maintenance-settings__hint">{{ t('maintenanceSettings.startsAtHint') }}</div>
        </el-form-item>

        <el-form-item :label="t('maintenanceSettings.messageLabel')">
          <el-input
            v-model="form.message"
            type="textarea"
            :rows="3"
            maxlength="2048"
            show-word-limit
            :placeholder="t('maintenanceSettings.messagePlaceholder')"
          />
        </el-form-item>

        <el-form-item :label="t('maintenanceSettings.affectedServicesLabel')">
          <el-input
            v-model="form.affectedServicesText"
            type="textarea"
            :rows="2"
            :placeholder="t('maintenanceSettings.affectedServicesPlaceholder')"
          />
          <div class="maintenance-settings__hint">
            {{ t('maintenanceSettings.affectedServicesHint') }}
          </div>
        </el-form-item>
      </el-form>

      <div class="maintenance-settings__actions">
        <el-button :loading="loading" :disabled="saving" @click="load">
          {{ t('maintenanceSettings.reload') }}
        </el-button>
        <el-button type="primary" :loading="saving" :disabled="loading || !state" @click="save">
          {{ t('maintenanceSettings.save') }}
        </el-button>
      </div>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import { confirmDanger } from '@/composables/useDangerConfirm'
  import { getAdminMaintenanceState, updateMaintenance } from '@/api/system.maintenance'
  import type { MaintenanceStatus } from '@/api/system.maintenance'
  import { useAppStore } from '@/stores/app'
  import { useAuthStore } from '@/stores/auth'
  import { displayTimezone } from '@/constants/timezone'
  import { fmtDatetime } from '@/utils/datetime'

  const { t } = useI18n({ useScope: 'global' })
  const app = useAppStore()
  const auth = useAuthStore()
  const loading = ref(false)
  const saving = ref(false)
  const currentTime = ref(Date.now())
  let currentTimeTimer: ReturnType<typeof setInterval> | null = null
  const state = ref<MaintenanceStatus | null>(null)
  const form = reactive({
    enabled: false,
    readOnly: true,
    message: '',
    etaAt: '',
    startsAt: '',
    affectedServicesText: '',
  })

  const isScheduled = computed(() => {
    if (!form.startsAt) return false
    const startsAtDate = new Date(form.startsAt)
    const startsAtTime = startsAtDate.getTime()
    return startsAtTime > currentTime.value
  })
  const statusLabel = computed(() =>
    !form.enabled
      ? t('maintenanceSettings.disabled')
      : isScheduled.value
        ? t('maintenanceSettings.scheduled')
        : form.readOnly
          ? t('maintenanceSettings.readOnlyMode')
          : t('maintenanceSettings.fullFreezeMode'),
  )
  const statusTagType = computed(() =>
    !form.enabled || isScheduled.value ? 'info' : form.readOnly ? 'warning' : 'danger',
  )

  function toIsoTimestamp(value: string): string {
    const date = new Date(value)
    const isoText = date.toISOString()
    return isoText
  }

  function applyState(next: MaintenanceStatus) {
    state.value = next
    form.enabled = next.enabled
    form.readOnly = next.readOnly
    form.message = next.message ?? ''
    form.etaAt = next.etaAt ? toIsoTimestamp(next.etaAt) : ''
    form.startsAt = next.startsAt ? toIsoTimestamp(next.startsAt) : ''
    form.affectedServicesText = next.affectedServices.join('\n')
  }

  async function load() {
    loading.value = true
    try {
      const maintenanceState = await getAdminMaintenanceState()
      applyState(maintenanceState)
    } catch {
      ElMessage.error(t('maintenanceSettings.loadFailed'))
    } finally {
      loading.value = false
    }
  }

  function affectedServices() {
    const trimmedServices = form.affectedServicesText.split(/[\n,;]+/).map((value) => value.trim())
    const uniqueServices = [...new Set(trimmedServices)]
    return uniqueServices.filter(Boolean)
  }

  async function save() {
    if (saving.value || !state.value) return
    const services = affectedServices()
    if (services.length > 50) {
      ElMessage.error(t('maintenanceSettings.affectedServicesTooMany'))
      return
    }
    if (services.some((service) => service.length > 64)) {
      ElMessage.error(t('maintenanceSettings.affectedServiceTooLong'))
      return
    }
    const changesMode =
      state.value &&
      (form.enabled !== state.value.enabled ||
        (form.enabled && state.value.readOnly !== form.readOnly) ||
        form.startsAt !== (state.value.startsAt ? toIsoTimestamp(state.value.startsAt) : ''))
    if (changesMode) {
      try {
        await confirmDanger({
          verb: form.enabled
            ? t('maintenanceSettings.confirmEnableVerb')
            : t('maintenanceSettings.confirmDisableVerb'),
          target: t('maintenanceSettings.confirmTarget'),
          consequence: isScheduled.value
            ? t('maintenanceSettings.scheduledEffect')
            : form.enabled
              ? form.readOnly
                ? t('maintenanceSettings.readOnlyEffect')
                : t('maintenanceSettings.fullFreezeEffect')
              : t('maintenanceSettings.disabledEffect'),
          confirmButtonText: form.enabled
            ? t('maintenanceSettings.confirmEnable')
            : t('maintenanceSettings.confirmDisable'),
          cancelButtonText: t('common.cancel'),
        })
      } catch {
        return
      }
    }

    saving.value = true
    try {
      const updated = await updateMaintenance({
        enabled: form.enabled,
        readOnly: form.readOnly,
        message: form.message.trim() || undefined,
        etaAt: form.etaAt ? toIsoTimestamp(form.etaAt) : undefined,
        startsAt: form.enabled && form.startsAt ? toIsoTimestamp(form.startsAt) : undefined,
        affectedServices: services,
      })
      applyState(updated)
      app.setMaintenance({
        ...updated,
        adminBypass: updated.active && auth.hasPermission('ROLE_ADMIN'),
        lastSyncedAt: new Date().toISOString(),
        syncError: null,
        isStale: false,
      })
      ElMessage.success(t('maintenanceSettings.saveSuccess'))
    } catch {
      ElMessage.error(t('maintenanceSettings.saveFailed'))
    } finally {
      saving.value = false
    }
  }

  function formatTimestamp(value: string | null | undefined) {
    if (!value) return '—'
    return fmtDatetime(value, displayTimezone.value)
  }

  onMounted(() => {
    currentTimeTimer = setInterval(() => (currentTime.value = Date.now()), 1_000)
    void load()
  })
  onUnmounted(() => {
    if (currentTimeTimer) clearInterval(currentTimeTimer)
  })
</script>

<style scoped>
  .maintenance-settings__card :deep(.el-card__header) {
    padding-block: calc(var(--space-sm) + var(--space-xs));
  }

  .maintenance-settings__card :deep(.el-card__body) {
    padding-block: var(--space-md);
  }

  .maintenance-settings__summary,
  .maintenance-settings__section-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
  }

  .maintenance-settings__summary {
    width: 100%;
    flex-wrap: wrap;
    gap: var(--space-sm) var(--space-lg);
  }

  .maintenance-settings__section-heading {
    justify-content: flex-start;
    font-weight: 600;
  }

  .maintenance-settings__metadata {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-xs) var(--space-lg);
    margin: 0;
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }

  .maintenance-settings__metadata div {
    display: flex;
    gap: var(--space-xs);
    align-items: baseline;
  }

  .maintenance-settings__metadata dd {
    margin: 0;
    color: var(--color-text-primary);
    font-variant-numeric: tabular-nums;
  }

  .maintenance-settings__alert {
    margin-top: var(--space-sm);
  }

  .maintenance-settings__form {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: var(--space-xl);
    margin-top: var(--space-sm);
  }

  .maintenance-settings__form :deep(.el-form-item) {
    min-width: 0;
    margin-bottom: var(--space-sm);
  }

  .maintenance-settings__form :deep(.el-form-item__label) {
    margin-bottom: var(--space-xs);
  }

  .maintenance-settings__form :deep(.el-radio-group) {
    max-width: 100%;
    flex-wrap: wrap;
  }

  .maintenance-settings__form :deep(.el-date-editor) {
    width: 100%;
  }

  .maintenance-settings__hint {
    flex-basis: 100%;
    margin-top: var(--space-xs);
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    line-height: 1.5;
  }

  .maintenance-settings__actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--space-sm);
    padding-top: var(--space-sm);
    border-top: 1px solid var(--color-border-light);
  }

  .maintenance-settings__actions :deep(.el-button + .el-button) {
    margin-left: 0;
  }

  @media (max-width: 640px) {
    .maintenance-settings__form {
      grid-template-columns: minmax(0, 1fr);
    }

    .maintenance-settings__actions :deep(.el-button) {
      flex: 1 1 auto;
    }
  }
</style>
