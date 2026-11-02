<template>
  <el-dialog
    v-model="visible"
    :title="t('dryRunDialog.title', { code: jobCode })"
    width="min(640px, calc(100vw - 32px))"
    :close-on-click-modal="false"
    @closed="onClosed"
  >
    <el-form label-position="top">
      <el-form-item :label="t('dryRunDialog.levelLabel')">
        <el-radio-group v-model="level" class="dry-run-levels">
          <el-radio-button value="CONFIG_VALIDATE">
            L1 · {{ t('dryRunDialog.l1') }}
          </el-radio-button>
          <el-radio-button value="SCHEDULE_PLAN">L2 · {{ t('dryRunDialog.l2') }}</el-radio-button>
          <el-radio-button value="EXECUTION_PLAN">L3 · {{ t('dryRunDialog.l3') }}</el-radio-button>
        </el-radio-group>
        <div class="level-hint">{{ levelHint }}</div>
      </el-form-item>

      <el-form-item v-if="level !== 'CONFIG_VALIDATE'" :label="t('dryRunDialog.bizDateLabel')">
        <el-date-picker
          v-model="bizDate"
          type="date"
          value-format="YYYY-MM-DD"
          :placeholder="t('dryRunDialog.bizDatePlaceholder')"
          class="query-w-full"
        />
      </el-form-item>

      <el-form-item :label="t('dryRunDialog.paramsLabel')">
        <el-input
          v-model="paramsText"
          type="textarea"
          :rows="5"
          :placeholder="t('dryRunDialog.paramsPlaceholder')"
        />
        <div v-if="paramsError" class="params-error">{{ paramsError }}</div>
      </el-form-item>
    </el-form>

    <!-- 结果展示:findings(L3 探针结果由 BE 以 EXEC_* code 并入 findings,无顶层 probes) -->
    <div v-if="result" class="dry-run-result">
      <el-divider>{{ t('dryRunDialog.resultDivider') }}</el-divider>
      <el-alert
        :title="
          !result.success
            ? t('dryRunDialog.foundIssues', { n: errorCount })
            : hasWarn
              ? t('dryRunDialog.completedWithWarnings', { n: warningCount })
              : t('dryRunDialog.passed')
        "
        :type="hasError ? 'error' : hasWarn ? 'warning' : 'success'"
        show-icon
        :closable="false"
      />
      <el-table
        v-if="allFindings.length"
        :data="allFindings"
        size="small"
        class="findings-table"
        :empty-text="t('dryRunDialog.noFindings')"
      >
        <el-table-column :label="t('dryRunDialog.colLevel')" width="80">
          <template #default="{ row }">
            <el-tag :type="tagType(row.severity)" size="small">{{ row.severity }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="scope" :label="t('dryRunDialog.colCategory')" width="100" />
        <el-table-column prop="code" :label="t('dryRunDialog.colCode')" width="200">
          <template #default="{ row }">
            <CopyableText v-if="row.code" :text="String(row.code)" />
            <span v-else>{{ row.code }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="message" :label="t('dryRunDialog.colMessage')">
          <template #default="{ row }">
            <span class="wrap-cell">{{
              row.code === 'EXEC_SQL_PLAN_UNAVAILABLE'
                ? t('dryRunDialog.sqlPlanUnavailable')
                : row.message
            }}</span>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <template #footer>
      <el-button @click="visible = false">{{ t('common.close') }}</el-button>
      <el-button type="primary" :loading="running" @click="runDryRun">
        {{ t('dryRunDialog.submit') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
  import CopyableText from '@/components/common/CopyableText.vue'
  import { ref, computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useTenantRequestScope } from '@/composables/useTenantRequestScope'
  import { ElMessage } from 'element-plus'
  import { todayBusinessDate } from '@/utils/datetime'
  import { userErrorMessage } from '@/utils/userErrorMessage'
  import {
    dryRunApi,
    type DryRunLevel,
    type DryRunPlanResult,
    type DryRunFinding,
  } from '@/api/dryRun'

  const props = defineProps<{
    modelValue: boolean
    tenantId: string
    jobCode: string
    /** 预填的 default params JSON */
    defaultParams?: string
  }>()
  const emit = defineEmits<{ 'update:modelValue': [v: boolean] }>()
  const { t } = useI18n({ useScope: 'global' })

  const visible = computed({
    get: () => props.modelValue,
    set: (v) => emit('update:modelValue', v),
  })

  const level = ref<DryRunLevel>('CONFIG_VALIDATE')
  const bizDate = ref<string>('')
  const paramsText = ref<string>('')
  const paramsError = ref<string>('')
  const result = ref<DryRunPlanResult | null>(null)
  const running = ref(false)
  const requestScope = useTenantRequestScope()

  watch(visible, (v) => {
    if (v) {
      // 每次打开重置表单(保留上次 level 选择以减少重复点击)
      paramsText.value = (props.defaultParams || '').trim()
      bizDate.value = todayBusinessDate()
      result.value = null
      paramsError.value = ''
    }
  })

  const levelHint = computed(() =>
    level.value === 'CONFIG_VALIDATE'
      ? t('dryRunDialog.l1Hint')
      : level.value === 'SCHEDULE_PLAN'
        ? t('dryRunDialog.l2Hint')
        : t('dryRunDialog.l3Hint'),
  )

  const allFindings = computed<DryRunFinding[]>(() => result.value?.findings ?? [])
  const hasError = computed(() => allFindings.value.some((f) => f.severity === 'ERROR'))
  const hasWarn = computed(() => allFindings.value.some((f) => f.severity === 'WARN'))
  const errorCount = computed(() => allFindings.value.filter((f) => f.severity === 'ERROR').length)
  const warningCount = computed(() => allFindings.value.filter((f) => f.severity === 'WARN').length)

  function tagType(lvl: string): 'success' | 'warning' | 'danger' {
    if (lvl === 'ERROR') return 'danger'
    if (lvl === 'WARN') return 'warning'
    return 'success'
  }

  function onClosed() {
    result.value = null
  }

  async function runDryRun() {
    const scope = requestScope.begin()
    const targetTenant = props.tenantId
    const targetJob = props.jobCode
    paramsError.value = ''
    let params: Record<string, unknown> | undefined
    const raw = paramsText.value.trim()
    if (raw) {
      try {
        params = JSON.parse(raw) as Record<string, unknown>
      } catch {
        paramsError.value = t('dryRunDialog.paramsInvalid')
        return
      }
    }
    running.value = true
    try {
      const response = await dryRunApi.plan({
        tenantId: targetTenant,
        jobCode: targetJob,
        level: level.value,
        bizDate: level.value === 'CONFIG_VALIDATE' ? undefined : bizDate.value || undefined,
        params,
      })
      if (
        !requestScope.isCurrent(scope) ||
        !visible.value ||
        props.tenantId !== targetTenant ||
        props.jobCode !== targetJob
      )
        return
      result.value = response
      const errs = (result.value.findings ?? []).filter((f) => f.severity === 'ERROR').length
      if (errs > 0) {
        ElMessage.warning(t('dryRunDialog.foundIssues', { n: errs }))
      } else if (warningCount.value > 0) {
        ElMessage.warning(t('dryRunDialog.completedWithWarnings', { n: warningCount.value }))
      } else {
        ElMessage.success(t('dryRunDialog.passed'))
      }
    } catch (err) {
      if (!requestScope.isCurrent(scope) || !visible.value) return
      // dryRunApi 内层 unwrap throws(BE 业务 4xx);axios 全局 toast 仅覆盖外层 envelope。
      ElMessage.error(userErrorMessage(err))
    } finally {
      running.value = false
    }
  }
</script>

<style scoped>
  .wrap-cell {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .level-hint {
    margin-top: 6px;
    color: var(--color-text-secondary);
    font-size: 12px;
    line-height: 1.5;
  }
  .params-error {
    color: var(--color-danger);
    font-size: 12px;
    margin-top: 4px;
  }
  .dry-run-result {
    margin-top: 8px;
  }
  .findings-table {
    margin-top: 12px;
  }
  @media (max-width: 600px) {
    .dry-run-levels {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--space-sm);
      width: 100%;
    }
    .dry-run-levels :deep(.el-radio-button__inner) {
      width: 100%;
      border-left: var(--el-border);
      border-radius: var(--el-border-radius-base);
      box-shadow: none;
    }
  }
</style>
