<template>
  <div class="job-config-basic-form">
    <CalendarMiniCreateDrawer
      v-if="tenantId"
      v-model:visible="calendarMiniVisible"
      :tenant-id="tenantId"
      @created="onCalendarCreated"
    />
    <WindowMiniCreateDrawer
      v-if="tenantId"
      v-model:visible="windowMiniVisible"
      :tenant-id="tenantId"
      @created="onWindowCreated"
    />
    <!-- 基本信息 -->
    <div v-if="showSection('basic')" class="config-group">
      <div v-if="!singleSection" class="config-group__title">
        {{ t('jobConfigBasic.groupBasic') }}
      </div>
      <el-form-item :label="t('jobDefinitionList.fieldJobCode')">
        <el-input
          v-model="model.jobCode"
          :disabled="readonlyIdentity"
          maxlength="128"
          show-word-limit
        />
      </el-form-item>
      <el-form-item :label="t('jobDefinitionList.fieldJobName')" prop="jobName">
        <el-input v-model="model.jobName" maxlength="256" show-word-limit />
      </el-form-item>
      <el-form-item :label="t('jobDefinitionList.fieldJobType')">
        <el-input v-if="readonlyIdentity" :model-value="model.jobType" disabled />
        <MetaSelect v-else v-model="model.jobType" class="query-w-full" enum-key="jobType" />
      </el-form-item>
      <el-form-item :label="t('jobDefinitionList.enabledLabel')" prop="enabled">
        <el-switch v-model="model.enabled" />
      </el-form-item>
      <el-form-item :label="t('jobDefinitionList.fieldExecutionMode')" prop="executionMode">
        <MetaSelect
          v-model="model.executionMode"
          class="query-w-full"
          enum-key="executionMode"
          :options="executionModeOptions"
        />
      </el-form-item>
      <el-form-item
        v-if="model.executionMode === 'INCREMENTAL'"
        :label="t('jobDefinitionList.fieldWatermark')"
        prop="watermarkField"
      >
        <el-input
          v-model="model.watermarkField"
          :placeholder="t('jobDefinitionList.fieldWatermarkPlaceholder')"
          maxlength="64"
          show-word-limit
        />
      </el-form-item>
    </div>

    <!-- 调度配置 -->
    <div v-if="showSection('schedule')" class="config-group">
      <div v-if="!singleSection" class="config-group__title">
        {{ t('jobConfigBasic.groupSchedule') }}
      </div>
      <el-form-item :label="t('jobDefinitionList.fieldScheduleType')" prop="scheduleType">
        <MetaSelect
          v-model="model.scheduleType"
          class="query-w-full"
          enum-key="scheduleType"
          :options="scheduleTypeOptions"
        />
      </el-form-item>
      <!-- scheduleType=MANUAL 时不需要 cron / 日历 / 窗口,本组其他字段隐藏 -->
      <template v-if="!isManualSchedule">
        <el-form-item :label="t('jobDefinitionList.fieldScheduleExpr')" prop="scheduleExpr">
          <CronExprInput v-model="model.scheduleExpr" />
        </el-form-item>
      </template>
      <el-form-item :label="t('jobConfigBasic.fieldTimezone')" prop="timezone">
        <el-select
          v-model="model.timezone"
          class="query-w-full"
          filterable
          allow-create
          clearable
          :placeholder="t('jobConfigBasic.placeholderTimezone')"
        >
          <el-option v-for="tz in TIMEZONE_OPTIONS" :key="tz" :label="tz" :value="tz" />
        </el-select>
      </el-form-item>
      <template v-if="!isManualSchedule">
        <el-form-item :label="t('jobConfigBasic.fieldCalendarCode')" prop="calendarCode">
          <div class="inline-create-wrapper">
            <el-input
              v-model="model.calendarCode"
              :placeholder="t('jobConfigBasic.placeholderCalendar')"
              class="inline-create-input"
            />
            <el-button
              v-if="tenantId"
              :icon="Plus"
              link
              type="primary"
              class="inline-create-btn"
              @click="calendarMiniVisible = true"
            >
              {{ t('jobConfigBasic.inlineCreateCalendar') }}
            </el-button>
          </div>
        </el-form-item>
        <el-form-item :label="t('jobConfigBasic.fieldWindowCode')" prop="windowCode">
          <div class="inline-create-wrapper">
            <el-input
              v-model="model.windowCode"
              :placeholder="t('jobConfigBasic.placeholderWindow')"
              class="inline-create-input"
            />
            <el-button
              v-if="tenantId"
              :icon="Plus"
              link
              type="primary"
              class="inline-create-btn"
              @click="windowMiniVisible = true"
            >
              {{ t('jobConfigBasic.inlineCreateWindow') }}
            </el-button>
          </div>
        </el-form-item>
      </template>
    </div>

    <!-- 资源 / 队列 -->
    <div v-if="showSection('resource')" class="config-group">
      <div v-if="!singleSection" class="config-group__title">
        {{ t('jobConfigBasic.groupResource') }}
      </div>
      <el-form-item :label="t('jobDefinitionList.queueLabel')" prop="queueCode">
        <MetaSelect
          v-model="model.queueCode"
          class="query-w-full"
          clearable
          filterable
          :options="queueOptions"
        />
      </el-form-item>
      <el-form-item :label="t('jobDefinitionList.workerGroupLabel')" prop="workerGroup">
        <el-select
          v-model="model.workerGroup"
          class="query-w-full"
          filterable
          allow-create
          clearable
        >
          <el-option
            v-for="g in workerGroupOptions ?? []"
            :key="g.value"
            :label="g.label ?? g.value"
            :value="g.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('jobConfigBasic.fieldShardStrategy')" prop="shardStrategy">
        <MetaSelect
          v-model="model.shardStrategy"
          class="query-w-full"
          enum-key="shardStrategy"
          clearable
          :placeholder="t('jobConfigBasic.placeholderShardStrategy')"
        />
      </el-form-item>
      <el-form-item :label="t('jobConfigBasic.fieldPriority')" prop="priority">
        <el-input-number v-model="model.priority" :min="0" :max="10" class="query-w-160" />
      </el-form-item>
    </div>

    <!-- 重试与超时 -->
    <div v-if="showSection('retry')" class="config-group">
      <div v-if="!singleSection" class="config-group__title">
        {{ t('jobConfigBasic.groupRetry') }}
      </div>
      <el-form-item :label="t('jobConfigBasic.fieldRetryPolicy')" prop="retryPolicy">
        <MetaSelect
          v-model="model.retryPolicy"
          class="query-w-full"
          enum-key="retryPolicy"
          clearable
          :placeholder="t('jobConfigBasic.placeholderRetryPolicy')"
        />
      </el-form-item>
      <el-form-item :label="t('jobConfigBasic.fieldRetryMaxCount')" prop="retryMaxCount">
        <el-input-number
          v-model="model.retryMaxCount"
          :min="0"
          :max="100"
          class="query-w-160"
          :disabled="isNoRetry"
        />
        <span v-if="isNoRetry" class="field-hint">{{
          t('jobConfigBasic.retryMaxCountDisabledHint')
        }}</span>
      </el-form-item>
      <el-form-item :label="t('jobConfigBasic.fieldTimeoutSeconds')" prop="timeoutSeconds">
        <el-input-number v-model="model.timeoutSeconds" :min="0" :max="86400" class="query-w-160" />
      </el-form-item>
      <el-form-item :label="t('jobConfigBasic.fieldTriggerMode')" prop="triggerMode">
        <MetaSelect
          v-model="model.triggerMode"
          class="query-w-full"
          enum-key="triggerMode"
          clearable
          :placeholder="t('jobConfigBasic.placeholderTriggerMode')"
        />
      </el-form-item>
      <el-form-item :label="t('jobConfigBasic.fieldDagEnabled')" prop="dagEnabled">
        <el-switch v-model="model.dagEnabled" />
      </el-form-item>
    </div>

    <!-- 业务参数 -->
    <div v-if="showSection('params')" class="config-group">
      <div v-if="!singleSection" class="config-group__title">
        {{ t('jobConfigBasic.groupParams') }}
      </div>
      <el-form-item :label="t('jobConfigBasic.fieldExecutionHandler')" prop="executionHandler">
        <el-input
          v-model="model.executionHandler"
          :placeholder="t('jobConfigBasic.placeholderExecutionHandler')"
        />
      </el-form-item>
      <el-form-item :label="t('jobConfigBasic.fieldParamSchema')" prop="paramSchema">
        <JsonTextareaInput
          v-model="model.paramSchema"
          :rows="3"
          :placeholder="t('jobConfigBasic.placeholderJson')"
        />
      </el-form-item>
      <el-form-item :label="t('jobConfigBasic.fieldDefaultParams')" prop="defaultParams">
        <JsonTextareaInput
          v-model="model.defaultParams"
          :rows="3"
          :placeholder="t('jobConfigBasic.placeholderJson')"
        />
      </el-form-item>
      <el-form-item :label="t('jobConfigBasic.fieldBizType')" prop="bizType">
        <el-input v-model="model.bizType" maxlength="64" />
      </el-form-item>
      <el-form-item :label="t('jobConfigBasic.fieldDescription')" prop="description">
        <el-input
          v-model="model.description"
          type="textarea"
          :rows="2"
          maxlength="1024"
          show-word-limit
        />
      </el-form-item>
    </div>
  </div>
