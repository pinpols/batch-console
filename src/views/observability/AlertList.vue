<template>
  <PageContainer>
    <!-- 照设计 #alerts:三分组 tab + 告警卡片流(proto dump: docs/redesign/proto-alerts.html) -->
    <!-- i18n-todo: 设计稿页头文案,建议 key alertList.pageTitle=告警中心 / alertList.pageDescription=按严重程度处理运行告警,确认后自动归档 -->
    <PageHeader title="告警中心" description="按严重程度处理运行告警,确认后自动归档">
      <template #actions>
        <DateRangePresetPicker
          v-model="timeRange"
          type="daterange"
          @update:model-value="onTimeChange"
        />
        <el-button @click="$router.push('/observability/alert-routings')">
          {{ t('alertList.actionRules') }}
        </el-button>
        <el-button :loading="loading" @click="() => runRefresh(load)">
          {{ t('common.refresh') }}
        </el-button>
      </template>
    </PageHeader>

    <div class="al-tabs">
      <button
        v-for="tab in groupTabs"
        :key="tab.key"
        type="button"
        class="al-tab"
        :class="{ 'is-active': tab.active }"
        :style="tab.active && tab.dot ? { '--al-tab-tint': tab.dot } : undefined"
        @click="pickGroup(tab.key)"
      >
        <span v-if="tab.dot" class="al-tab__dot" :style="{ background: tab.dot }" />
        <span>{{ tab.label }}</span>
        <span v-if="tab.count !== null" class="al-tab__count">{{ tab.count }}</span>
      </button>
      <span class="al-tabs__spacer" />
      <MetaSelect
        class="al-sel"
        v-model="filters.severity"
        :options="severityOptions"
        clearable
        enum-key="severity"
        :placeholder="t('alertList.severityPlaceholder')"
        @change="search"
      />
      <MetaSelect
        class="al-sel"
        v-model="filters.alertType"
        :options="alertTypeOptions.map((v) => ({ value: v, label: v }))"
        clearable
        filterable
        :placeholder="t('alertList.typePlaceholder')"
        @change="search"
      />
      <TraceIdInput
        class="al-trace"
        v-model="filters.traceId"
        :placeholder="t('alertList.tracePlaceholder')"
        @keyup.enter="search"
      />
      <el-button text @click="reset">{{ t('common.reset') }}</el-button>
      <SavedFiltersMenu
        :sets="savedFilters.sets.value"
        :on-save="savedFilters.save"
        :on-apply="savedFilters.applySet"
        :on-remove="savedFilters.remove"
        :on-rename="savedFilters.rename"
        :on-export="savedFilters.exportSets"
        :on-import="savedFilters.importSets"
      />
    </div>

    <div class="al-live">
      <span class="al-live__dot" :class="{ 'is-off': live.status.value !== 'live' }" />
      <span class="al-live__title">{{ t('jobInstanceList.liveTitle') }}</span>
      <span class="al-live__sub">{{ t('jobInstanceList.liveEvery') }}</span>
    </div>

    <div v-loading="tableBlocking" class="al-list">
      <article
        v-for="row in rows"
        :key="row.id"
        class="al-card"
        :style="{ borderLeftColor: sevMeta(row.severity).color }"
      >
        <span
          class="al-card__icon"
          :style="{ background: sevMeta(row.severity).soft, color: sevMeta(row.severity).color }"
        >
          <el-icon><TriangleAlert /></el-icon>
        </span>
        <div class="al-card__main">
          <div class="al-card__meta">
            <span
              class="al-card__sev"
              :style="{
                background: sevMeta(row.severity).soft,
                color: sevMeta(row.severity).color,
              }"
            >
              {{ sevLabel(row.severity) }}
            </span>
            <span class="al-card__time">{{ fmtAlertTime(row.lastSeenAt) }}</span>
            <span v-if="(row.occurrenceCount ?? 0) > 1" class="al-card__time"
              >x{{ row.occurrenceCount }}</span
            >
          </div>
          <div class="al-card__title">{{ row.title }}</div>
          <div class="al-card__chips">
            <span class="al-card__chip">{{ row.serviceName }} · {{ row.alertType }}</span>
            <router-link
              v-if="row.traceId"
              class="al-card__chip al-card__chip--link"
              :to="`/observability/trace?traceId=${row.traceId}`"
            >
              {{ row.traceId.slice(0, 16) }}…
            </router-link>
          </div>
        </div>
        <div class="al-card__ops">
          <template v-if="row.status === 'OPEN'">
            <button
              type="button"
              class="al-op al-op--ack"
              :disabled="!canMutateConfig || actingId === row.id"
              @click="doAck(row)"
            >
              {{ t('alertList.actionAck') }}
            </button>
            <button
              type="button"
              class="al-op"
              :disabled="!canMutateConfig || actingId === row.id"
              @click="doSilence(row)"
            >
              {{ t('alertList.actionSilence24') }}
            </button>
            <button
              type="button"
              class="al-op al-op--danger"
              :disabled="!canMutateConfig || actingId === row.id"
              @click="doClose(row)"
            >
              {{ t('alertList.actionClose') }}
            </button>
          </template>
          <template v-else-if="row.status === 'ACKED'">
            <span class="al-acked">&#10003; {{ t('alertList.ackedBadge') }}</span>
            <button
              type="button"
              class="al-op al-op--danger"
              :disabled="!canMutateConfig || actingId === row.id"
              @click="doClose(row)"
            >
              {{ t('alertList.actionClose') }}
            </button>
          </template>
          <StatusTag v-else :value="String(row.status ?? '')" category="alertStatus" />
        </div>
      </article>

      <div v-if="!tableBlocking && rows.length === 0" class="al-empty">
        {{ hasAlertFilters ? alertFilteredEmptyText : t('alertList.emptyGroup') }}
      </div>
    </div>

    <TablePagerBar
      :page="page"
      :page-size="pageSize"
      :total="total"
      @update:page="
        (p) => {
          page = p
          void load()
        }
      "
      @update:page-size="
        (s) => {
          pageSize = s
          page = 1
          void load()
        }
      "
    />
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { confirmDanger } from '@/composables/useDangerConfirm'

  const { t } = useI18n({ useScope: 'global' })
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useSseAutoReload } from '@/composables/useSseAutoReload'
  import { queryAlertsPage } from '@/api/alertsQuery'
  import { acknowledgeAlert, closeAlert, silenceAlert } from '@/api/alertsCommands'
  import { useAuthStore } from '@/stores/auth'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { usePermission } from '@/composables/usePermission'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SavedFiltersMenu from '@/components/table/SavedFiltersMenu.vue'
  import { useSavedFilters } from '@/composables/useSavedFilters'
  import StatusTag from '@/components/common/StatusTag.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import TraceIdInput from '@/components/common/TraceIdInput.vue'
  import DateRangePresetPicker from '@/components/common/DateRangePresetPicker.vue'
  import TablePagerBar from '@/components/table/TablePagerBar.vue'
  import { TriangleAlert } from 'lucide-vue-next'
  import { fmtCompact, fmtDatetime } from '@/utils/datetime'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import type { ConsoleAlertEventResponse } from '@/types/console-api'

  const route = useRoute()
  const router = useRouter()
  const tenant = useTenantStore()
  const auth = useAuthStore()
  // VIEWER 角色看不到/点不动破坏性按钮:ack/silence/close 都属于"会改告警状态"的 mutation,
  // 旧版只是 v-if 隐藏顶部 Create 类按钮,行内 ack/silence/close 没 gate,VIEWER 点了才弹 403,
  // bad surprise。这里复用 canMutateConfig 灰显 + tooltip。
  const { canMutateConfig } = usePermission()
  const loading = ref(false)
  const {
    filterBusy: queryActionBusy,
    tableBlocking,
    runSearch,
    runReset,
    runRefresh,
  } = useListFilterFeedback(loading)
  // 所有已加载页的 union,用来派生 alertType select 候选;限制最大 5 页避免膨胀
  // (alertType 后端无枚举字典,只能从已加载数据归纳候选)
  const allRows = ref<ConsoleAlertEventResponse[]>([])
  const rows = ref<ConsoleAlertEventResponse[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(15)
  const actingId = ref<number | null>(null)
  const timeRange = ref<[string, string] | null>(null)
  const filters = reactive({
    tenantId: tenant.tenantId,
    severity: '',
    alertType: '',
    // 设计 #alerts 默认分组=「未处理」;深链 ?status= 预填仍会覆盖(见下方 route.query 块)
    status: 'OPEN',
    traceId: '',
    startTime: '',
    endTime: '',
  })

  const savedFilters = useSavedFilters({
    pageKey: 'alerts',
    userId: () => auth.userInfo?.userId,
    getCurrent: () => ({
      severity: filters.severity,
      alertType: filters.alertType,
      status: filters.status,
      traceId: filters.traceId,
      startTime: filters.startTime,
      endTime: filters.endTime,
    }),
    apply: (f) => {
      filters.severity = String(f.severity ?? '')
      filters.alertType = String(f.alertType ?? '')
      filters.status = String(f.status ?? '')
      filters.traceId = String(f.traceId ?? '')
      filters.startTime = String(f.startTime ?? '')
      filters.endTime = String(f.endTime ?? '')
      page.value = 1
      void load()
    },
  })

  // severity / alertStatus 走后端 enum 字典(完整候选);进页面就有数据,不依赖列表先加载
  const { data: metaEnums } = useConsoleMetaEnumsQuery()
  const severityOptions = computed(() => pickMetaEnumGroup(metaEnums.value, 'severity'))
  const statusOptions = computed(() => pickMetaEnumGroup(metaEnums.value, 'alertStatus'))
  // alertType 后端没枚举字典(各租户业务自定),保持从已加载数据 unique 派生
  const alertTypeOptions = computed(() =>
    Array.from(
      new Set(allRows.value.map((row) => row.alertType).filter((item): item is string => !!item)),
    ),
  )

  const hasAlertFilters = computed(
    () =>
      !!(
        filters.severity.trim() ||
        filters.alertType.trim() ||
        filters.status.trim() ||
        filters.traceId.trim() ||
        filters.startTime ||
        filters.endTime
      ),
  )

  const alertFilteredEmptyText = computed(() =>
    filters.traceId.trim() ? t('alertList.emptyTrace') : t('alertList.emptyFiltered'),
  )

  function actionBody(reason?: string) {
    return {
      tenantId: tenant.tenantId,
      operatorId: auth.userInfo?.username ?? auth.userInfo?.userId,
      reason,
    }
  }

  // ── 设计 #alerts:三分组 tab(未处理/已确认/全部)+ 真实计数 ──────────────
  const GROUP_TABS = [
    // 设计原型:「未处理」分组 pill 用琥珀(warning)点/描边,非 danger 红
    { key: 'OPEN', dot: 'var(--color-warning)', labelKey: 'alertList.tabOpen' },
    { key: 'ACKED', dot: 'var(--color-success)', labelKey: 'alertList.tabAcked' },
    { key: '', dot: '', labelKey: 'alertList.tabAll' },
  ] as const

  const groupCounts = reactive<Record<string, number | null>>({ OPEN: null, ACKED: null, '': null })
  let lastCountSig = ''
  async function loadGroupCounts() {
    const sig = JSON.stringify([
      tenant.tenantId,
      filters.severity,
      filters.alertType,
      filters.traceId,
      filters.startTime,
      filters.endTime,
    ])
    if (sig === lastCountSig) return
    lastCountSig = sig
    await Promise.all(
      GROUP_TABS.map(async (g) => {
        try {
          const resp = await queryAlertsPage(filters.tenantId || tenant.tenantId, 1, 1, {
            severity: (filters.severity ?? '').trim() || undefined,
            status: g.key || undefined,
            alertType: (filters.alertType ?? '').trim() || undefined,
            traceId: (filters.traceId ?? '').trim() || undefined,
            startDate: filters.startTime || undefined,
            endDate: filters.endTime || undefined,
          })
          groupCounts[g.key] = Number(resp.total ?? 0)
        } catch {
          groupCounts[g.key] = null
        }
      }),
    )
  }

  const groupTabs = computed(() =>
    GROUP_TABS.map((g) => ({
      key: g.key,
      dot: g.dot,
      label: t(g.labelKey),
      count: groupCounts[g.key],
      active: g.key ? filters.status === g.key : !filters.status,
    })),
  )

  function pickGroup(key: string) {
    filters.status = filters.status === key ? '' : key
    page.value = 1
    void load()
  }

  /** 严重度 → 设计卡片配色(左条/图标块/pill) */
  function sevMeta(sev: string | null | undefined) {
    const s = String(sev ?? '').toUpperCase()
    if (s === 'CRITICAL' || s === 'ERROR' || s === 'P0')
      return {
        color: 'var(--color-danger)',
        soft: 'color-mix(in srgb, var(--color-danger) 12%, transparent)',
      }
    if (s === 'WARN' || s === 'WARNING' || s === 'P1')
      return {
        color: 'var(--color-warning)',
        soft: 'color-mix(in srgb, var(--color-warning) 12%, transparent)',
      }
    // INFO/未知级别:设计原型是中性灰(icon/pill 灰字 + bg-elev 底),不是主色蓝
    return {
      color: 'var(--color-text-secondary)',
      soft: 'var(--color-bg-elevated)',
    }
  }

  /** severity pill 文案:复用 enum.severity.* 字典(严重/警告/错误/提示),缺字典回退原值 */
  function sevLabel(sev: string | null | undefined): string {
    const s = String(sev ?? '').toUpperCase()
    if (!s) return ''
    const key = `enum.severity.${s}`
    const v = t(key)
    return v && v !== key ? v : s
  }

  /** 设计原型时间格式:仅今天显示「今天 HH:mm」,非今天保持完整时间 */
  function fmtAlertTime(val: unknown): string {
    if (val === null || val === undefined || val === '') return '—'
    const d = typeof val === 'number' ? new Date(val) : new Date(String(val))
    if (isNaN(d.getTime())) return fmtDatetime(val)
    const now = new Date()
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    return sameDay ? fmtCompact(val) : fmtDatetime(val)
  }

  function onTimeChange(val: [string, string] | null) {
    filters.startTime = val?.[0] ?? ''
    filters.endTime = val?.[1] ?? ''
    page.value = 1
    void load()
  }

  const loadError = ref<unknown>(null)
  // 服务端分页 + 服务端筛选:severity/status/alertType/traceId/时间范围全部传后端
  // (BE 2026-06-21 契约对齐,status 传真值 OPEN/ACKED/SUPPRESSED/CLOSED,时间走 last_seen_at),
  // 不再做 acknowledged 映射与"当前页局部过滤"。
  async function load() {
    loading.value = true
    loadError.value = null
    try {
      const resp = await queryAlertsPage(
        filters.tenantId || tenant.tenantId,
        page.value,
        pageSize.value,
        {
          severity: (filters.severity ?? '').trim() || undefined,
          status: (filters.status ?? '').trim() || undefined,
          alertType: (filters.alertType ?? '').trim() || undefined,
          traceId: (filters.traceId ?? '').trim() || undefined,
          startDate: filters.startTime || undefined,
          endDate: filters.endTime || undefined,
        },
      )
      rows.value = (resp.items ?? []) as ConsoleAlertEventResponse[]
      total.value = Number(resp.total ?? rows.value.length)
      // 维护 union 供 alertType 候选,限制最近 5 页 ≈ 1000 行避免膨胀
      const cap = pageSize.value * 5
      allRows.value = [...allRows.value, ...rows.value].slice(-cap)
      void loadGroupCounts()
    } catch (err) {
      loadError.value = err
      throw err
    } finally {
      loading.value = false
      live.markRefreshed()
    }
  }

  // 翻页 / 改 pageSize 都触发 BE 重拉(替代旧的纯前端 slice)
  watch([page, pageSize], () => {
    void load()
  })

  function search() {
    return runSearch(async () => {
      // traceId 是全局唯一键,搜它时清掉时间范围(默认 today preset),否则别的业务日的告警搜不到。
      if (filters.traceId?.trim()) {
        timeRange.value = null
        filters.startTime = ''
        filters.endTime = ''
      }
      page.value = 1
      await load()
    })
  }

  function reset() {
    return runReset(async () => {
      filters.tenantId = tenant.tenantId
      filters.severity = ''
      filters.alertType = ''
      filters.status = ''
      filters.traceId = ''
      filters.startTime = ''
      filters.endTime = ''
      timeRange.value = null
      page.value = 1
      await load()
    })
  }

  async function optionalReason(title: string): Promise<string | undefined> {
    try {
      const { value } = await ElMessageBox.prompt(t('alertList.reasonPrompt'), title, {
        confirmButtonText: t('alertList.reasonSubmit'),
        cancelButtonText: t('alertList.reasonSkip'),
        distinguishCancelAndClose: true,
        inputPlaceholder: t('alertList.reasonPlaceholder'),
      })
      return value?.trim() || undefined
    } catch (e) {
      if (e === 'cancel') return undefined
      throw e
    }
  }

  async function doAck(row: ConsoleAlertEventResponse) {
    try {
      await confirmDanger({
        verb: '确认告警',
        target: `「${row.title}」`,
        consequence: '该告警将进入"已确认"状态,通知值班暂停升级,但不会自动修复根因。',
        confirmButtonText: '确认告警',
      })
      actingId.value = row.id
      const reason = await optionalReason(t('alertList.ackReasonTitle'))
      await acknowledgeAlert(row.id, actionBody(reason))
      ElMessage.success(t('alertList.ackedToast'))
      await load()
    } catch (e) {
      if (e !== 'cancel' && e !== 'close') {
        /* handled */
      }
    } finally {
      actingId.value = null
    }
  }

  async function doSilence(row: ConsoleAlertEventResponse) {
    try {
      await confirmDanger({
        verb: '静默',
        target: `「${row.title}」`,
        consequence: '该告警的同类事件将不再发出通知,直到静默期结束或被手动取消。',
        confirmButtonText: '确认静默',
      })
      actingId.value = row.id
      const reason = await optionalReason(t('alertList.silenceReasonTitle'))
      await silenceAlert(row.id, actionBody(reason))
      ElMessage.success(t('alertList.silencedToast'))
      await load()
    } catch (e) {
      if (e !== 'cancel' && e !== 'close') {
        /* handled */
      }
    } finally {
      actingId.value = null
    }
  }

  async function doClose(row: ConsoleAlertEventResponse) {
    try {
      await confirmDanger({
        verb: '关闭',
        target: `「${row.title}」`,
        consequence: '告警从看板下架。若根因未解决,同类事件仍会以新告警形式重新产生。',
        irreversible: true,
        confirmButtonText: '确认关闭',
      })
      actingId.value = row.id
      const reason = await optionalReason(t('alertList.closeReasonTitle'))
      await closeAlert(row.id, actionBody(reason))
      ElMessage.success(t('alertList.closedToast'))
      await load()
    } catch (e) {
      if (e !== 'cancel' && e !== 'close') {
        /* handled */
      }
    } finally {
      actingId.value = null
    }
  }

  watch(timeRange, (value) => {
    filters.startTime = value?.[0] ?? ''
    filters.endTime = value?.[1] ?? ''
  })

  const live = useSseAutoReload({
    domain: 'alerts',
    reload: load,
    scope: () => tenant.tenantId,
  })

  {
    const q = route.query
    if (q.severity) filters.severity = String(q.severity)
    if (q.status) filters.status = String(q.status)
    if (q.traceId) filters.traceId = String(q.traceId)
    if (q.alertType) filters.alertType = String(q.alertType)
    if (q.page) {
      const p = Number(q.page)
      if (Number.isFinite(p) && p > 0) page.value = p
    }
    if (q.pageSize) {
      const ps = Number(q.pageSize)
      if (Number.isFinite(ps) && ps > 0) pageSize.value = ps
    }
  }

  // URL state:筛选 + 分页 round-trip
  function syncFiltersToUrl() {
    const params: Record<string, string> = {}
    if (filters.severity) params.severity = filters.severity
    if (filters.status) params.status = filters.status
    if (filters.traceId) params.traceId = filters.traceId
    if (filters.alertType) params.alertType = filters.alertType
    if (page.value > 1) params.page = String(page.value)
    if (pageSize.value !== 15) params.pageSize = String(pageSize.value)
    void router.replace({ query: params })
  }
  watch(
    () => [
      filters.severity,
      filters.status,
      filters.traceId,
      filters.alertType,
      page.value,
      pageSize.value,
    ],
    syncFiltersToUrl,
  )

  useTenantReload(() => {
    page.value = 1
    void load()
  })
</script>

<style scoped>
  /* ── 照设计 #alerts dump 1:1(docs/redesign/proto-alerts.html) ── */
  .al-tabs {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 6px 0 14px;
    flex-wrap: wrap;
  }

  .al-tab {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 28px;
    padding: 0 12px;
    border-radius: 14px;
    border: 1px solid var(--color-border);
    background: transparent;
    color: var(--color-text-secondary);
    font-size: 12.5px;
    white-space: nowrap;
    cursor: pointer;
  }

  /* 激活 pill 跟随分组色(未处理=琥珀/已确认=绿),无分组色(全部)回退中性 */
  .al-tab.is-active {
    border-color: var(--al-tab-tint, var(--color-text-secondary));
    background: var(--color-bg-elevated);
    color: var(--al-tab-tint, var(--color-text-primary));
    font-weight: 600;
  }

  .al-tab.is-active .al-tab__count {
    color: inherit;
  }

  .al-tab__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .al-tab__count {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-text-tertiary);
  }

  .al-tabs__spacer {
    flex: 1;
  }

  .al-sel {
    width: 150px;
  }

  .al-trace {
    width: 200px;
  }

  .al-live {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 14px;
    margin-bottom: 10px;
    border: 1px solid var(--color-border);
    border-radius: 9px;
    background: var(--color-bg-card);
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  .al-live__dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--color-success);
  }

  .al-live__dot.is-off {
    background: var(--color-text-tertiary);
  }

  .al-live__title {
    color: var(--color-text-primary);
    font-weight: 500;
  }

  .al-live__sub {
    color: var(--color-text-tertiary);
  }

  /* 告警卡片流(14 16 / r12 / 左 3px 严重度条) */
  .al-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 120px;
  }

  .al-card {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 14px 16px;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-left-width: 3px;
    border-radius: 12px;
  }

  .al-card:hover {
    border-color: var(--color-border-strong, rgba(255, 255, 255, 0.16));
    box-shadow: var(--shadow-card);
  }

  .al-card__icon {
    width: 34px;
    height: 34px;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 17px;
  }

  .al-card__main {
    flex: 1;
    min-width: 0;
  }

  .al-card__meta {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .al-card__sev {
    font-size: 10.5px;
    font-weight: 600;
    padding: 1px 7px;
    border-radius: 5px;
  }

  .al-card__time {
    font-size: 11px;
    color: var(--color-text-tertiary);
    font-family: var(--font-mono);
  }

  .al-card__title {
    font-size: 13.5px;
    color: var(--color-text-primary);
    margin-top: 6px;
    line-height: 1.5;
  }

  .al-card__chips {
    margin-top: 7px;
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .al-card__chip {
    font-size: 11px;
    padding: 1px 7px;
    border-radius: 5px;
    background: var(--color-bg-elevated);
    color: var(--color-text-tertiary);
    font-family: var(--font-mono);
    text-decoration: none;
  }

  .al-card__chip--link {
    color: var(--color-primary);
  }

  .al-card__ops {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .al-op {
    font-size: 12px;
    color: var(--color-text-secondary);
    cursor: pointer;
    padding: 5px 11px;
    border-radius: 7px;
    border: 1px solid transparent;
    background: transparent;
  }

  .al-op:hover:not(:disabled) {
    background: var(--color-bg-elevated);
    color: var(--color-text-primary);
  }

  .al-op:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .al-op--ack {
    color: var(--color-primary);
    border-color: var(--color-border);
  }

  .al-op--ack:hover:not(:disabled) {
    background: color-mix(in srgb, var(--color-primary) 12%, transparent);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .al-op--danger:hover:not(:disabled) {
    color: var(--color-danger);
    background: color-mix(in srgb, var(--color-danger) 10%, transparent);
  }

  .al-acked {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    border-radius: 7px;
    font-size: 11px;
    color: var(--color-success);
    background: color-mix(in srgb, var(--color-success) 10%, transparent);
  }

  .al-empty {
    padding: 56px;
    text-align: center;
    color: var(--color-text-tertiary);
    font-size: 13px;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 12px;
  }
</style>
