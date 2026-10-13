<template>
  <PageContainer>
    <PageHeader />

    <SectionCard>
      <template #header>
        <div class="maintenance-settings__section-heading">
          <span>{{ t('maintenanceSettings.currentState') }}</span>
          <el-tag :type="statusTagType" effect="plain">
            {{ statusLabel }}
          </el-tag>
        </div>
      </template>

      <el-alert
        v-if="form.enabled"
        :title="t('maintenanceSettings.activeWarning')"
        :description="
          form.readOnly
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

        <el-form-item :label="t('maintenanceSettings.etaLabel')">
          <el-date-picker
            v-model="form.etaAt"
            type="datetime"
            value-format="YYYY-MM-DDTHH:mm:ss.SSSZ"
            :placeholder="t('maintenanceSettings.etaPlaceholder')"
            :clearable="true"
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

      <el-descriptions v-if="state" :column="2" border class="maintenance-settings__metadata">
        <el-descriptions-item :label="t('maintenanceSettings.versionLabel')">
          {{ state.version ?? '—' }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('maintenanceSettings.updatedAtLabel')">
          {{ formatTimestamp(state.updatedAt) }}
        </el-descriptions-item>
      </el-descriptions>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, onMounted, reactive, ref } from 'vue'
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

  const { t } = useI18n({ useScope: 'global' })
  const app = useAppStore()
  const auth = useAuthStore()
  const loading = ref(false)
  const saving = ref(false)
  const state = ref<MaintenanceStatus | null>(null)
  const form = reactive({
    enabled: false,
    readOnly: true,
    message: '',
    etaAt: '',
    affectedServicesText: '',
  })

  const statusLabel = computed(() =>
    !form.enabled
      ? t('maintenanceSettings.disabled')
      : form.readOnly
        ? t('maintenanceSettings.readOnlyMode')
        : t('maintenanceSettings.fullFreezeMode'),
  )
  const statusTagType = computed(() =>
    !form.enabled ? 'info' : form.readOnly ? 'warning' : 'danger',
  )

  function applyState(next: MaintenanceStatus) {
    state.value = next
    form.enabled = next.enabled
    form.readOnly = next.readOnly
    form.message = next.message ?? ''
    form.etaAt = next.etaAt ? new Date(next.etaAt).toISOString() : ''
    form.affectedServicesText = next.affectedServices.join('\n')
  }

  async function load() {
    loading.value = true
    try {
      applyState(await getAdminMaintenanceState())
    } catch {
      ElMessage.error(t('maintenanceSettings.loadFailed'))
    } finally {
      loading.value = false
    }
  }

  function affectedServices() {
    return [
      ...new Set(form.affectedServicesText.split(/[\n,;]+/).map((value) => value.trim())),
    ].filter(Boolean)
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
        (form.enabled && state.value.readOnly !== form.readOnly))
    if (changesMode) {
      try {
        await confirmDanger({
          verb: form.enabled
            ? t('maintenanceSettings.confirmEnableVerb')
            : t('maintenanceSettings.confirmDisableVerb'),
          target: t('maintenanceSettings.confirmTarget'),
          consequence: form.enabled
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
        etaAt: form.etaAt ? new Date(form.etaAt).toISOString() : undefined,
        affectedServices: services,
      })
      applyState(updated)
      app.setMaintenance({
        ...updated,
        adminBypass: updated.enabled && auth.hasPermission('ROLE_ADMIN'),
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
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
  }

  onMounted(() => void load())
</script>

<style scoped>
  .maintenance-settings__section-heading,
  .maintenance-settings__actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
  }

  .maintenance-settings__form {
    max-width: 760px;
    margin-top: var(--space-md);
  }

  .maintenance-settings__hint {
    margin-top: var(--space-xs);
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    line-height: 1.5;
  }

  .maintenance-settings__metadata {
    margin-top: var(--space-lg);
  }

  @media (max-width: 640px) {
    .maintenance-settings__section-heading,
    .maintenance-settings__actions {
      align-items: flex-start;
      flex-direction: column;
    }

    .maintenance-settings__actions :deep(.el-button) {
      width: 100%;
      margin-left: 0;
    }
  }
</style>
