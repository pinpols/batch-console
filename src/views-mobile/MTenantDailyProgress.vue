<template>
  <section v-if="tenant.tenantId" class="m-daily" :aria-label="t('dailyProgress.title')">
    <div class="m-daily__heading">
      <h2>{{ t('dailyProgress.title') }}</h2>
      <LiveStatusBadge :status="status" :last-refreshed-at="lastRefreshedAt" />
    </div>
    <p class="m-daily__date">{{ t('dailyProgress.date') }}：{{ bizDate }}</p>
    <p v-if="error" class="m-daily__warning" role="status">{{ t('dailyProgress.unavailable') }}</p>
    <template v-if="progress">
      <p v-if="progress.coverage.uncoveredDefinitions" class="m-daily__warning">
        {{
          t('dailyProgress.incomplete', {
            missing: progress.coverage.uncoveredDefinitions,
            total: progress.coverage.scheduledDefinitions,
          })
        }}
      </p>
      <p v-else class="m-daily__hint">
        {{
          t(
            progress.coverage.scheduledDefinitions
              ? 'dailyProgress.complete'
              : 'dailyProgress.noSchedules',
          )
        }}
      </p>
      <div v-for="row in rows" :key="row.scope" class="m-daily__scope" :data-scope="row.scope">
        <div class="m-daily__scope-heading">
          <strong>{{ t(`dailyProgress.${row.scope}`) }}</strong>
          <span
            >{{ t('dailyProgress.percentage') }}：{{
              row.percentage == null ? t('dailyProgress.unknown') : `${row.percentage}%`
            }}</span
          >
        </div>
        <el-progress
          v-if="row.percentage != null"
          :percentage="row.percentage"
          :show-text="false"
          :aria-label="`${t(`dailyProgress.${row.scope}`)} ${t('dailyProgress.percentage')}`"
        />
        <p>
          {{ t('dailyProgress.ended') }} {{ row.ended }} / {{ row.total }} ·
          {{ t('dailyProgress.succeeded') }} {{ row.succeeded }} · {{ t('dailyProgress.failed') }}
          {{ row.failed }} · {{ t('dailyProgress.active') }} {{ row.active }}
        </p>
      </div>
      <p class="m-daily__hint">{{ t('dailyProgress.scopeHint') }}</p>
    </template>
    <p v-else-if="loading">{{ t('common.loading') }}</p>
    <p v-else-if="!error">{{ t('dailyProgress.noWork') }}</p>
  </section>
</template>

<script setup lang="ts">
  import { computed, onMounted, onUnmounted, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useTenantStore } from '@/stores/tenant'
  import { useDailyProgress } from '@/composables/useDailyProgress'
  import { dailyProgressRows } from '@/utils/dailyProgress'
  import { todayBusinessDate } from '@/utils/datetime'
  import LiveStatusBadge from '@/components/common/LiveStatusBadge.vue'

  const { t } = useI18n()
  const tenant = useTenantStore()
  const bizDate = ref(todayBusinessDate())
  const { progress, status, loading, error, lastRefreshedAt, refresh } = useDailyProgress(
    () => tenant.tenantId,
    bizDate,
  )
  const rows = computed(() => (progress.value ? dailyProgressRows(progress.value) : []))
  let rollover: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    rollover = setInterval(() => {
      bizDate.value = todayBusinessDate()
    }, 60_000)
  })
  onUnmounted(() => clearInterval(rollover))
  defineExpose({ refresh })
</script>

<style scoped>
  .m-daily {
    padding: 16px;
    margin-bottom: 12px;
    border: 1px solid var(--color-border-light);
    border-radius: 12px;
    background: var(--color-bg-card);
  }
  .m-daily__heading,
  .m-daily__scope-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }
  .m-daily__heading h2 {
    margin: 0;
    font-size: 16px;
  }
  .m-daily__scope {
    padding-block: 10px;
    border-bottom: 1px solid var(--color-border-light);
  }
  .m-daily p {
    margin: 6px 0 0;
  }
  .m-daily__date,
  .m-daily__hint,
  .m-daily__scope p {
    color: var(--color-text-secondary);
    font-size: 12px;
    line-height: 1.5;
  }
  .m-daily__warning {
    color: var(--color-warning);
    font-size: 13px;
  }
</style>
