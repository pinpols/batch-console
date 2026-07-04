<template>
  <el-dialog
    v-model="visible"
    :title="t('jobConfigBasic.miniWindowTitle')"
    :append-to-body="true"
    :close-on-click-modal="false"
    :close-on-press-escape="!saving"
    :before-close="onBeforeClose"
    width="560px"
    class="mini-create-dialog"
    align-center
    draggable
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="92px"
      label-position="right"
      class="mini-create-form"
      @submit.prevent
    >
      <el-form-item :label="t('jobConfigBasic.miniWindowCode')" prop="windowCode">
        <el-input
          v-model="form.windowCode"
          :placeholder="t('jobConfigBasic.miniWindowCodePlaceholder')"
          maxlength="128"
          show-word-limit
        />
      </el-form-item>
      <el-form-item :label="t('jobConfigBasic.miniWindowName')" prop="windowName">
        <el-input
          v-model="form.windowName"
          :placeholder="t('jobConfigBasic.miniWindowNamePlaceholder')"
          maxlength="256"
          show-word-limit
        />
      </el-form-item>
      <el-form-item :label="t('jobConfigBasic.fieldTimezone')" prop="timezone">
        <el-select v-model="form.timezone" class="query-w-full" filterable allow-create>
          <el-option v-for="tz in TIMEZONE_OPTIONS" :key="tz" :label="tz" :value="tz" />
        </el-select>
      </el-form-item>

      <!-- 开始/结束时间合并到一行,节省纵向空间 -->
      <el-form-item :label="t('jobConfigBasic.miniWindowTimeRangeLabel')">
        <div class="time-range">
          <el-form-item prop="startTime" class="time-range__item">
            <el-time-picker
              v-model="startTimeProxy"
              format="HH:mm:ss"
              value-format="HH:mm:ss"
              :placeholder="t('jobConfigBasic.miniWindowStartPlaceholder')"
              class="query-w-full"
            />
          </el-form-item>
          <span class="time-range__dash">→</span>
          <el-form-item prop="endTime" class="time-range__item">
            <el-time-picker
              v-model="endTimeProxy"
              format="HH:mm:ss"
              value-format="HH:mm:ss"
              :placeholder="t('jobConfigBasic.miniWindowEndPlaceholder')"
              class="query-w-full"
            />
          </el-form-item>
        </div>
      </el-form-item>

      <!-- 跨天 + 启用合并一行,密度提升 -->
      <el-form-item :label="t('jobConfigBasic.miniWindowOptionsLabel')">
        <div class="switch-row">
          <label class="switch-row__item">
            <el-switch v-model="form.allowCrossDay" />
            <span>{{ t('jobConfigBasic.miniWindowAllowCrossDay') }}</span>
          </label>
          <label class="switch-row__item">
            <el-switch v-model="form.enabled" />
            <span>{{ t('jobDefinitionList.enabledLabel') }}</span>
          </label>
        </div>
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
   * Batch Window 现场建 mini 弹窗 — 从 el-drawer 改为 el-dialog,
   * 避免双层 drawer 互压;布局更紧凑(时段合并一行 + 跨天/启用一行)。
   */
  import { computed, reactive, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
  import { governanceApi, type GovernanceBatchWindowSavePayload } from '@/api/governance'
  import { useDirtyForm } from '@/composables/useDirtyForm'
  import { useFormFocus } from '@/composables/useFormFocus'

  const props = defineProps<{
    tenantId: string
  }>()
  const emit = defineEmits<{
    created: [windowCode: string]
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
  const form = reactive<GovernanceBatchWindowSavePayload>({
    tenantId: props.tenantId,
    windowCode: '',
    windowName: '',
    timezone: 'Asia/Shanghai',
    startTime: '',
    endTime: '',
    allowCrossDay: false,
    enabled: false,
  })

  // el-time-picker 返回 Date 或 null,form 字段是 string —— 用 computed proxy 桥接
  const startTimeProxy = computed({
    get: () => form.startTime ?? '',
    set: (v) => (form.startTime = v ?? ''),
  })
  const endTimeProxy = computed({
    get: () => form.endTime ?? '',
    set: (v) => (form.endTime = v ?? ''),
  })

  const rules: FormRules = {
    windowCode: [
      {
        required: true,
        message: t('jobConfigBasic.miniWindowCodeRequired'),
        trigger: ['blur', 'change'],
      },
      {
        pattern: /^[a-zA-Z][a-zA-Z0-9_-]{0,127}$/,
        message: t('jobConfigBasic.miniCalendarCodePattern'),
        trigger: 'blur',
      },
    ],
    windowName: [
      {
        validator: (_r, v: unknown, cb) => {
          const text = typeof v === 'string' ? v.trim() : ''
          if (text && text.length > 256) return cb(new Error(t('common.maxLength', { max: 256 })))
          return cb()
        },
        trigger: 'blur',
      },
    ],
    timezone: [
      { required: true, message: t('jobConfigBasic.miniTimezoneRequired'), trigger: 'change' },
    ],
    startTime: [
      { required: true, message: t('jobConfigBasic.miniWindowStartRequired'), trigger: 'change' },
    ],
    endTime: [
      { required: true, message: t('jobConfigBasic.miniWindowEndRequired'), trigger: 'change' },
    ],
  }

  // 脏数据保护:关闭前若有未保存修改弹 confirm
  const dirty = useDirtyForm(() => form, { enabled: () => visible.value })
  useFormFocus(formRef, () => visible.value)

  // visible 由父传入,打开时重置基线(form 此时是默认值或上次提交后的残留)
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
      const payload: GovernanceBatchWindowSavePayload = { ...form, tenantId: props.tenantId }
      await governanceApi.createBatchWindow(payload)
      ElMessage.success(t('jobConfigBasic.miniWindowCreated', { code: form.windowCode }))
      emit('created', form.windowCode || '')
      dirty.markPristine()
      visible.value = false
      form.windowCode = ''
      form.windowName = ''
      form.startTime = ''
      form.endTime = ''
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      ElMessage.error(t('jobConfigBasic.miniWindowCreateFailed', { message }))
    } finally {
      saving.value = false
    }
  }
</script>

<style scoped>
  .mini-create-dialog :deep(.el-dialog__header) {
    padding: 18px 22px 12px;
    margin-right: 0;
    border-bottom: 1px solid var(--color-border-light);
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
    border-top: 1px solid var(--color-border-light);
  }

  .mini-create-form :deep(.el-form-item) {
    margin-bottom: 16px;
  }

  .mini-create-form :deep(.el-form-item:last-of-type) {
    margin-bottom: 4px;
  }

  /* 嵌套 form-item:外层只承担 label,内层各自负责校验提示,不再额外缩进 */
  .time-range {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
  }
  .time-range__item {
    flex: 1;
    margin-bottom: 0 !important;
  }
  .time-range__item :deep(.el-form-item__content) {
    margin-left: 0 !important;
  }
  .time-range__dash {
    color: var(--color-text-tertiary);
    font-size: 14px;
  }

  .switch-row {
    display: flex;
    align-items: center;
    gap: 24px;
    flex-wrap: wrap;
  }
  .switch-row__item {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--color-text-secondary);
    cursor: pointer;
  }

  .mini-create-dialog__footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }
</style>
