<template>
  <el-dialog
    v-model="visible"
    :title="t('jobConfigBasic.miniCalendarTitle')"
    :append-to-body="true"
    :close-on-click-modal="false"
    :close-on-press-escape="!saving"
    :before-close="onBeforeClose"
    width="520px"
    class="mini-create-dialog"
    align-center
    draggable
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="84px"
      label-position="right"
      class="mini-create-form"
      @submit.prevent
    >
      <el-form-item :label="t('jobConfigBasic.miniCalendarCode')" prop="calendarCode">
        <el-input
          v-model="form.calendarCode"
          :placeholder="t('jobConfigBasic.miniCalendarCodePlaceholder')"
          maxlength="128"
          show-word-limit
        />
      </el-form-item>
      <el-form-item :label="t('jobConfigBasic.miniCalendarName')" prop="calendarName">
        <el-input
          v-model="form.calendarName"
          :placeholder="t('jobConfigBasic.miniCalendarNamePlaceholder')"
          maxlength="256"
          show-word-limit
        />
      </el-form-item>
      <el-form-item :label="t('jobConfigBasic.fieldTimezone')" prop="timezone">
        <el-select v-model="form.timezone" class="query-w-full" filterable allow-create>
          <el-option v-for="tz in TIMEZONE_OPTIONS" :key="tz" :label="tz" :value="tz" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('jobDefinitionList.enabledLabel')" prop="enabled">
        <el-switch v-model="form.enabled" />
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="mini-create-dialog__footer">
        <el-button :disabled="saving" @click="close">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="saving" @click="submit">
          {{ t('common.confirm') }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
  /**
   * Calendar 现场建 mini 弹窗 — 把原 el-drawer 换成 el-dialog,避免从父 drawer
   * 内打开时双层抽屉互压;dialog 浮在中央,层级清晰,且小表单只 4 个字段适合用 modal。
   *
   * 用法不变:
   *   <CalendarMiniCreateDrawer
   *     v-model:visible="miniVisible"
   *     :tenant-id="editingTenantId"
   *     @created="(code) => (model.calendarCode = code)"
   *   />
   */
  import { reactive, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
  import { governanceApi, type GovernanceCalendarSavePayload } from '@/api/governance'
  import { useDirtyForm } from '@/composables/useDirtyForm'
  import { useFormFocus } from '@/composables/useFormFocus'

  const props = defineProps<{
    tenantId: string
  }>()
  const emit = defineEmits<{
    created: [calendarCode: string]
  }>()

  const visible = defineModel<boolean>('visible', { default: false })
  const { t } = useI18n({ useScope: 'global' })

  const TIMEZONE_OPTIONS = [
    'Asia/Shanghai',
    'Asia/Hong_Kong',
    'Asia/Tokyo',
    'Asia/Singapore',
    'UTC',
    'Europe/London',
    'America/New_York',
    'America/Los_Angeles',
  ] as const

  const formRef = ref<FormInstance>()
  const saving = ref(false)
  const form = reactive<GovernanceCalendarSavePayload>({
    tenantId: props.tenantId,
    calendarCode: '',
    calendarName: '',
    timezone: 'Asia/Shanghai',
    enabled: false,
  })

  const rules: FormRules = {
    calendarCode: [
      {
        required: true,
        message: t('jobConfigBasic.miniCalendarCodeRequired'),
        trigger: ['blur', 'change'],
      },
      {
        pattern: /^[a-zA-Z][a-zA-Z0-9_-]{0,127}$/,
        message: t('jobConfigBasic.miniCalendarCodePattern'),
        trigger: 'blur',
      },
    ],
    calendarName: [
      {
        required: true,
        message: t('jobConfigBasic.miniCalendarNameRequired'),
        trigger: ['blur', 'change'],
      },
      {
        validator: (_r, v: unknown, cb) => {
          const text = typeof v === 'string' ? v.trim() : ''
          if (!text) return cb(new Error(t('jobConfigBasic.miniCalendarNameRequired')))
          if (text.length > 256) return cb(new Error(t('common.maxLength', { max: 256 })))
          return cb()
        },
        trigger: 'blur',
      },
    ],
    timezone: [
      { required: true, message: t('jobConfigBasic.miniTimezoneRequired'), trigger: 'change' },
    ],
  }

  // 脏数据保护
  const dirty = useDirtyForm(() => form, { enabled: () => visible.value })
  useFormFocus(formRef, () => visible.value)
  watch(visible, (v) => {
    if (v) dirty.markPristine()
  })

  async function onBeforeClose(done: () => void) {
    if (saving.value) return
    if (!(await dirty.confirmDiscard())) return
    done()
  }

  async function close() {
    if (saving.value) return
    if (!(await dirty.confirmDiscard())) return
    visible.value = false
  }

  async function submit() {
    const valid = await formRef.value?.validate().catch(() => false)
    if (!valid) return
    saving.value = true
    try {
      const payload: GovernanceCalendarSavePayload = { ...form, tenantId: props.tenantId }
      await governanceApi.createCalendar(payload)
      ElMessage.success(t('jobConfigBasic.miniCalendarCreated', { code: form.calendarCode }))
      emit('created', form.calendarCode || '')
      dirty.markPristine()
      visible.value = false
      form.calendarCode = ''
      form.calendarName = ''
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      ElMessage.error(t('jobConfigBasic.miniCalendarCreateFailed', { message }))
    } finally {
      saving.value = false
    }
  }
</script>

<style scoped>
  .mini-create-dialog :deep(.el-dialog__header) {
    padding: 18px 22px 12px;
    margin-right: 0;
    border-bottom: 1px solid var(--color-border-subtle);
  }

  .mini-create-dialog :deep(.el-dialog__title) {
    font-size: 15px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .mini-create-dialog :deep(.el-dialog__body) {
    padding: 18px 22px 4px;
  }

  .mini-create-dialog :deep(.el-dialog__footer) {
    padding: 12px 22px 18px;
    border-top: 1px solid var(--color-border-subtle);
  }

  .mini-create-form :deep(.el-form-item) {
    margin-bottom: 16px;
  }

  .mini-create-form :deep(.el-form-item:last-of-type) {
    margin-bottom: 4px;
  }

  .mini-create-dialog__footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }
</style>
