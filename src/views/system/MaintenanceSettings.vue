<template>
  <PageContainer>
    <PageHeader />

    <!-- 状态头：先回答“现在用户能不能用”，再给出版本与更新时间 -->
    <section class="mt-status" :class="`is-${statusTone}`" aria-live="polite">
      <span class="mt-status__lamp" aria-hidden="true" />
      <div class="mt-status__main">
        <p class="mt-status__eyebrow">{{ t('maintenanceSettings.currentState') }}</p>
        <h2 class="mt-status__headline">{{ statusHeadline }}</h2>
        <p v-if="isDirty" class="mt-status__dirty">{{ t('maintenanceSettings.unsavedChanges') }}</p>
        <p class="mt-status__effect">{{ statusEffect }}</p>
      </div>
      <dl v-if="state" class="mt-status__meta">
        <div>
          <dt>{{ t('maintenanceSettings.versionLabel') }}</dt>
          <dd>{{ state.version ?? '—' }}</dd>
        </div>
        <div>
          <dt>{{ t('maintenanceSettings.updatedAtLabel') }}</dt>
          <dd>{{ formatTimestamp(state.updatedAt) }}</dd>
        </div>
      </dl>

      <div v-if="windowBar" class="mt-window" :aria-label="t('maintenanceSettings.windowTitle')">
        <div class="mt-window__track">
          <span
            class="mt-window__span"
            :style="{
              left: `${windowBar.startPct}%`,
              width: `${windowBar.endPct - windowBar.startPct}%`,
            }"
          />
          <span class="mt-window__now" :style="{ left: `${windowBar.nowPct}%` }">
            <b>{{ t('maintenanceSettings.windowNow') }}</b>
          </span>
        </div>
        <div class="mt-window__labels">
          <span>{{ t('maintenanceSettings.windowStart', { time: windowBar.startLabel }) }}</span>
          <span>{{ t('maintenanceSettings.windowEnd', { time: windowBar.endLabel }) }}</span>
        </div>
      </div>
    </section>

    <SectionCard class="mt-card">
      <el-form label-position="top" class="mt-form" @submit.prevent>
        <section class="mt-section">
          <header class="mt-section__head">
            <h3>{{ t('maintenanceSettings.sectionMode') }}</h3>
            <p>{{ t('maintenanceSettings.sectionModeDesc') }}</p>
          </header>
          <div class="mt-section__body">
            <el-form-item :label="t('maintenanceSettings.enabledLabel')">
              <div class="mt-switch">
                <el-switch v-model="form.enabled" />
                <span :class="{ 'is-on': form.enabled }">
                  {{
                    form.enabled
                      ? t('maintenanceSettings.enabled')
                      : t('maintenanceSettings.disabled')
                  }}
                </span>
              </div>
            </el-form-item>

            <el-form-item :label="t('maintenanceSettings.modeLabel')">
              <el-radio-group v-model="form.readOnly" :disabled="!form.enabled" class="mt-modes">
                <el-radio :value="true" border class="mt-mode">
                  <span class="mt-mode__title">{{ t('maintenanceSettings.readOnlyMode') }}</span>
                  <span class="mt-mode__desc">{{ t('maintenanceSettings.readOnlyEffect') }}</span>
                </el-radio>
                <el-radio :value="false" border class="mt-mode mt-mode--danger">
                  <span class="mt-mode__title">{{ t('maintenanceSettings.fullFreezeMode') }}</span>
                  <span class="mt-mode__desc">{{ t('maintenanceSettings.fullFreezeEffect') }}</span>
                </el-radio>
              </el-radio-group>
            </el-form-item>
          </div>
        </section>

        <section class="mt-section">
          <header class="mt-section__head">
            <h3>{{ t('maintenanceSettings.sectionWindow') }}</h3>
            <p>{{ t('maintenanceSettings.sectionWindowDesc') }}</p>
          </header>
          <div class="mt-section__body mt-section__body--pair">
            <el-form-item :label="t('maintenanceSettings.startsAtLabel')">
              <el-date-picker
                v-model="form.startsAt"
                type="datetime"
                value-format="YYYY-MM-DDTHH:mm:ss.SSSZ"
                :placeholder="t('maintenanceSettings.startsAtPlaceholder')"
                :clearable="true"
                :disabled="!form.enabled"
              />
              <div class="mt-hint">{{ t('maintenanceSettings.startsAtHint') }}</div>
            </el-form-item>
            <el-form-item :label="t('maintenanceSettings.etaLabel')">
              <el-date-picker
                v-model="form.etaAt"
                type="datetime"
                value-format="YYYY-MM-DDTHH:mm:ss.SSSZ"
                :placeholder="t('maintenanceSettings.etaPlaceholder')"
                :clearable="true"
              />
              <div class="mt-hint">{{ t('maintenanceSettings.etaHint') }}</div>
            </el-form-item>
          </div>
        </section>

        <section class="mt-section">
          <header class="mt-section__head">
            <h3>{{ t('maintenanceSettings.sectionNotice') }}</h3>
            <p>{{ t('maintenanceSettings.sectionNoticeDesc') }}</p>
          </header>
          <div class="mt-section__body">
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
              <div class="mt-hint">{{ t('maintenanceSettings.affectedServicesHint') }}</div>
            </el-form-item>
          </div>
        </section>
      </el-form>

      <div class="mt-actions">
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
  type StatusTone = 'normal' | 'scheduled' | 'readonly' | 'freeze'
  const statusTone = computed<StatusTone>(() =>
    !form.enabled
      ? 'normal'
      : isScheduled.value
        ? 'scheduled'
        : form.readOnly
          ? 'readonly'
          : 'freeze',
  )
  const STATUS_HEADLINE: Record<StatusTone, string> = {
    normal: 'maintenanceSettings.headlineOff',
    scheduled: 'maintenanceSettings.headlineScheduled',
    readonly: 'maintenanceSettings.headlineReadOnly',
    freeze: 'maintenanceSettings.headlineFullFreeze',
  }
  const STATUS_EFFECT: Record<StatusTone, string> = {
    normal: 'maintenanceSettings.normalEffect',
    scheduled: 'maintenanceSettings.scheduledEffect',
    readonly: 'maintenanceSettings.readOnlyEffect',
    freeze: 'maintenanceSettings.fullFreezeEffect',
  }
  /** 状态头展示的是表单草稿；与已保存状态不同时明确提示，避免把预览当成已生效 */
  const isDirty = computed(() => {
    const saved = state.value
    if (!saved) return false
    const savedStartsAt = saved.startsAt ? toIsoTimestamp(saved.startsAt) : ''
    const savedEtaAt = saved.etaAt ? toIsoTimestamp(saved.etaAt) : ''
    return (
      form.enabled !== saved.enabled ||
      form.readOnly !== saved.readOnly ||
      form.startsAt !== savedStartsAt ||
      form.etaAt !== savedEtaAt ||
      form.message !== (saved.message ?? '') ||
      affectedServices().join('\n') !== saved.affectedServices.join('\n')
    )
  })
  const statusHeadline = computed(() => t(STATUS_HEADLINE[statusTone.value]))
  const statusEffect = computed(() => t(STATUS_EFFECT[statusTone.value]))

  /** 维护窗口条：开始（留空即现在）到预计恢复；缺预计恢复或区间无效时不画，不伪造结束点 */
  const windowBar = computed(() => {
    if (!form.enabled || !form.etaAt) return null
    const startMs = form.startsAt ? new Date(form.startsAt).getTime() : currentTime.value
    const endMs = new Date(form.etaAt).getTime()
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null
    const fromMs = Math.min(startMs, currentTime.value)
    const toMs = Math.max(endMs, currentTime.value)
    const pct = (ms: number) => ((ms - fromMs) / (toMs - fromMs)) * 100
    return {
      startPct: pct(startMs),
      endPct: pct(endMs),
      nowPct: pct(currentTime.value),
      startLabel: formatTimestamp(new Date(startMs).toISOString()),
      endLabel: formatTimestamp(form.etaAt),
    }
  })

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
  /* 状态头：语义色左缘 + 指示灯，正常态保持安静 */
  .mt-status {
    --mt-tone: var(--color-success);
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 6px 16px;
    align-items: start;
    margin-bottom: 16px;
    padding: 20px 22px;
    border: 1px solid var(--color-border);
    border-left: 4px solid var(--mt-tone);
    border-radius: var(--radius-content);
    background: var(--color-bg-card);
  }

  .mt-status.is-scheduled {
    --mt-tone: var(--color-primary);
  }

  .mt-status.is-readonly {
    --mt-tone: var(--color-warning);
  }

  .mt-status.is-freeze {
    --mt-tone: var(--color-danger);
  }

  .mt-status__lamp {
    width: 12px;
    height: 12px;
    margin-top: 30px;
    border-radius: 50%;
    background: var(--mt-tone);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--mt-tone) 18%, transparent);
  }

  .mt-status__eyebrow {
    margin: 0;
    color: var(--color-text-tertiary);
    font-size: var(--font-size-sm);
  }

  .mt-status__headline {
    margin: 2px 0 4px;
    font-size: var(--font-size-xl);
    font-weight: 600;
    line-height: 1.3;
  }

  .mt-status__dirty {
    display: inline-block;
    margin: 0 0 6px;
    padding: 1px 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-warning) 14%, transparent);
    color: var(--color-warning);
    font-size: var(--font-size-xs);
    font-weight: 600;
  }

  .mt-status__effect {
    max-width: 72ch;
    margin: 0;
    color: var(--color-text-secondary);
  }

  .mt-status__meta {
    display: grid;
    gap: 6px;
    margin: 0;
    font-size: var(--font-size-sm);
    text-align: right;
  }

  .mt-status__meta dt {
    color: var(--color-text-tertiary);
  }

  .mt-status__meta dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
  }

  .mt-window {
    grid-column: 2 / -1;
    margin-top: 12px;
  }

  .mt-window__track {
    position: relative;
    height: 10px;
    border-radius: 999px;
    background: var(--color-bg-subtle);
    box-shadow: inset 0 0 0 1px var(--color-border-light);
  }

  .mt-window__span {
    position: absolute;
    top: 0;
    bottom: 0;
    border-radius: 999px;
    background: color-mix(in srgb, var(--mt-tone) 55%, transparent);
  }

  .mt-window__now {
    position: absolute;
    top: -5px;
    bottom: -5px;
    border-left: 2px solid var(--color-text-primary);
  }

  .mt-window__now b {
    position: absolute;
    top: -18px;
    left: 4px;
    font-size: var(--font-size-xs);
    white-space: nowrap;
  }

  .mt-window__labels {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-top: 6px;
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    font-variant-numeric: tabular-nums;
  }

  /* 表单按主题分节：左侧说明、右侧字段 */
  .mt-card :deep(.el-card__body) {
    padding: 0;
  }

  .mt-section {
    display: grid;
    grid-template-columns: minmax(180px, 260px) minmax(0, 1fr);
    gap: 16px 40px;
    padding: 22px 24px;
  }

  .mt-section + .mt-section {
    border-top: 1px solid var(--color-border-light);
  }

  .mt-section__head h3 {
    margin: 0 0 6px;
    font-size: var(--font-size-lg);
    font-weight: 600;
  }

  .mt-section__head p {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    line-height: 1.55;
  }

  .mt-section__body {
    min-width: 0;
  }

  .mt-section__body--pair {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 24px;
  }

  .mt-section__body :deep(.el-form-item) {
    margin-bottom: 18px;
  }

  .mt-section__body :deep(.el-form-item:last-child) {
    margin-bottom: 0;
  }

  .mt-section__body :deep(.el-date-editor) {
    width: 100%;
  }

  .mt-switch {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--color-text-secondary);
  }

  .mt-switch .is-on {
    color: var(--color-warning);
    font-weight: 600;
  }

  .mt-modes {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    width: 100%;
  }

  .mt-modes :deep(.mt-mode.el-radio) {
    height: auto;
    margin: 0;
    padding: 14px 16px;
    align-items: flex-start;
    border-radius: var(--radius-content);
    white-space: normal;
  }

  .mt-modes :deep(.mt-mode .el-radio__input) {
    margin-top: 3px;
  }

  .mt-modes :deep(.mt-mode .el-radio__label) {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-left: 10px;
  }

  /* 维护关闭时模式只是预选值，不用危险色强调 */
  .mt-modes :deep(.mt-mode--danger.is-checked:not(.is-disabled)) {
    border-color: var(--color-danger);
  }

  .mt-modes :deep(.mt-mode--danger.is-checked:not(.is-disabled) .el-radio__inner) {
    border-color: var(--color-danger);
    background: var(--color-danger);
  }

  .mt-modes :deep(.mt-mode.is-disabled) {
    background: var(--color-bg-subtle);
  }

  .mt-modes :deep(.mt-mode.is-disabled.is-checked) {
    border-color: var(--color-text-tertiary);
  }

  .mt-mode__title {
    color: var(--color-text-primary);
    font-weight: 600;
  }

  .mt-mode__desc {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    font-weight: 400;
    line-height: 1.5;
  }

  .mt-hint {
    flex-basis: 100%;
    margin-top: 6px;
    color: var(--color-text-tertiary);
    font-size: var(--font-size-xs);
    line-height: 1.55;
  }

  .mt-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--space-sm);
    padding: 14px 24px;
    border-top: 1px solid var(--color-border-light);
    background: var(--color-bg-subtle);
    border-radius: 0 0 var(--radius-content) var(--radius-content);
  }

  .mt-actions :deep(.el-button + .el-button) {
    margin-left: 0;
  }

  @media (max-width: 960px) {
    .mt-section {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @media (max-width: 640px) {
    .mt-status {
      grid-template-columns: auto minmax(0, 1fr);
    }

    .mt-status__meta {
      grid-column: 2;
      text-align: left;
    }

    .mt-window {
      grid-column: 1 / -1;
    }

    .mt-section__body--pair,
    .mt-modes {
      grid-template-columns: minmax(0, 1fr);
    }

    .mt-actions :deep(.el-button) {
      flex: 1 1 auto;
    }
  }
</style>
