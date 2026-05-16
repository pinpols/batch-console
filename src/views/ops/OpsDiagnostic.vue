<template>
  <PageContainer>
    <PageHeader />

    <SectionCard>
      <el-tabs v-model="activeTab" v-hover-tab-activate="true" class="pill-tabs">
        <el-tab-pane :label="t('opsDiagnostic.tabToolbox')" name="toolbox">
          <div class="data-panel">
            <div class="section-toolbar">
              <h3 class="section-title u-mb-0">{{ t('opsDiagnostic.sectionKafkaLag') }}</h3>
              <span class="u-flex-1" />
              <el-button :loading="loadingLag" @click="loadKafkaLag()">
                {{ t('opsDiagnostic.btnRefresh') }}
              </el-button>
            </div>
            <JsonPreview v-if="kafkaLag" :data="kafkaLag" />
            <el-empty v-else :description="t('opsDiagnostic.emptyData')" />
          </div>

          <div class="data-panel">
            <div class="section-toolbar">
              <h3 class="section-title u-mb-0">{{ t('opsDiagnostic.sectionOutboxStats') }}</h3>
              <span class="u-flex-1" />
              <el-button :loading="loadingOutbox" @click="loadOutboxStats()">
                {{ t('opsDiagnostic.btnRefresh') }}
              </el-button>
              <el-button
                type="warning"
                :loading="cleaning"
                v-track-click="t('opsDiagnostic.trackCleanup')"
                @click="doCleanup"
              >
                {{ t('opsDiagnostic.btnCleanup') }}
              </el-button>
              <el-button
                type="primary"
                :loading="republishing"
                v-track-click="t('opsDiagnostic.trackRepublish')"
                @click="doRepublish"
              >
                {{ t('opsDiagnostic.btnRepublish') }}
              </el-button>
            </div>
            <JsonPreview v-if="outboxStats" :data="outboxStats" />
            <el-empty v-else :description="t('opsDiagnostic.emptyData')" />
          </div>
        </el-tab-pane>

        <el-tab-pane :label="t('opsDiagnostic.tabCluster')" name="cluster">
          <div class="section-toolbar">
            <span class="u-flex-1" />
            <el-button type="primary" :loading="loadingCluster" @click="loadCluster()">
              {{ t('opsDiagnostic.btnRefreshAll') }}
            </el-button>
          </div>

          <div class="data-panel">
            <h3 class="section-title">
              {{ t('opsDiagnostic.sectionClusterOverview') }}
              <el-tag v-if="errors.cluster" type="danger" size="small" effect="plain">
                {{ t('opsDiagnostic.loadFailed') }}
              </el-tag>
            </h3>
            <JsonPreview v-if="clusterData" :data="clusterData" />
            <el-empty v-else :description="t('opsDiagnostic.emptyData')" />
          </div>

          <div class="data-panel">
            <h3 class="section-title">
              {{ t('opsDiagnostic.sectionShedLock') }}
              <el-tag v-if="errors.shedLock" type="danger" size="small" effect="plain">
                {{ t('opsDiagnostic.loadFailed') }}
              </el-tag>
            </h3>
            <el-table
              v-if="shedLockRows.length"
              :data="shedLockRows"
              stripe
              border
              size="small"
              class="console-table"
            >
              <el-table-column
                prop="name"
                :label="t('opsDiagnostic.colLockName')"
                min-width="200"
                show-overflow-tooltip
              />
              <el-table-column prop="lockUntil" label="Lock Until" width="200" />
              <DatetimeColumn prop="lockedAt" label="Locked At" width="160" />
              <el-table-column
                prop="lockedBy"
                label="Locked By"
                min-width="180"
                show-overflow-tooltip
              />
            </el-table>
            <JsonPreview v-else-if="shedLockRaw" :data="shedLockRaw" />
            <el-empty v-else :description="t('opsDiagnostic.emptyData')" />
          </div>

          <div class="data-panel">
            <h3 class="section-title">
              {{ t('opsDiagnostic.sectionWorkerConsistency') }}
              <el-tag v-if="errors.workerConsistency" type="danger" size="small" effect="plain">
                {{ t('opsDiagnostic.loadFailed') }}
              </el-tag>
            </h3>
            <JsonPreview v-if="workerConsistency" :data="workerConsistency" />
            <el-empty v-else :description="t('opsDiagnostic.emptyData')" />
          </div>

          <div class="data-panel">
            <h3 class="section-title">
              {{ t('opsDiagnostic.sectionOutboxHealth') }}
              <el-tag v-if="errors.outboxHealth" type="danger" size="small" effect="plain">
                {{ t('opsDiagnostic.loadFailed') }}
              </el-tag>
            </h3>
            <JsonPreview v-if="outboxHealth" :data="outboxHealth" />
            <el-empty v-else :description="t('opsDiagnostic.emptyData')" />
          </div>
        </el-tab-pane>
      </el-tabs>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, reactive, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'

  const { t } = useI18n({ useScope: 'global' })
  import { getKafkaLag, getOutboxStats, cleanupOutbox, republishOutbox } from '@/api/ops'
  import {
    getClusterDiagnostic,
    getShedLockStatus,
    getWorkerConsistency,
    getOutboxHealth,
  } from '@/api/clusterDiagnostic'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'

  const tenant = useTenantStore()
  const activeTab = ref<'toolbox' | 'cluster'>('toolbox')
  const loadedTabs = reactive<Record<string, boolean>>({})

  // ── 工具箱 ──
  const loadingLag = ref(false)
  const loadingOutbox = ref(false)
  const cleaning = ref(false)
  const republishing = ref(false)
  const kafkaLag = ref<unknown>(null)
  const outboxStats = ref<unknown>(null)

  async function loadKafkaLag(silent = false) {
    loadingLag.value = true
    try {
      kafkaLag.value = await getKafkaLag(tenant.tenantId)
      if (!silent) ElMessage.success(t('opsDiagnostic.refreshDone'))
    } catch {
      kafkaLag.value = null
    } finally {
      loadingLag.value = false
    }
  }

  async function loadOutboxStats(silent = false) {
    loadingOutbox.value = true
    try {
      outboxStats.value = await getOutboxStats(tenant.tenantId)
      if (!silent) ElMessage.success(t('opsDiagnostic.refreshDone'))
    } catch {
      outboxStats.value = null
    } finally {
      loadingOutbox.value = false
    }
  }

  async function doCleanup() {
    try {
      await ElMessageBox.confirm(
        t('opsDiagnostic.cleanupConfirmText'),
        t('opsDiagnostic.cleanupConfirmTitle'),
        { type: 'warning' },
      )
      cleaning.value = true
      await cleanupOutbox(tenant.tenantId)
      ElMessage.success(t('opsDiagnostic.cleanupDoneToast'))
      await loadOutboxStats()
    } catch {
      /* cancel */
    } finally {
      cleaning.value = false
    }
  }

  async function doRepublish() {
    try {
      // BE @NotEmpty List<Long> ids,空数组会 400 → 让用户输入要重投的事件 ID
      const { value: idsText } = await ElMessageBox.prompt(
        t('opsDiagnostic.republishPromptText'),
        t('opsDiagnostic.republishPromptTitle'),
        {
          inputPattern: /^\s*\d+(\s*,\s*\d+)*\s*$/,
          inputErrorMessage: t('opsDiagnostic.republishPromptError'),
          type: 'warning',
        },
      )
      const ids = idsText
        .split(',')
        .map((s: string) => Number(s.trim()))
        .filter((n: number) => !Number.isNaN(n) && n > 0)
      if (!ids.length) {
        ElMessage.warning(t('opsDiagnostic.noValidIds'))
        return
      }
      republishing.value = true
      await republishOutbox(tenant.tenantId, ids)
      ElMessage.success(t('opsDiagnostic.republishDoneToast', { n: ids.length }))
      await loadOutboxStats()
    } catch {
      /* cancel */
    } finally {
      republishing.value = false
    }
  }

  // ── 集群诊断 ──
  const loadingCluster = ref(false)
  const clusterData = ref<unknown>(null)
  const shedLockRaw = ref<unknown>(null)
  const shedLockRows = ref<Record<string, unknown>[]>([])
  const workerConsistency = ref<unknown>(null)
  const outboxHealth = ref<unknown>(null)
  const errors = reactive({
    cluster: false,
    shedLock: false,
    workerConsistency: false,
    outboxHealth: false,
  })

  async function loadCluster(silent = false) {
    loadingCluster.value = true
    const wrap = <T,>(p: Promise<T>): Promise<{ ok: true; v: T } | { ok: false }> =>
      p.then((v) => ({ ok: true as const, v })).catch(() => ({ ok: false as const }))
    const [cluster, shedLock, workers, outbox] = await Promise.all([
      wrap(getClusterDiagnostic(tenant.tenantId)),
      wrap(getShedLockStatus(tenant.tenantId)),
      wrap(getWorkerConsistency(tenant.tenantId)),
      wrap(getOutboxHealth(tenant.tenantId)),
    ])
    clusterData.value = cluster.ok ? cluster.v : null
    const shedLockVal = shedLock.ok ? shedLock.v : null
    shedLockRaw.value = shedLockVal
    shedLockRows.value = Array.isArray(shedLockVal)
      ? (shedLockVal as Record<string, unknown>[])
      : []
    workerConsistency.value = workers.ok ? workers.v : null
    outboxHealth.value = outbox.ok ? outbox.v : null
    errors.cluster = !cluster.ok
    errors.shedLock = !shedLock.ok
    errors.workerConsistency = !workers.ok
    errors.outboxHealth = !outbox.ok
    loadingCluster.value = false

    const all = [cluster, shedLock, workers, outbox]
    const failed = all.filter((r) => !r.ok).length
    if (!silent) {
      if (failed === 0) ElMessage.success(t('opsDiagnostic.refreshDone'))
      else if (failed === all.length) ElMessage.error(t('opsDiagnostic.refreshAllFailed'))
      else ElMessage.warning(t('opsDiagnostic.refreshPartial', { n: failed }))
    }
  }

  // 懒加载:仅当前 tab 拉数据;切 tab 时若未加载过再拉一次。
  // 租户切换会重置已加载标记 → 下次访问 tab 再重新加载,避免一次发 6 个请求。
  async function ensureLoaded(tab: 'toolbox' | 'cluster', silent = false) {
    if (loadedTabs[tab] && silent) return
    if (tab === 'toolbox') {
      await Promise.all([loadKafkaLag(true), loadOutboxStats(true)])
    } else {
      await loadCluster(true)
    }
    loadedTabs[tab] = true
  }

  watch(
    activeTab,
    (tab) => {
      void ensureLoaded(tab, true)
    },
    { immediate: true },
  )

  useTenantReload(() => {
    loadedTabs.toolbox = false
    loadedTabs.cluster = false
    void ensureLoaded(activeTab.value, true)
  })
</script>

<style scoped></style>
