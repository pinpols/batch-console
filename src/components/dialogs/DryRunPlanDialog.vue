<template>
  <el-dialog
    v-model="visible"
    :title="t('dryRunDialog.title', { code: jobCode })"
    width="640px"
    :close-on-click-modal="false"
    @closed="onClosed"
  >
    <el-form label-width="100px" label-position="left">
      <el-form-item :label="t('dryRunDialog.levelLabel')">
        <el-radio-group v-model="level">
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

    <!-- 结果展示:findings + probes -->
    <div v-if="result" class="dry-run-result">
      <el-divider>{{ t('dryRunDialog.resultDivider') }}</el-divider>
      <el-alert
        :title="
          result.success
            ? t('dryRunDialog.passed')
            : t('dryRunDialog.foundIssues', { n: errorCount })
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
        <el-table-column prop="code" label="Code" width="200" />
        <el-table-column
          prop="message"
          :label="t('dryRunDialog.colMessage')"
          show-overflow-tooltip
        />
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
  import { ref, computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
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

  watch(visible, (v) => {
    if (v) {
      // 每次打开重置表单(保留上次 level 选择以减少重复点击)
      paramsText.value = (props.defaultParams || '').trim()
      bizDate.value = new Date().toISOString().slice(0, 10)
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

  const allFindings = computed<DryRunFinding[]>(() => [
    ...(result.value?.findings ?? []),
    ...(result.value?.probes ?? []),
  ])
  const hasError = computed(() => allFindings.value.some((f) => f.severity === 'ERROR'))
  const hasWarn = computed(() => allFindings.value.some((f) => f.severity === 'WARN'))
  const errorCount = computed(() => allFindings.value.filter((f) => f.severity === 'ERROR').length)

  function tagType(lvl: string): 'success' | 'warning' | 'danger' {
    if (lvl === 'ERROR') return 'danger'
    if (lvl === 'WARN') return 'warning'
    return 'success'
  }

  function onClosed() {
    result.value = null
  }

  async function runDryRun() {
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
      result.value = await dryRunApi.plan({
        tenantId: props.tenantId,
        jobCode: props.jobCode,
        level: level.value,
        bizDate: level.value === 'CONFIG_VALIDATE' ? undefined : bizDate.value || undefined,
        params,
      })
      const errs = (result.value.findings ?? []).filter((f) => f.severity === 'ERROR').length
      if (errs > 0) {
        ElMessage.warning(t('dryRunDialog.foundIssues', { n: errs }))
      } else {
        ElMessage.success(t('dryRunDialog.passed'))
      }
    } catch (err) {
      // dryRunApi 内层 unwrap throws(BE 业务 4xx);axios 全局 toast 仅覆盖外层 envelope。
      ElMessage.error(err instanceof Error ? err.message : String(err))
    } finally {
      running.value = false
    }
  }
</script>

<style scoped>
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
</style>
