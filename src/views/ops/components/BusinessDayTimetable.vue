<template>
  <section class="timetable" :aria-label="t('opsToday.timetableTitle')">
    <header class="timetable__head">
      <div class="timetable__title">
        <h2>{{ t('opsToday.timetableTitle') }}</h2>
        <span class="timetable__date">{{ t('opsToday.bizDate', { date: bizDate }) }}</span>
      </div>
      <p class="timetable__hint">{{ t('opsToday.timetableHint') }}</p>
      <ul class="timetable__legend">
        <li v-for="item in legend" :key="item.tone">
          <i :class="`tone-${item.tone}`" aria-hidden="true" />{{ item.label }}
          <span v-if="item.count" class="timetable__legend-count">{{ item.count }}</span>
        </li>
      </ul>
    </header>

    <div v-if="loadError" class="timetable__state">
      {{ t('opsToday.loadFailed') }}
      <el-button size="small" @click="refresh">{{ t('opsToday.retry') }}</el-button>
    </div>
    <div v-else-if="!loading && table.lanes.length === 0" class="timetable__state">
      {{ t('opsToday.empty') }}
    </div>
    <div v-else class="timetable__board" :class="{ 'is-loading': loading }">
      <div v-for="lane in table.lanes" :key="lane.key" class="timetable__lane">
        <span class="timetable__lane-label" :title="laneLabel(lane.key)">
          {{ laneLabel(lane.key) }}
        </span>
        <div class="timetable__track">
          <button
            v-for="segment in lane.segments"
            :key="segment.id"
            type="button"
            class="timetable__segment"
            :class="`tone-${segment.tone}`"
            :style="{ left: `${segment.left}%`, width: `${segment.width}%` }"
            :aria-label="segmentLabel(segment)"
            :title="segmentLabel(segment)"
            @click="openInstance(segment.id)"
          />
        </div>
      </div>
      <div class="timetable__overlay" aria-hidden="true">
        <div
          v-if="table.nowPercent != null"
          class="timetable__now"
          :style="{ left: `${table.nowPercent}%` }"
        >
          <b>{{ t('opsToday.now', { time: nowLabel }) }}</b>
        </div>
      </div>
      <div class="timetable__axis" aria-hidden="true">
        <span v-for="tick in table.ticks" :key="tick.label" :style="{ left: `${tick.percent}%` }">{{
          tick.label
        }}</span>
      </div>
    </div>

    <footer class="timetable__foot">
      <span v-if="truncatedTotal">
        {{ t('opsToday.truncated', { shown: instances.length, total: truncatedTotal }) }}
      </span>
      <span v-if="table.notStarted">{{
        t('opsToday.notStarted', { count: table.notStarted })
      }}</span>
      <router-link class="timetable__link" :to="instancesRoute">
        {{ t('opsToday.openInstances') }}
      </router-link>
    </footer>
  </section>
</template>

<script setup lang="ts">
  import { computed, onUnmounted, ref, shallowRef } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRouter } from 'vue-router'
  import { instanceApi } from '@/api/instance'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { businessDayStartMs, fmtClockTime, todayBusinessDate } from '@/utils/datetime'
  import { resolveStatusMeta } from '@/components/common/statusTagResolve'
  import type { ConsoleJobInstanceResponse } from '@/types/console-api'
  import { buildTimetable, type TimetableSegment, type TimetableTone } from '../timetable'

  /** 后端分页上限 500；超过时只画最早的一页并明示截断，不分页拉全量 */
  const PAGE_LIMIT = 500
  const NOW_TICK_MS = 60_000

  const { t, te } = useI18n()
  const router = useRouter()
  const tenant = useTenantStore()

  const bizDate = ref(todayBusinessDate())
  const instances = shallowRef<ConsoleJobInstanceResponse[]>([])
  const truncatedTotal = ref(0)
  const loading = ref(false)
  const loadError = ref(false)
  const nowMs = ref(Date.now())
  let requestSeq = 0

  const nowTimer = window.setInterval(() => {
    nowMs.value = Date.now()
  }, NOW_TICK_MS)
  onUnmounted(() => window.clearInterval(nowTimer))

  async function refresh() {
    const tenantId = tenant.tenantId
    if (!tenantId) return
    const seq = ++requestSeq
    bizDate.value = todayBusinessDate()
    loading.value = true
    loadError.value = false
    try {
      const page = await instanceApi.list({
        tenantId,
        bizDate: bizDate.value,
        page: 1,
        pageSize: PAGE_LIMIT,
      })
      // 切租户或重复刷新时丢弃旧响应
      if (seq !== requestSeq) return
      instances.value = page.records
      truncatedTotal.value = page.total > page.records.length ? page.total : 0
      nowMs.value = Date.now()
    } catch {
      if (seq === requestSeq) loadError.value = true
    } finally {
      if (seq === requestSeq) loading.value = false
    }
  }

  useTenantReload(refresh)
  defineExpose({ refresh, loading })

  const table = computed(() =>
    buildTimetable(instances.value, {
      dayStartMs: businessDayStartMs(bizDate.value),
      nowMs: nowMs.value,
    }),
  )

  const nowLabel = computed(() => fmtClockTime(nowMs.value, undefined, false))

  const legend = computed(() => {
    const counts = new Map<TimetableTone, number>()
    for (const lane of table.value.lanes) {
      for (const segment of lane.segments) {
        counts.set(segment.tone, (counts.get(segment.tone) ?? 0) + 1)
      }
    }
    const items: { tone: TimetableTone; key: string }[] = [
      { tone: 'success', key: 'legendSuccess' },
      { tone: 'danger', key: 'legendFailed' },
      { tone: 'running', key: 'legendRunning' },
      { tone: 'warning', key: 'legendWaiting' },
      { tone: 'idle', key: 'legendOther' },
    ]
    return items.map((item) => ({
      tone: item.tone,
      label: t(`opsToday.${item.key}`),
      count: counts.get(item.tone) ?? 0,
    }))
  })

  // 作业运行列表尚不支持按业务日深链，这里只进入列表默认视图
  const instancesRoute = '/monitor/job-instances'

  function laneLabel(key: string) {
    return key || t('opsToday.laneUngrouped')
  }

  function statusLabel(status: string) {
    return resolveStatusMeta(status, 'instance', null, '', {
      exists: (key) => te(key),
      translate: (key) => t(key),
    }).label
  }

  function segmentLabel(segment: TimetableSegment) {
    return t('opsToday.segmentLabel', {
      job: segment.jobCode,
      status: statusLabel(segment.status),
      start: fmtClockTime(segment.startedAt),
      end: segment.finishedAt ? fmtClockTime(segment.finishedAt) : t('opsToday.segmentRunning'),
    })
  }

  function openInstance(id: number) {
    void router.push(`/monitor/job-instances/${id}`)
  }