</template>

<script setup lang="ts">
  /**
   * Job 配置基础表单组件 — A.1 + 1+2+3 复用底座。
   *
   * 使用场景:
   *   - 编辑 drawer:替换原 2 字段表单为完整 24 字段
   *   - (Day 8+)新建作业向导 Step「基础信息」也会复用本组件
   *
   * 设计:
   *   - 通过 `defineModel` 双向绑定整个 form state(Vue 3.4+ shorthand)
   *   - 5 组分块:基本/调度/资源/重试与超时/业务参数(审计字段编辑场景无意义)
   *   - 不内含 el-form 包裹(调用方负责 form ref + 校验提交)
   *   - 字段下拉数据(executionMode / scheduleType / queue)由调用方传入,
   *     避免组件依赖 store / API,便于在新建向导、Bundle 选择等场景复用
   */
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { Plus } from '@element-plus/icons-vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import type { MetaOption } from '@/api/meta'
  import type { JobEditFormState } from '@/views/job/jobEditFormTypes'
  import CalendarMiniCreateDrawer from './CalendarMiniCreateDrawer.vue'
  import WindowMiniCreateDrawer from './WindowMiniCreateDrawer.vue'
  import CronExprInput from './CronExprInput.vue'
  import JsonTextareaInput from '@/components/common/JsonTextareaInput.vue'

  // 不用 defineModel:父组件 const editForm = reactive(...) 是 reactive 对象,
  // v-model 反向赋值会触发 Vue「v-model cannot update const reactive binding」警告。
  // reactive 已是 mutable proxy,直接接 props 让子组件 mutate model 字段即可。
  const props = defineProps<{
    model: JobEditFormState
    /** 调用方当前 tenantId,用于「现场建子实体」(如新建 calendar 时知道挂到哪个租户) */
    tenantId?: string
    executionModeOptions?: MetaOption[]
    scheduleTypeOptions?: MetaOption[]
    queueOptions?: MetaOption[]
    /** 当前 tenant 已知的 worker group(从 job 列表去重 computed),可空时仅 allow-create */
    workerGroupOptions?: MetaOption[]
    readonlyIdentity?: boolean
    sections?: Array<'basic' | 'schedule' | 'resource' | 'retry' | 'params'>
  }>()
  const model = props.model
  const readonlyIdentity = computed(() => props.readonlyIdentity !== false)

  function showSection(section: 'basic' | 'schedule' | 'resource' | 'retry' | 'params') {
    return !props.sections || props.sections.includes(section)
  }

  // wizard 单步展示时调用方已经有自己的步骤标题,组内重复一遍很冗余;按 sections 长度自动收
  const singleSection = computed(() => (props.sections?.length ?? 0) === 1)

  // 「现场建子实体」mini drawer 状态。Day 3 calendar,Day 4 window。queue 不开放(运维角色管控)。
  const calendarMiniVisible = ref(false)
  const windowMiniVisible = ref(false)
  function onCalendarCreated(code: string) {
    model.calendarCode = code
  }
  function onWindowCreated(code: string) {
    model.windowCode = code
  }

  // Day 5 字段联动:scheduleType=MANUAL 时不需要 cron/日历/窗口;retryPolicy=NONE 时禁用重试次数
  const isManualSchedule = computed(() => model.scheduleType === 'MANUAL')
  const isNoRetry = computed(() => !model.retryPolicy || model.retryPolicy === 'NONE')

  // retryPolicy 切回 NONE 时自动归零 retryMaxCount(避免脏数据)
  watch(isNoRetry, (noRetry) => {
    if (noRetry) model.retryMaxCount = 0
  })

  // Cron 预设 / 校验 / 下次执行预览已迁移至 CronExprInput 子组件,本文件不再维护 CRON_PRESETS。

  const { t } = useI18n({ useScope: 'global' })

  // 常见 IANA 时区。allow-create 允许用户自定义其他时区字符串。
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
</script>

<style scoped>
  .job-config-basic-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .config-group {
    border: 1px solid var(--color-border-light);
    border-radius: 6px;
    padding: 12px 16px 4px;
    background: var(--color-bg-page);
  }

  .config-group__title {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-primary);
    margin-bottom: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--color-border-light);
  }

  /* 字段下方提示(联动禁用时) */
  .field-hint {
    margin-left: 12px;
    font-size: 12px;
    color: var(--color-text-tertiary);
  }

  /* 内联「+ 新建子实体」按钮容器 — 输入框 + 右侧 link 按钮一行布局 */
  .inline-create-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
  }
  .inline-create-input {
    flex: 1;
  }
  .inline-create-btn {
    flex-shrink: 0;
    white-space: nowrap;
  }
</style>
