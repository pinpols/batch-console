<template>
  <FormDrawer
    v-model:visible="visible"
    :title="
      windowEditingId == null
        ? t('queueConfig.windowCreateTitle')
        : t('queueConfig.windowEditTitle')
    "
    destroy-on-close
    :saving="saving"
    @submit="emit('save')"
  >
    <el-form :model="windowForm" label-position="top" @submit.prevent>
      <FormSection :title="t('queueConfig.sectionBasic')" :columns="2">
        <el-form-item :label="t('queueConfig.fieldWindowCode')" required>
          <el-input
            v-model="windowForm.windowCode"
            :disabled="windowEditingId != null"
            maxlength="128"
          />
        </el-form-item>
        <el-form-item :label="t('queueConfig.fieldWindowName')">
          <el-input v-model="windowForm.windowName" maxlength="256" />
        </el-form-item>
        <el-form-item :label="t('queueConfig.fieldEnabled')">
          <el-switch v-model="windowForm.enabled" />
        </el-form-item>
      </FormSection>
      <FormSection
        :title="t('queueConfig.sectionWindowTime')"
        :description="t('queueConfig.sectionWindowTimeDesc')"
        :columns="2"
      >
        <el-form-item class="form-block__full" :label="t('queueConfig.fieldTimezone')" required>
          <el-input v-model="windowForm.timezone" maxlength="64" />
        </el-form-item>
        <el-form-item :label="t('queueConfig.fieldStartTime')" required>
          <el-time-picker
            v-model="windowForm.startTime"
            class="query-w-full"
            value-format="HH:mm:ss"
          />
        </el-form-item>
        <el-form-item :label="t('queueConfig.fieldEndTime')" required>
          <el-time-picker
            v-model="windowForm.endTime"
            class="query-w-full"
            value-format="HH:mm:ss"
          />
        </el-form-item>
        <el-form-item class="form-block__full" :label="t('queueConfig.fieldAllowCrossDay')">
          <el-switch v-model="windowForm.allowCrossDay" />
        </el-form-item>
        <el-form-item class="form-block__full" :label="t('queueConfig.windowPreviewTitle')">
          <WindowSchedulePreview
            :start-time="windowForm.startTime"
            :end-time="windowForm.endTime"
            :timezone="windowForm.timezone"
            :allow-cross-day="windowForm.allowCrossDay"
          />
        </el-form-item>
      </FormSection>
      <FormSection :title="t('queueConfig.sectionWindowBehavior')" :columns="2">
        <el-form-item :label="t('queueConfig.fieldEndStrategy')">
          <MetaSelect
            v-model="windowForm.endStrategy"
            enum-key="endStrategy"
            class="query-w-full"
            clearable
          />
        </el-form-item>
        <el-form-item :label="t('queueConfig.fieldOutOfWindowAction')">
          <MetaSelect
            v-model="windowForm.outOfWindowAction"
            enum-key="outOfWindowAction"
            class="query-w-full"
            clearable
          />
        </el-form-item>
        <el-form-item class="form-block__full" :label="t('queueConfig.fieldDescription')">
          <el-input
            v-model="windowForm.description"
            type="textarea"
            maxlength="512"
            show-word-limit
          />
        </el-form-item>
      </FormSection>
    </el-form>
  </FormDrawer>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import FormDrawer from '@/components/common/FormDrawer.vue'
  import FormSection from '@/components/common/FormSection.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import WindowSchedulePreview from './WindowSchedulePreview.vue'

  /** 批次窗口编辑抽屉：从 QueueConfig 拆出，按“基本信息 / 开放时间 / 窗口外行为”分节 */
  defineProps<{
    windowForm: {
      windowCode: string
      windowName: string
      timezone: string
      startTime: string
      endTime: string
      endStrategy: string
      outOfWindowAction: string
      allowCrossDay: boolean
      enabled: boolean
      description: string
    }
    windowEditingId: number | null
    saving: boolean
  }>()
  const visible = defineModel<boolean>({ required: true })
  const emit = defineEmits<{ save: [] }>()
  const { t } = useI18n({ useScope: 'global' })
</script>