</script>

<style scoped>
  .timetable {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 18px 20px 14px;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-content);
  }

  .timetable__head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px 16px;
  }

  .timetable__title {
    display: flex;
    align-items: baseline;
    gap: 10px;
  }

  .timetable__title h2 {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
  }

  .timetable__date {
    color: var(--color-primary);
    font-weight: 500;
  }

  .timetable__hint {
    flex: 1 1 260px;
    margin: 0;
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }

  .timetable__legend {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    margin: 0;
    padding: 0;
    list-style: none;
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }

  .timetable__legend li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .timetable__legend i {
    width: 10px;
    height: 10px;
    border-radius: 2px;
  }

  .timetable__legend-count {
    color: var(--color-text-primary);
    font-weight: 600;
  }

  .timetable__board {
    position: relative;
    display: flex;
    flex-direction: column;
    padding-bottom: 22px;
    transition: opacity 0.15s ease;
  }

  .timetable__board.is-loading {
    opacity: 0.6;
  }

  .timetable__lane {
    display: grid;
    grid-template-columns: 96px 1fr;
    align-items: center;
    min-height: 26px;
    border-bottom: 1px dashed var(--color-border-light);
  }

  .timetable__lane-label {
    overflow: hidden;
    padding-right: 10px;
    color: var(--color-text-secondary);
    font-size: var(--font-size-xs);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .timetable__track {
    position: relative;
    height: 26px;
  }

  .timetable__segment {
    position: absolute;
    top: 7px;
    height: 12px;
    min-width: 3px;
    padding: 0;
    border: 0;
    border-radius: 3px;
    cursor: pointer;
  }

  .timetable__segment:hover {
    filter: brightness(1.12);
  }

  .timetable__segment:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  .tone-success {
    background: var(--color-success);
  }

  .tone-danger {
    background: var(--color-danger);
  }

  .tone-running {
    background: var(--color-primary);
  }

  .tone-warning {
    background: var(--color-warning);
  }

  .tone-idle {
    background: var(--color-text-tertiary);
    opacity: 0.6;
  }

  /* 覆盖层与轨道同宽：从标签列之后开始 */
  .timetable__overlay,
  .timetable__axis {
    position: absolute;
    left: 96px;
    right: 0;
  }

  .timetable__overlay {
    top: 0;
    bottom: 22px;
    pointer-events: none;
  }

  .timetable__now {
    position: absolute;
    top: -4px;
    bottom: 0;
    border-left: 2px solid var(--color-text-primary);
  }

  .timetable__now b {
    position: absolute;
    top: -16px;
    left: 4px;
    font-size: var(--font-size-xs);
    font-weight: 600;
    white-space: nowrap;
  }

  .timetable__axis {
    bottom: 0;
    height: 18px;
    border-top: 1px solid var(--color-border);
    color: var(--color-text-tertiary);
    font-size: var(--font-size-xs);
  }

  .timetable__axis span {
    position: absolute;
    top: 3px;
    transform: translateX(-50%);
  }

  .timetable__axis span:first-child {
    transform: none;
  }

  .timetable__axis span:last-child {
    transform: translateX(-100%);
  }

  .timetable__state {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 18px 0;
    color: var(--color-text-secondary);
  }

  .timetable__foot {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }

  .timetable__link {
    margin-left: auto;
    color: var(--color-primary);
    font-weight: 600;
    text-decoration: none;
  }

  @media (max-width: 768px) {
    .timetable__lane {
      grid-template-columns: 64px 1fr;
    }

    .timetable__overlay,
    .timetable__axis {
      left: 64px;
    }
  }
</style>
