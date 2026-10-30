<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button :icon="Refresh" :loading="anyLoading" @click="runAll">
          {{ t('opsDiagnostic.btnRunAll') }}
        </el-button>
      </template>
    </PageHeader>

    <!-- 还原设计:诊断卡片网格直铺底色,无外层卡片壳 -->
    <div>
      <div class="diag-catalog">
        <article
          v-for="card in diagCards"
          :key="card.key"
          class="diag-card"
          :class="{ 'is-active': card.expanded, 'is-error': card.error }"
        >
          <header class="diag-card__head">
            <span class="diag-card__icon">
              <el-icon><component :is="card.icon" /></el-icon>
            </span>
            <div class="diag-card__title">
              <h3>{{ card.title }}</h3>
              <p>{{ card.desc }}</p>
            </div>
          </header>

          <div class="diag-card__meta">
            <el-tag v-if="card.loading" size="small" effect="plain" type="info">
              {{ t('opsDiagnostic.statusRunning') }}
            </el-tag>
            <el-tag v-else-if="card.error" size="small" effect="plain" type="danger">
              {{ t('opsDiagnostic.statusFailed') }}
            </el-tag>
            <el-tag v-else-if="card.hasData" size="small" effect="plain" type="success">
              {{ t('opsDiagnostic.statusOk') }}
            </el-tag>
            <el-tag v-else size="small" effect="plain" type="info">
              {{ t('opsDiagnostic.statusIdle') }}
            </el-tag>
            <span v-if="card.lastRunAt" class="diag-card__time">
              {{ t('opsDiagnostic.lastRunAt', { time: card.lastRunAt }) }}
            </span>
          </div>

          <footer class="diag-card__action">
            <el-button
              v-if="card.hasData"
              type="primary"
              plain
              size="small"
              :icon="card.expanded ? ArrowUp : ArrowDown"
              @click="card.expanded = !card.expanded"
            >
              {{ card.expanded ? t('opsDiagnostic.btnCollapse') : t('opsDiagnostic.btnExpand') }}
            </el-button>
            <el-button
              type="primary"
              plain
              size="small"
              :icon="Refresh"
              :loading="card.loading"
              @click="card.run()"
            >
              {{ card.hasData ? t('opsDiagnostic.btnRerun') : t('opsDiagnostic.btnRun') }}
            </el-button>
          </footer>

          <el-collapse-transition>
            <div v-if="card.expanded && card.hasData" class="diag-card__result">
              <component :is="card.resultRender" />
            </div>
          </el-collapse-transition>
        </article>

        <!-- 补救卡片:危险动作,独立一张,跟诊断卡片视觉区分 -->
        <article class="diag-card diag-card--danger">
          <header class="diag-card__head">
            <span class="diag-card__icon diag-card__icon--danger">
              <el-icon><Tools /></el-icon>
            </span>
            <div class="diag-card__title">
              <h3>{{ t('opsDiagnostic.cardRemediation') }}</h3>
              <p>{{ t('opsDiagnostic.descRemediation') }}</p>
            </div>
          </header>

          <div class="diag-card__meta">
            <el-tag size="small" effect="plain" type="danger">
              {{ t('opsDiagnostic.badgeDanger') }}
            </el-tag>
          </div>

          <div class="diag-card__hint">
            <el-icon><InfoFilled /></el-icon>
            <span>{{ t('opsDiagnostic.remediationPrereq') }}</span>
          </div>
          <footer class="diag-card__action diag-card__action--dual">
            <el-tooltip
              :content="cleanupDisableReason || t('opsDiagnostic.cleanupTip')"
              placement="top"
            >
              <span class="diag-card__btn-wrap">
                <el-button
                  type="warning"
                  plain
                  size="small"
                  :icon="Delete"
                  :loading="cleaning"
                  :disabled="!!cleanupDisableReason || writesFrozen"
                  v-track-click="t('opsDiagnostic.trackCleanup')"
                  @click="doCleanup"
                >
                  {{ t('opsDiagnostic.btnCleanup') }}
                </el-button>
              </span>
            </el-tooltip>
            <el-tooltip
              :content="republishDisableReason || t('opsDiagnostic.republishTip')"
              placement="top"
            >
              <span class="diag-card__btn-wrap">
                <el-button
                  type="primary"
                  plain
                  size="small"
                  :icon="Promotion"
                  :loading="republishing"
                  :disabled="!!republishDisableReason || writesFrozen"
                  v-track-click="t('opsDiagnostic.trackRepublish')"
                  @click="doRepublish"
                >
                  {{ t('opsDiagnostic.btnRepublish') }}
                </el-button>
              </span>
            </el-tooltip>
          </footer>
        </article>
      </div>
    </div>

    <section v-if="canExportForensics" class="forensic-export">
      <header class="forensic-export__header">
        <div>
          <h3>{{ t('opsDiagnostic.forensicTitle') }}</h3>
          <p>{{ t('opsDiagnostic.forensicDescription') }}</p>
        </div>
        <el-tag type="warning" effect="plain">{{ t('opsDiagnostic.forensicAdminOnly') }}</el-tag>
      </header>
      <el-alert
        :title="t('opsDiagnostic.forensicSensitiveDataNotice')"
        type="warning"
        :closable="false"
        show-icon
      />
      <el-form label-position="top" class="forensic-export__form">
        <el-form-item :label="t('opsDiagnostic.forensicTenant')">
          <el-input :model-value="tenant.tenantId" disabled />
        </el-form-item>
        <el-form-item :label="t('opsDiagnostic.forensicDateFrom')">
          <el-date-picker
            v-model="forensicDateFrom"
            type="date"
            value-format="YYYY-MM-DD"
            :placeholder="t('opsDiagnostic.forensicDatePlaceholder')"
            :disabled="forensicPending || forensicDownloading"
          />
        </el-form-item>
        <el-form-item :label="t('opsDiagnostic.forensicDateTo')">
          <el-date-picker
            v-model="forensicDateTo"
            type="date"
            value-format="YYYY-MM-DD"
            :placeholder="t('opsDiagnostic.forensicDatePlaceholder')"
            :disabled="forensicPending || forensicDownloading"
          />
        </el-form-item>
        <el-form-item :label="t('opsDiagnostic.forensicJobCodes')">
          <el-input
            v-model="forensicJobCodeText"
            type="textarea"
            :rows="2"
            :placeholder="t('opsDiagnostic.forensicJobCodesPlaceholder')"
            :disabled="forensicPending || forensicDownloading"
          />
        </el-form-item>
      </el-form>
      <p v-if="forensicValidationKey" class="forensic-export__validation" role="alert">
        {{ t(`opsDiagnostic.${forensicValidationKey}`) }}
      </p>
      <el-alert
        v-if="forensicErrorKey"
        class="forensic-export__error"
        type="error"
        :closable="false"
        show-icon
        :title="t(`opsDiagnostic.${forensicErrorKey}`)"
      />
      <div class="forensic-export__actions">
        <el-button
          type="warning"
          :loading="forensicPending"
          :disabled="
            writesFrozen || !tenant.tenantId || !!forensicValidationKey || forensicDownloading
          "
          @click="submitForensicExport"
        >
          {{ t('opsDiagnostic.forensicCreate') }}
        </el-button>
      </div>
      <el-descriptions v-if="forensicExport" class="forensic-export__result" :column="2" border>
        <el-descriptions-item :label="t('opsDiagnostic.forensicExportId')">
          {{ forensicExport.exportId }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('opsDiagnostic.forensicStatus')">
          {{ forensicExport.status }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('opsDiagnostic.forensicFileSize')">
          {{ forensicSizeText }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('opsDiagnostic.forensicSha256')" :span="2">
          <code>{{ forensicExport.sha256 || '—' }}</code>
        </el-descriptions-item>
      </el-descriptions>
      <div v-if="forensicExport" class="forensic-export__actions">
        <el-button
          type="primary"
          plain
          :loading="forensicDownloading"
          :disabled="forensicExport.status !== 'COMPLETED' || !forensicExport.sha256"
          @click="downloadForensicBundle"
        >
          {{ t('opsDiagnostic.forensicDownload') }}
        </el-button>
      </div>
    </section>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, h, onMounted, reactive, ref, watch, type Component } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { confirmDanger } from '@/composables/useDangerConfirm'
  import {
    ChevronDown as ArrowDown,
    ChevronUp as ArrowUp,
    Cpu,
    BarChart3 as DataAnalysis,
    Trash2 as Delete,
    Info as InfoFilled,
    Lock,
    MessageSquare as MessageBox,
    Monitor,
    Send as Promotion,
    RefreshCw as Refresh,
    Wrench as Tools,
    TriangleAlert as Warning,
  } from '@lucide/vue'
  import { getKafkaLag, getOutboxStats, cleanupOutbox, republishOutbox } from '@/api/ops'
  import {
    getClusterDiagnostic,
    getShedLockStatus,
    getWorkerConsistency,
    getOutboxHealth,
    getTerminalChildrenHealth,
  } from '@/api/clusterDiagnostic'
  import { useTenantStore } from '@/stores/tenant'
  import { useAuthStore } from '@/stores/auth'
  import { useWriteAvailability } from '@/composables/useWriteAvailability'
  import { purifyHtml } from '@/utils/safeHtml'
  import { createIdempotencyKey } from '@/utils/idempotency'
  import { todayBusinessDate } from '@/utils/datetime'
  import {
    downloadForensicExport,
    requestForensicExport,
    type ForensicExportResponse,
  } from '@/api/forensic'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'
  import { fmtClockTime } from '@/utils/datetime'
  import { createOpsDiagnosticSummaries } from './opsDiagnosticPresentation'
  import { positiveLongId } from '@/utils/positiveLongId'

  const { t } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()
  const {
    writesFrozen,
    disabledReason: maintenanceWriteReason,
    ensureWriteAvailable,
  } = useWriteAvailability()
  const auth = useAuthStore()
  const canExportForensics = computed(() => auth.hasPermission('ROLE_ADMIN'))
  const forensicDateFrom = ref(todayBusinessDate())
  const forensicDateTo = ref(todayBusinessDate())
  const forensicJobCodeText = ref('')
  const forensicPending = ref(false)
  const forensicDownloading = ref(false)
  const forensicErrorKey = ref('')
  const forensicExport = ref<ForensicExportResponse | null>(null)
  const forensicExportTenantId = ref('')
  let forensicRequestSequence = 0

  const forensicJobCodes = computed(() =>
    forensicJobCodeText.value
      .split(/[\s,，]+/u)
      .map((code) => code.trim())
      .filter(Boolean),
  )

  function parseBusinessDate(value: string): number | null {
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null
    const timestamp = Date.parse(`${value}T00:00:00Z`)
    if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
      return null
    }
    return timestamp
  }

  const forensicValidationKey = computed(() => {
    const from = parseBusinessDate(forensicDateFrom.value)
    const to = parseBusinessDate(forensicDateTo.value)
    if (from == null || to == null) return 'forensicInvalidDate'
    if (from > to) return 'forensicDateOrderError'
    if (Math.floor((to - from) / 86_400_000) + 1 > 31) return 'forensicRangeTooLong'
    if (forensicJobCodes.value.length > 100) return 'forensicTooManyJobCodes'
    if (forensicJobCodes.value.some((code) => code.length > 128)) {
      return 'forensicJobCodeTooLong'
    }
    return ''
  })

  const forensicSizeText = computed(() => {
    const size = forensicExport.value?.fileSizeBytes
    return typeof size === 'number' && Number.isFinite(size)
      ? new Intl.NumberFormat().format(size)
      : '—'
  })

  watch(
    () => tenant.tenantId,
    () => {
      forensicRequestSequence += 1
      forensicExport.value = null
      forensicExportTenantId.value = ''
      forensicErrorKey.value = ''
      forensicPending.value = false
      forensicDownloading.value = false
    },
    { flush: 'sync' },
  )

  async function submitForensicExport() {
    if (!canExportForensics.value || !tenant.tenantId || !ensureWriteAvailable()) return
    if (forensicValidationKey.value) return
    const tenantId = tenant.tenantId
    const dateFrom = forensicDateFrom.value
    const dateTo = forensicDateTo.value
    const jobCodes = forensicJobCodes.value
    const sequence = ++forensicRequestSequence
    try {
      await confirmDanger({
        verb: t('opsDiagnostic.forensicConfirmTitle'),
        target: t('opsDiagnostic.forensicConfirmTarget', {
          from: dateFrom,
          to: dateTo,
          jobs: jobCodes.length,
        }),
        consequence: t('opsDiagnostic.forensicConfirmConsequence'),
        irreversible: true,
      })
    } catch {
      return
    }
    if (sequence !== forensicRequestSequence || tenant.tenantId !== tenantId) return
    forensicPending.value = true
    forensicErrorKey.value = ''
    forensicExport.value = null
    try {
      const response = await requestForensicExport(
        {
          tenantId,
          bizDateFrom: dateFrom,
          bizDateTo: dateTo,
          jobCodes: jobCodes.length ? jobCodes : undefined,
          exportFormat: 'BUNDLE',
        },
        createIdempotencyKey(),
      )
      if (sequence !== forensicRequestSequence || tenant.tenantId !== tenantId) return
      forensicExport.value = response
      forensicExportTenantId.value = tenantId
    } catch {
      if (sequence === forensicRequestSequence) forensicErrorKey.value = 'forensicCreateUnknown'
    } finally {
      if (sequence === forensicRequestSequence) forensicPending.value = false
    }
  }

  async function downloadForensicBundle() {
    const exportResult = forensicExport.value
    const tenantId = forensicExportTenantId.value
    if (
      !exportResult ||
      exportResult.status !== 'COMPLETED' ||
      !exportResult.sha256 ||
      !tenantId ||
      tenant.tenantId !== tenantId ||
      !canExportForensics.value
    ) {
      return
    }
    const sequence = forensicRequestSequence
    forensicDownloading.value = true
    forensicErrorKey.value = ''
    try {
      const response = await downloadForensicExport(exportResult.exportId, tenantId)
      if (sequence !== forensicRequestSequence || tenant.tenantId !== tenantId) return
      const url = URL.createObjectURL(response.data)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${exportResult.exportId.replace(/[^a-zA-Z0-9_-]/gu, '_')}.zip`
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
    } catch {
      if (sequence === forensicRequestSequence) forensicErrorKey.value = 'forensicDownloadFailed'
    } finally {
      if (sequence === forensicRequestSequence) forensicDownloading.value = false
    }
  }

  const {
    summarizeOutbox,
    summarizeCluster,
    summarizeWorker,
    summarizeOutboxHealth,
    summarizeTerminalChildrenHealth,
  } = createOpsDiagnosticSummaries((key, params) => t(key, params ?? {}))

  // ──────────────────────────────────────────────
  // 7 张诊断卡片状态机
  // ──────────────────────────────────────────────
  interface DiagCard {
    key: string
    icon: Component
    title: string
    desc: string
    loading: boolean
    error: boolean
    expanded: boolean
    data: unknown
    lastRunAt: string
    hasData: boolean
    run: () => Promise<void>
    cancel: () => void
    resultRender: () => unknown
  }

  function fmtNow() {
    const currentTime = new Date()
    return fmtClockTime(currentTime)
  }

  function createCard(opts: {
    key: string
    icon: Component
    title: string
    desc: string
    fetch: (tenantId: string) => Promise<unknown>
    /** 渲染展开后的卡片结果体(JsonPreview / el-table 等) */
    render: (data: unknown) => unknown
  }): DiagCard {
    let requestSequence = 0
    const state = reactive({
      loading: false,
      error: false,
      expanded: false,
      data: null as unknown,
      lastRunAt: '',
    }) as Pick<DiagCard, 'loading' | 'error' | 'expanded' | 'data' | 'lastRunAt'>

    async function run() {
      const sequence = ++requestSequence
      const tenantId = tenant.tenantId
      if (!tenantId) return
      state.loading = true
      state.error = false
      try {
        const data = await opts.fetch(tenantId)
        if (sequence !== requestSequence || tenant.tenantId !== tenantId) return
        state.data = data
        state.lastRunAt = fmtNow()
        state.expanded = true
      } catch {
        if (sequence !== requestSequence || tenant.tenantId !== tenantId) return
        state.data = null
        state.error = true
      } finally {
        if (sequence === requestSequence) state.loading = false
      }
    }

    function cancel() {
      requestSequence += 1
      state.loading = false
      state.data = null
      state.error = false
      state.expanded = false
      state.lastRunAt = ''
    }

    return reactive({
      key: opts.key,
      icon: opts.icon,
      title: opts.title,
      desc: opts.desc,
      get loading() {
        return state.loading
      },
      get error() {
        return state.error
      },
      get expanded() {
        return state.expanded
      },
      set expanded(v: boolean) {
        state.expanded = v
      },
      get data() {
        return state.data
      },
      get lastRunAt() {
        return state.lastRunAt
      },
      get hasData() {
        return state.data != null
      },
      run,
      cancel,
      resultRender: () => opts.render(state.data),
    }) as DiagCard
  }

  // 渲染助手:summary + JsonPreview
  function renderJsonWithSummary(summarizer: (data: unknown) => string) {
    return (data: unknown) =>
      h(
        JsonPreview,
        { data },
        {
          summary: ({ data: d }: { data: unknown }) => {
            const summary = summarizer(d)
            const safeSummary = purifyHtml(summary)
            return h('span', { innerHTML: safeSummary })
          },
        },
      )
  }

  // Kafka lag 用专属表格
  function renderKafkaLag(data: unknown) {
    if (!Array.isArray(data) || data.length === 0) {
      return h('div', { class: 'diag-empty' }, t('opsDiagnostic.emptyData'))
    }
    const headerCells = [
      h('th', null, 'Group ID'),
      h('th', { class: 'num' }, 'Lag'),
      h('th', { class: 'num' }, 'Partitions'),
    ]
    const headerRow = h('tr', null, headerCells)
    const tableHead = h('thead', null, headerRow)
    const tableRows = (data as Array<Record<string, unknown>>).map((row) => {
      const rowKey = String(row.groupId)
      const groupId = String(row.groupId ?? '')
      const groupCell = h('td', { class: 'mono' }, groupId)
      if (row.error != null || row.totalLag == null || row.partitionCount == null) {
        const message =
          typeof row.error === 'string' && row.error.trim()
            ? row.error
            : t('opsDiagnostic.kafkaLagUnavailable')
        const errorCell = h('td', { class: 'lag-bad', colspan: 2 }, message)
        return h('tr', { key: rowKey }, [groupCell, errorCell])
      }
      const lagValue = Number(row.totalLag)
      const lagLabel = String(row.totalLag)
      const lagClass = lagValue > 0 ? 'lag-bad' : 'lag-ok'
      const partitionCount = String(row.partitionCount)
      const lagBadge = h('span', { class: lagClass }, lagLabel)
      const lagCell = h('td', { class: 'num' }, lagBadge)
      const partitionCell = h('td', { class: 'num' }, partitionCount)
      const rowCells = [groupCell, lagCell, partitionCell]
      return h('tr', { key: rowKey }, rowCells)
    })
    const tableBody = h('tbody', null, tableRows)
    const tableSections = [tableHead, tableBody]
    const table = h('table', { class: 'diag-mini-table' }, tableSections)
    const content = h('div', { class: 'diag-kafka-lag' }, [table])
    return content
  }

  function renderShedLock(data: unknown) {
    const locks = data && typeof data === 'object' && 'locks' in data ? data.locks : undefined
    if (!Array.isArray(locks) || locks.length === 0) {
      return h(JsonPreview, { data })
    }
    const lockNameHeader = h('th', null, t('opsDiagnostic.colLockName'))
    const lockUntilHeader = h('th', null, t('opsDiagnostic.colLockUntil'))
    const lockedByHeader = h('th', null, t('opsDiagnostic.colLockedBy'))
    const headerCells = [lockNameHeader, lockUntilHeader, lockedByHeader]
    const headerRow = h('tr', null, headerCells)
    const tableHead = h('thead', null, headerRow)
    const tableRows = (locks as Array<Record<string, unknown>>).map((row, index) => {
      const rowKey = index
      const lockName = String(row.name ?? '')
      const lockUntil = String(row.lockUntil ?? '')
      const lockedBy = String(row.lockedBy ?? '')
      const lockNameCell = h('td', { class: 'mono' }, lockName)
      const lockUntilCell = h('td', null, lockUntil)
      const lockedByCell = h('td', { class: 'mono' }, lockedBy)
      const rowCells = [lockNameCell, lockUntilCell, lockedByCell]
      return h('tr', { key: rowKey }, rowCells)
    })
    const tableBody = h('tbody', null, tableRows)
    const tableSections = [tableHead, tableBody]
    const table = h('table', { class: 'diag-mini-table' }, tableSections)
    const content = h('div', { class: 'diag-shedlock' }, [table])
    return content
  }

  const cardKafkaLag = createCard({
    key: 'kafkaLag',
    icon: Warning,
    title: t('opsDiagnostic.sectionKafkaLag'),
    desc: t('opsDiagnostic.descKafkaLag'),
    fetch: getKafkaLag,
    render: renderKafkaLag,
  })
  const cardOutboxStats = createCard({
    key: 'outboxStats',
    icon: MessageBox,
    title: t('opsDiagnostic.sectionOutboxStats'),
    desc: t('opsDiagnostic.descOutboxStats'),
    fetch: getOutboxStats,
    render: renderJsonWithSummary(summarizeOutbox),
  })
  const cardCluster = createCard({
    key: 'cluster',
    icon: Monitor,
    title: t('opsDiagnostic.sectionClusterOverview'),
    desc: t('opsDiagnostic.descCluster'),
    fetch: getClusterDiagnostic,
    render: renderJsonWithSummary(summarizeCluster),
  })
  const cardShedLock = createCard({
    key: 'shedLock',
    icon: Lock,
    title: t('opsDiagnostic.sectionShedLock'),
    desc: t('opsDiagnostic.descShedLock'),
    fetch: getShedLockStatus,
    render: renderShedLock,
  })
  const cardWorker = createCard({
    key: 'worker',
    icon: Cpu,
    title: t('opsDiagnostic.sectionWorkerConsistency'),
    desc: t('opsDiagnostic.descWorker'),
    fetch: getWorkerConsistency,
    render: renderJsonWithSummary(summarizeWorker),
  })
  const cardOutboxHealth = createCard({
    key: 'outboxHealth',
    icon: DataAnalysis,
    title: t('opsDiagnostic.sectionOutboxHealth'),
    desc: t('opsDiagnostic.descOutboxHealth'),
    fetch: getOutboxHealth,
    render: renderJsonWithSummary(summarizeOutboxHealth),
  })
  const cardTerminalChildren = createCard({
    key: 'terminalChildren',
    icon: Warning,
    title: t('opsDiagnostic.sectionTerminalChildren'),
    desc: t('opsDiagnostic.descTerminalChildren'),
    fetch: getTerminalChildrenHealth,
    render: renderJsonWithSummary(summarizeTerminalChildrenHealth),
  })

  // 卡片顺序按 oncall 排障扫读心智:
  // 集群概览(top-down)→ Worker 一致性 → Kafka Lag(消息层)→ Outbox 统计 → Outbox 健康
  // → ShedLock(底层锁,低频)。Outbox 补救卡片(高危)在模板最后单独渲染。
  const diagCards = computed<DiagCard[]>(() => [
    cardCluster,
    cardWorker,
    cardKafkaLag,
    cardOutboxStats,
    cardOutboxHealth,
    cardTerminalChildren,
    cardShedLock,
  ])

  let tenantRevision = 0
  watch(
    () => tenant.tenantId,
    (tenantId) => {
      tenantRevision += 1
      diagCards.value.forEach((card) => {
        card.cancel()
        if (tenantId) void card.run()
      })
    },
    { flush: 'sync' },
  )

  const anyLoading = computed(() => diagCards.value.some((c) => c.loading))

  async function runAll() {
    // 并发跑全部诊断卡片,容忍单个失败
    await Promise.all(diagCards.value.map((c) => c.run().catch(() => undefined)))
    const failed = diagCards.value.filter((c) => c.error).length
    if (failed === 0) ElMessage.success(t('opsDiagnostic.refreshDone'))
    else if (failed === diagCards.value.length) ElMessage.error(t('opsDiagnostic.refreshAllFailed'))
    else ElMessage.warning(t('opsDiagnostic.refreshPartial', { n: failed }))
  }

  // ──────────────────────────────────────────────
  // 补救卡片:cleanup + republish
  // ──────────────────────────────────────────────
  const cleaning = ref(false)
  const republishing = ref(false)

  /**
   * 前置条件:Outbox 补救按钮在不满足条件时禁用,tooltip 给出原因。
   *  - 清理:需 ADMIN + 统计中存在已发布或已放弃事件，保留期由服务端判断
   *  - 重发布:需 ADMIN + 统计中存在失败或已放弃事件
   */
  const isAdmin = computed(() => auth.role === 'ADMIN')

  const cleanupDisableReason = computed<string>(() => {
    if (writesFrozen.value) return maintenanceWriteReason.value ?? ''
    if (!isAdmin.value) return t('opsDiagnostic.needAdmin')
    const stats = cardOutboxStats.data as Record<string, unknown> | null
    if (!stats) return t('opsDiagnostic.needOutboxStats')
    const breakdown = Array.isArray(stats.statusBreakdown) ? stats.statusBreakdown : []
    const total = breakdown.reduce((sum: number, row: Record<string, unknown>) => {
      const eligible = row.publishStatus === 'PUBLISHED' || row.publishStatus === 'GIVE_UP'
      return sum + (eligible ? Number(row.count ?? 0) : 0)
    }, 0)
    if (total === 0) return t('opsDiagnostic.cleanupNoTargets')
    return ''
  })

  const republishDisableReason = computed<string>(() => {
    if (writesFrozen.value) return maintenanceWriteReason.value ?? ''
    if (!isAdmin.value) return t('opsDiagnostic.needAdmin')
    const stats = cardOutboxStats.data as Record<string, unknown> | null
    if (!stats) return t('opsDiagnostic.needOutboxStats')
    const breakdown = Array.isArray(stats.statusBreakdown) ? stats.statusBreakdown : []
    const republishableEventCount = breakdown.reduce(
      (sum: number, row: Record<string, unknown>) => {
        const eligible = row.publishStatus === 'FAILED' || row.publishStatus === 'GIVE_UP'
        return sum + (eligible ? Number(row.count ?? 0) : 0)
      },
      0,
    )
    if (republishableEventCount === 0) return t('opsDiagnostic.republishNoTargets')
    return ''
  })

  async function doCleanup() {
    if (!ensureWriteAvailable()) return
    const tenantId = tenant.tenantId
    const revision = tenantRevision
    try {
      await confirmDanger({
        verb: t('opsDiagnostic.cleanupConfirmTitle'),
        target: '',
        consequence: t('opsDiagnostic.cleanupConfirmText'),
      })
      if (!tenantId || revision !== tenantRevision || !isAdmin.value || !ensureWriteAvailable())
        return
      cleaning.value = true
      await cleanupOutbox(tenantId)
      ElMessage.success(t('opsDiagnostic.cleanupDoneToast'))
      // 顺手刷新一下 outbox 卡片
      void cardOutboxStats.run()
    } catch {
      /* cancel */
    } finally {
      cleaning.value = false
    }
  }

  async function doRepublish() {
    if (!ensureWriteAvailable()) return
    const tenantId = tenant.tenantId
    const revision = tenantRevision
    try {
      const { value: idsText } = await ElMessageBox.prompt(
        t('opsDiagnostic.republishPromptText'),
        t('opsDiagnostic.republishPromptTitle'),
        {
          inputPattern: /^\s*\d+(\s*,\s*\d+)*\s*$/,
          inputErrorMessage: t('opsDiagnostic.republishPromptError'),
          type: 'warning',
        },
      )
      if (!tenantId || revision !== tenantRevision || !isAdmin.value || !ensureWriteAvailable())
        return
      const parts = idsText.split(',').map((value: string) => value.trim())
      const ids = parts.map(positiveLongId)
      if (ids.some((id: string | null) => id === null)) {
        ElMessage.warning(t('opsDiagnostic.noValidIds'))
        return
      }
      republishing.value = true
      const result = await republishOutbox(tenantId, ids as string[])
      if (revision !== tenantRevision) return
      if (result.resetCount < result.requestedCount) {
        ElMessage.warning(
          t('opsDiagnostic.republishPartialToast', {
            requested: result.requestedCount,
            reset: result.resetCount,
          }),
        )
      } else {
        ElMessage.success(t('opsDiagnostic.republishDoneToast', { n: result.resetCount }))
      }
      void cardOutboxStats.run()
    } catch {
      /* cancel */
    } finally {
      republishing.value = false
    }
  }

  // 进页面并发预热所有卡，避免用户手动逐个点"加载"
  onMounted(() => {
    void Promise.all(diagCards.value.map((c) => c.run().catch(() => undefined)))
  })
</script>

<style scoped>
  .diag-catalog {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
  }

  .diag-card {
    display: grid;
    grid-template-rows: auto auto auto auto;
    align-content: start;
    gap: 10px;
    padding: 13px;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
    background: var(--color-bg-card);
    transition:
      transform var(--motion-duration-sm) var(--motion-ease-emphasized),
      border-color var(--motion-duration-md) var(--motion-ease-standard),
      box-shadow var(--motion-duration-md) var(--motion-ease-standard);
  }

  .diag-card:hover {
    transform: translateY(-1px);
    border-color: color-mix(in srgb, var(--color-border) 75%, var(--color-primary) 25%);
    box-shadow: 0 8px 20px color-mix(in srgb, var(--color-text-primary) 8%, transparent);
  }

  .diag-card.is-active {
    border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-border) 65%);
  }

  .diag-card.is-error {
    border-color: color-mix(in srgb, var(--color-danger) 32%, var(--color-border) 68%);
  }

  .diag-card--danger {
    border-color: color-mix(in srgb, var(--color-danger) 24%, var(--color-border) 76%);
    background: color-mix(in srgb, var(--color-danger) 3%, var(--color-bg-card) 97%);
  }

  .diag-card__head {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }

  .diag-card__icon {
    flex: 0 0 auto;
    width: 34px;
    height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-input);
    background: color-mix(in srgb, var(--color-primary) 12%, var(--color-bg-card) 88%);
    border: 1px solid color-mix(in srgb, var(--color-primary) 22%, var(--color-border) 78%);
    color: var(--color-primary);
  }

  .diag-card__icon--danger {
    background: color-mix(in srgb, var(--color-danger) 12%, var(--color-bg-card) 88%);
    border-color: color-mix(in srgb, var(--color-danger) 22%, var(--color-border) 78%);
    color: var(--color-danger);
  }

  .diag-card__icon :deep(svg) {
    width: 18px;
    height: 18px;
  }

  .diag-card__title {
    min-width: 0;
    flex: 1;
  }

  .diag-card__title h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 650;
    line-height: 1.35;
    color: var(--color-text-primary);
  }

  .diag-card__title p {
    margin: 4px 0 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--color-text-secondary);
  }

  .diag-card__meta {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }

  .diag-card__time {
    font-size: 11px;
    color: var(--color-text-tertiary);
  }

  .diag-card__action {
    display: flex;
    gap: 8px;
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .diag-card__action--dual {
    justify-content: space-between;
  }

  /* 高危补救按钮的前置条件提示行,放在按钮上方,info 蓝图标 + 浅色文字 */
  .diag-card__hint {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin: 4px 0 10px;
    padding: 8px 10px;
    font-size: 12px;
    line-height: 1.55;
    color: var(--color-text-secondary);
    background: color-mix(in srgb, var(--color-primary) 5%, transparent);
    border-left: 2px solid color-mix(in srgb, var(--color-primary) 40%, transparent);
    border-radius: 4px;
  }

  .diag-card__hint .el-icon {
    color: var(--color-primary);
    flex-shrink: 0;
    margin-top: 1px;
  }

  /* 包一层 span 让 el-tooltip 即使在 disabled button 上也能触发(EP 默认 disabled 不触发) */
  .diag-card__btn-wrap {
    display: inline-flex;
  }

  .diag-card__result {
    margin-top: 4px;
    padding-top: 12px;
    border-top: 1px dashed var(--color-border-light);
    font-size: 12px;
  }

  /* 卡片内嵌 mini 表格(Kafka lag / ShedLock) */
  .diag-card__result :deep(.diag-mini-table) {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }

  .diag-card__result :deep(.diag-mini-table th),
  .diag-card__result :deep(.diag-mini-table td) {
    padding: 6px 8px;
    border-bottom: 1px solid var(--color-border-light);
    text-align: left;
  }

  .diag-card__result :deep(.diag-mini-table th) {
    font-weight: 600;
    color: var(--color-text-secondary);
    background: color-mix(in srgb, var(--color-bg-card) 92%, var(--color-bg-canvas) 8%);
  }

  .diag-card__result :deep(.diag-mini-table .num) {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .diag-card__result :deep(.diag-mini-table .mono) {
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, monospace;
    font-size: 11.5px;
    color: var(--color-text-primary);
  }

  .diag-card__result :deep(.lag-bad) {
    color: var(--color-danger);
    font-weight: 700;
  }

  .diag-card__result :deep(.lag-ok) {
    color: var(--color-success);
  }

  .diag-card__result :deep(.diag-empty) {
    padding: 16px;
    text-align: center;
    color: var(--color-text-tertiary);
  }

  .forensic-export {
    display: grid;
    gap: 14px;
    margin-top: 20px;
    padding: 18px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-card);
    background: var(--color-bg-card);
  }

  .forensic-export__header,
  .forensic-export__actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .forensic-export__header h3 {
    margin: 0;
    font-size: 15px;
  }

  .forensic-export__header p {
    margin: 5px 0 0;
    color: var(--color-text-secondary);
    font-size: 12px;
  }

  .forensic-export__form {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0 14px;
  }

  .forensic-export__form :deep(.el-form-item:last-child) {
    grid-column: 1 / -1;
  }

  .forensic-export__validation {
    margin: -8px 0 0;
    color: var(--color-danger);
    font-size: 12px;
  }

  .forensic-export__result code {
    overflow-wrap: anywhere;
  }

  @media (max-width: 640px) {
    .diag-catalog {
      grid-template-columns: 1fr;
    }

    .forensic-export__form {
      grid-template-columns: 1fr;
    }

    .forensic-export__header {
      align-items: flex-start;
    }
  }
</style>
