<template>
  <div class="tool-panel">
    <div class="tool-panel__intro">
      <h3>{{ t('operationsToolkit.retry.title') }}</h3>
      <p>{{ t('operationsToolkit.retry.description') }}</p>
    </div>
    <el-form label-position="top" class="tool-form tool-form--grid tool-form--compact">
      <el-form-item class="tool-form__wide" :label="t('operationsToolkit.retry.startAt')">
        <el-date-picker v-model="form.startAt" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" />
      </el-form-item>
      <el-form-item :label="t('operationsToolkit.retry.policy')">
        <el-select v-model="form.policy">
          <el-option label="NONE" value="NONE" />
          <el-option label="FIXED" value="FIXED" />
          <el-option label="EXPONENTIAL" value="EXPONENTIAL" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('operationsToolkit.retry.maxRetries')">
        <el-input-number v-model="form.maxRetries" :min="0" :max="20" />
      </el-form-item>
      <el-form-item :label="t('operationsToolkit.retry.baseDelay')">
        <el-input-number v-model="form.fixedDelaySeconds" :min="0" :max="86400" />
      </el-form-item>
      <el-form-item :label="t('operationsToolkit.retry.multiplier')">
        <el-input-number v-model="form.multiplier" :min="1" :max="10" :step="0.5" />
      </el-form-item>
      <el-form-item :label="t('operationsToolkit.retry.maxDelay')">
        <el-input-number v-model="form.maxDelaySeconds" :min="0" :max="604800" />
      </el-form-item>
      <el-form-item :label="t('operationsToolkit.retry.jitter')">
        <el-input-number v-model="jitterPercent" :min="0" :max="100" />
      </el-form-item>
    </el-form>
    <el-table
      :data="timeline"
      class="console-table"
      border
      :empty-text="t('operationsToolkit.retry.empty')"
    >
      <el-table-column prop="attempt" :label="t('operationsToolkit.retry.colAttempt')" width="90" />
      <el-table-column
        prop="delaySeconds"
        :label="t('operationsToolkit.retry.colDelay')"
        width="110"
      />
      <el-table-column :label="t('operationsToolkit.retry.colWindow')" min-width="330">
        <template #default="{ row }">
          <div class="retry-window">
            <DatetimeText :value="row.earliestAt" />
            <span>–</span>
            <DatetimeText :value="row.latestAt" />
          </div>
        </template>
      </el-table-column>
      <el-table-column :label="t('operationsToolkit.retry.colNominal')" min-width="180">
        <template #default="{ row }"><DatetimeText :value="row.nominalAt" /></template>
      </el-table-column>
    </el-table>
    <el-alert
      type="info"
      :closable="false"
      :title="t('operationsToolkit.retry.authorityNote')"
      show-icon
    />
  </div>
</template>

<script setup lang="ts">
  import { computed, reactive, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import dayjs from 'dayjs'
  import DatetimeText from '@/components/common/DatetimeText.vue'
  import { buildRetryTimeline } from '@/utils/operationsToolkit'

  const { t } = useI18n({ useScope: 'global' })
  const form = reactive({
    startAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    policy: 'EXPONENTIAL' as 'NONE' | 'FIXED' | 'EXPONENTIAL',
    maxRetries: 5,
    fixedDelaySeconds: 60,
    multiplier: 2,
    maxDelaySeconds: 3600,
  })
  const jitterPercent = ref(10)
  const timeline = computed(() =>
    buildRetryTimeline({ ...form, jitterRatio: jitterPercent.value / 100 }),
  )
</script>

<style scoped src="./operations-toolkit.css"></style>
