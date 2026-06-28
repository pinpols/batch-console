<template>
  <div class="job-config-basic">
    <el-descriptions
      :title="t('jobConfigBasic.groupBasic')"
      :column="2"
      border
      size="small"
      class="config-group"
    >
      <el-descriptions-item :label="t('jobConfigBasic.fieldJobCode')">{{
        job.jobCode || '—'
      }}</el-descriptions-item>
      <el-descriptions-item :label="t('jobConfigBasic.fieldJobName')">{{
        job.jobName || '—'
      }}</el-descriptions-item>
      <el-descriptions-item :label="t('jobConfigBasic.fieldJobType')">{{
        job.jobType || '—'
      }}</el-descriptions-item>
      <el-descriptions-item :label="t('jobConfigBasic.fieldEnabled')">
        <el-tag :type="job.enabled ? 'success' : 'info'" size="small">
          {{ job.enabled ? t('common.yes') : t('common.no') }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item :label="t('jobConfigBasic.fieldExecutionMode')">
        {{ executionModeLabel || '—' }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('jobConfigBasic.fieldWatermark')">
        {{ job.watermarkField || '—' }}
      </el-descriptions-item>
    </el-descriptions>

    <el-descriptions
      :title="t('jobConfigBasic.groupSchedule')"
      :column="2"
      border
      size="small"
      class="config-group"
    >
      <el-descriptions-item :label="t('jobConfigBasic.fieldScheduleType')">{{
        job.scheduleType || '—'
      }}</el-descriptions-item>
      <el-descriptions-item :label="t('jobConfigBasic.fieldScheduleExpr')">{{
        job.scheduleExpr || '—'
      }}</el-descriptions-item>
      <el-descriptions-item :label="t('jobConfigBasic.fieldCalendarCode')">{{
        job.calendarCode || '—'
      }}</el-descriptions-item>
      <el-descriptions-item :label="t('jobConfigBasic.fieldWindowCode')">{{
        job.windowCode || '—'
      }}</el-descriptions-item>
    </el-descriptions>

    <el-descriptions
      :title="t('jobConfigBasic.groupResource')"
      :column="2"
      border
      size="small"
      class="config-group"
    >
      <el-descriptions-item :label="t('jobConfigBasic.fieldQueueCode')">{{
        job.queueCode || '—'
      }}</el-descriptions-item>
      <el-descriptions-item :label="t('jobConfigBasic.fieldWorkerGroup')">{{
        job.workerGroup || '—'
      }}</el-descriptions-item>
      <el-descriptions-item :label="t('jobConfigBasic.fieldShardStrategy')">{{
        job.shardStrategy || '—'
      }}</el-descriptions-item>
      <el-descriptions-item :label="t('jobConfigBasic.fieldTimeoutSeconds')">
        {{ job.timeoutSeconds ?? '—' }}
      </el-descriptions-item>
    </el-descriptions>

    <el-descriptions
      :title="t('jobConfigBasic.groupRetry')"
      :column="2"
      border
      size="small"
      class="config-group"
    >
      <el-descriptions-item :label="t('jobConfigBasic.fieldRetryPolicy')">{{
        job.retryPolicy || '—'
      }}</el-descriptions-item>
      <el-descriptions-item :label="t('jobConfigBasic.fieldRetryMaxCount')">
        {{ job.retryMaxCount ?? '—' }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('jobConfigBasic.fieldExecutionHandler')" :span="2">
        <span class="config-mono">{{ job.executionHandler || '—' }}</span>
      </el-descriptions-item>
    </el-descriptions>

    <el-descriptions
      v-if="job.paramSchema || job.defaultParams"
      :title="t('jobConfigBasic.groupParams')"
      :column="1"
      border
      size="small"
      class="config-group"
    >
      <el-descriptions-item v-if="job.paramSchema" :label="t('jobConfigBasic.fieldParamSchema')">
        <pre class="config-json">{{ formatJson(job.paramSchema) }}</pre>
      </el-descriptions-item>
      <el-descriptions-item
        v-if="job.defaultParams"
        :label="t('jobConfigBasic.fieldDefaultParams')"
      >
        <pre class="config-json">{{ formatJson(job.defaultParams) }}</pre>
      </el-descriptions-item>
    </el-descriptions>

    <el-descriptions
      :title="t('jobConfigBasic.groupAudit')"
      :column="2"
      border
      size="small"
      class="config-group"
    >
      <el-descriptions-item :label="t('jobConfigBasic.fieldCreatedAt')">{{
        job.createdAt || '—'
      }}</el-descriptions-item>
      <el-descriptions-item :label="t('jobConfigBasic.fieldUpdatedAt')">{{
        job.updatedAt || '—'
      }}</el-descriptions-item>
    </el-descriptions>
  </div>
</template>

<script setup lang="ts">
  /**
   * Job 基本信息 section — 1+2+3 方案的可复用片段。
   *
   * 用法:
   *   - 列表详情 drawer 的 "基本" Tab(只读浏览 + 后续 Day 2 加内联编辑)
   *   - 新建作业向导 Step 8 「复核」(全字段一览)
   *   - Bundle 导入预览页
   *
   * 字段分组依据:跟 BE update DTO 24 字段口径对齐,按用户心智分 6 组:
   *   基本 / 调度 / 资源 / 重试与超时 / 业务参数 / 审计。
   *
   * 当前(Day 1)只读。Day 2 加 `:editable="true"` 内联编辑能力。
   */
  import { useI18n } from 'vue-i18n'
  import type { ConsoleJobDefinitionResponse } from '@/types/console-api'

  const props = defineProps<{
    job: ConsoleJobDefinitionResponse
    /** 已解析的 executionMode 显示文案;父组件用 meta enum 算好传入,组件本身不依赖 enum 服务 */
    executionModeLabel?: string
  }>()

  const { t } = useI18n({ useScope: 'global' })
  // 兜底:父组件没传 label 时,直接显原值
  void props

  function formatJson(raw: string | undefined | null): string {
    if (!raw) return '—'
    try {
      return JSON.stringify(JSON.parse(raw), null, 2)
    } catch {
      return raw
    }
  }
</script>

<style scoped>
  .job-config-basic {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .config-group :deep(.el-descriptions__title) {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-primary);
    margin-bottom: 8px;
  }

  .config-mono,
  .config-json {
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  .config-json {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
    background: var(--color-bg-page);
    padding: 8px 10px;
    border-radius: 4px;
    max-height: 200px;
    overflow: auto;
  }
</style>
