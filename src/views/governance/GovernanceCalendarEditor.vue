<template>
  <el-drawer
    :append-to-body="true"
    v-model="visible"
    :title="
      calendarEditingId == null
        ? t('queueConfig.calendarCreateTitle')
        : t('queueConfig.calendarEditTitle')
    "
    direction="rtl"
    size="640px"
    destroy-on-close
  >
    <el-form :model="calendarForm" label-width="120px">
      <el-form-item :label="t('queueConfig.fieldCalendarCode')" required>
        <el-input
          v-model="calendarForm.calendarCode"
          :disabled="calendarEditingId != null"
          maxlength="128"
        />
      </el-form-item>
      <el-form-item :label="t('queueConfig.fieldCalendarName')" required
        ><el-input v-model="calendarForm.calendarName" maxlength="256"
      /></el-form-item>
      <el-form-item :label="t('queueConfig.fieldTimezone')" required
        ><el-input v-model="calendarForm.timezone" maxlength="64"
      /></el-form-item>
      <el-form-item :label="t('queueConfig.fieldHolidayRollRule')"
        ><MetaSelect
          v-model="calendarForm.holidayRollRule"
          enum-key="holidayStrategy"
          class="query-w-full"
          clearable
      /></el-form-item>
      <el-form-item :label="t('queueConfig.fieldCatchUpPolicy')"
        ><MetaSelect
          v-model="calendarForm.catchUpPolicy"
          enum-key="catchUpPolicy"
          class="query-w-full"
          clearable
      /></el-form-item>
      <el-form-item :label="t('queueConfig.fieldCatchUpMaxDays')"
        ><el-input-number v-model="calendarForm.catchUpMaxDays" :min="0" :max="INT32_MAX"
      /></el-form-item>
      <el-form-item :label="t('queueConfig.fieldEnabled')"
        ><el-switch v-model="calendarForm.enabled"
      /></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="saving" @click="emit('save')">{{
        t('common.save')
      }}</el-button>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import MetaSelect from '@/components/common/MetaSelect.vue'

  defineProps<{
    calendarForm: {
      calendarCode: string
      calendarName: string
      timezone: string
      holidayRollRule: string
      catchUpPolicy: string
      catchUpMaxDays: number | undefined
      enabled: boolean
    }
    calendarEditingId: number | null
    saving: boolean
  }>()
  const visible = defineModel<boolean>({ required: true })
  const emit = defineEmits<{ save: [] }>()
  const { t } = useI18n({ useScope: 'global' })
  const INT32_MAX = 2147483647
</script>
