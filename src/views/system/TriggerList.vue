<template>
  <PageContainer>
    <PageHeader />

    <div>
      <ProTable
        :data="pagedRows"
        :loading="tableBlocking"
        :error="loadError"
        :empty-text="triggerDegraded ? t('triggerList.degradedEmpty') : undefined"
        :on-retry="load"
        :total="filtered.length"
        v-model:page="page"
        v-model:page-size="pageSize"
        :has-active-filters="!!keyword"
        @change="() => {}"
      >
        <template #query>
          <ListPageQueryBar
            :filter-busy="filterBusy"
            :refresh-busy="loading"
            @search="onSearch"
            @reset="onReset"
            @refresh="() => runRefresh(load)"
          >
            <el-form-item :label="t('triggerList.workflowCodeLabel')">
              <el-input
                class="query-w-220"
                v-model="kwDraft"
                clearable
                :placeholder="t('triggerList.workflowCodePlaceholder')"
                @keyup.enter="onSearch"
              />
            </el-form-item>
          </ListPageQueryBar>
        </template>
        <el-table-column
          prop="workflowCode"
          :label="t('triggerList.colWorkflowCode')"
          min-width="180"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <CopyableText :text="String(row.workflowCode ?? '')" />
          </template>
        </el-table-column>
        <el-table-column prop="triggerType" :label="t('triggerList.colType')" width="120">
          <template #default="{ row }">
            {{ resolveTriggerType(row.triggerType) }}
          </template>
        </el-table-column>
        <el-table-column prop="triggerStatus" :label="t('triggerList.colStatus')" width="120">
          <template #default="{ row }">
            <StatusTag
              v-if="row.triggerStatus || row.status"
              :value="String(row.triggerStatus ?? row.status ?? '')"
              category="trigger"
            />
            <span v-else class="cell-empty">—</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('triggerList.colCron')" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            <code v-if="row.cronExpression" class="cell-code">{{ row.cronExpression }}</code>
            <span v-else class="cell-empty">—</span>
          </template>
        </el-table-column>
        <DatetimeColumn prop="nextFireTime" :label="t('triggerList.colNextFire')" width="160" />
        <el-table-column :label="t('triggerList.colActions')" width="280" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button
                v-if="canRegister(row)"
                size="small"
                plain
                type="primary"
                :icon="CirclePlay"
                :disabled="writesFrozen"
                v-track-click="{ action: 'register trigger', workflowCode: row.workflowCode }"
                @click="doRegister(row)"
              >
                {{ t('triggerList.actionRegister') }}
              </el-button>
              <el-button
                v-if="canUnregister(row)"
                size="small"
                plain
                type="danger"
                :icon="CircleStop"
                :disabled="writesFrozen"
                v-track-click="{ action: 'unregister trigger', workflowCode: row.workflowCode }"
                @click="doUnregister(row)"
              >
                {{ t('triggerList.actionUnregister') }}
              </el-button>
              <el-button
                v-if="canPause(row)"
                size="small"
                plain
                type="warning"
                :icon="Pause"
                :disabled="writesFrozen"
                v-track-click="{ action: 'pause trigger', workflowCode: row.workflowCode }"
                @click="doPause(row)"
              >
                {{ t('triggerList.actionPause') }}
              </el-button>
              <el-button
                v-if="canResume(row)"
                size="small"
                plain
                type="success"
                :icon="Play"
                :disabled="writesFrozen"
                v-track-click="{ action: 'resume trigger', workflowCode: row.workflowCode }"
                @click="doResume(row)"
              >
                {{ t('triggerList.actionResume') }}
              </el-button>
            </div>
          </template>
        </el-table-column>
      </ProTable>
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
  import { CirclePlay, CircleStop, Pause, Play } from '@lucide/vue'
  import { ref, computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { confirmDanger } from '@/composables/useDangerConfirm'
  import { useWriteAvailability } from '@/composables/useWriteAvailability'

  const { t, te } = useI18n({ useScope: 'global' })
  const { writesFrozen, ensureWriteAvailable } = useWriteAvailability()

  function resolveTriggerType(value?: string | null): string {
    if (!value) return '—'
    const key = `enum.triggerType.${value}`
    return te(key) ? t(key) : value
  }

  // 破坏性动作按行状态门控:未注册只显示"注册";已注册显示"注销";
  // 运行中(NORMAL/REGISTERED)才可"暂停";仅"已暂停"可"恢复"。
  function triggerStatusOf(row: Record<string, unknown>): string {
    const rawStatus = String(row.triggerStatus ?? row.status ?? '')
    return rawStatus.toUpperCase()
  }
  function canRegister(row: Record<string, unknown>): boolean {
    const s = triggerStatusOf(row)
    return !s || s === 'UNREGISTERED'
  }
  function canUnregister(row: Record<string, unknown>): boolean {
    const s = triggerStatusOf(row)
    return !!s && s !== 'UNREGISTERED'
  }
  function canPause(row: Record<string, unknown>): boolean {
    const status = triggerStatusOf(row)
    return ['NORMAL', 'REGISTERED'].includes(status)
  }
  function canResume(row: Record<string, unknown>): boolean {
    return triggerStatusOf(row) === 'PAUSED'
  }
  import {
    listTriggers,
    type TriggerStatusResponse,
    registerTrigger,
    unregisterTrigger,
    pauseTrigger,
    resumeTrigger,
  } from '@/api/triggers'
  import { toPageResult } from '@/api/adapters'
  import { useTenantStore } from '@/stores/tenant'
  import { useAppStore } from '@/stores/app'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import CopyableText from '@/components/common/CopyableText.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'

  const tenant = useTenantStore()
  const app = useAppStore()
  const triggerDegraded = computed(() => app.activeDegradationSources.includes('trigger'))
  const loading = ref(false)
  const loadError = ref<unknown>(null)
  const { filterBusy, tableBlocking, runSearch, runReset, runRefresh } =
    useListFilterFeedback(loading)
  const allRows = ref<TriggerStatusResponse[]>([])
  const page = ref(1)
  const pageSize = ref(15)
  const kwDraft = ref('')
  const keyword = ref('')

  const filtered = computed(() => {
    const trimmedKeyword = keyword.value.trim()
    const k = trimmedKeyword.toLowerCase()
    if (!k) return allRows.value
    return allRows.value.filter((row) => {
      const workflowCodeText = String(row.workflowCode ?? '')
      const normalizedWorkflowCode = workflowCodeText.toLowerCase()
      return normalizedWorkflowCode.includes(k)
    })
  })

  const pagedRows = computed(() => toPageResult(filtered.value, page.value, pageSize.value).records)

  function onSearch() {
    return runSearch(() => {
      keyword.value = kwDraft.value
      page.value = 1
    })
  }
  function onReset() {
    return runReset(() => {
      kwDraft.value = ''
      keyword.value = ''
      page.value = 1
    })
  }

  async function load() {
    loading.value = true
    loadError.value = null
    try {
      allRows.value = await listTriggers()
    } catch (err) {
      loadError.value = err
      allRows.value = []
    } finally {
      loading.value = false
    }
  }

  async function doRegister(row: Record<string, unknown>) {
    if (!ensureWriteAvailable()) return
    try {
      const confirmVerb = t('triggerList.registerConfirmVerb')
      const workflowCode = String(row.workflowCode)
      const confirmTarget = t('triggerList.confirmTarget', { code: workflowCode })
      const confirmConsequence = t('triggerList.registerConfirmConsequence')
      const confirmButtonText = t('triggerList.registerConfirmButton')
      await confirmDanger({
        verb: confirmVerb,
        target: confirmTarget,
        consequence: confirmConsequence,
        confirmButtonText,
      })
      await registerTrigger(String(row.workflowCode), tenant.tenantId)
      ElMessage.success(t('triggerList.registerSuccess'))
      await load()
    } catch {
      /* cancel */
    }
  }

  async function doUnregister(row: Record<string, unknown>) {
    if (!ensureWriteAvailable()) return
    try {
      const confirmVerb = t('triggerList.unregisterConfirmVerb')
      const workflowCode = String(row.workflowCode)
      const confirmTarget = t('triggerList.confirmTarget', { code: workflowCode })
      const confirmConsequence = t('triggerList.unregisterConfirmConsequence')
      const confirmButtonText = t('triggerList.unregisterConfirmButton')
      await confirmDanger({
        verb: confirmVerb,
        target: confirmTarget,
        consequence: confirmConsequence,
        irreversible: true,
        confirmButtonText,
      })
      await unregisterTrigger(String(row.workflowCode), tenant.tenantId)
      ElMessage.success(t('triggerList.unregisterSuccess'))
      await load()
    } catch {
      /* cancel */
    }
  }

  async function doPause(row: Record<string, unknown>) {
    if (!ensureWriteAvailable()) return
    try {
      const confirmVerb = t('triggerList.pauseConfirmVerb')
      const workflowCode = String(row.workflowCode)
      const confirmTarget = t('triggerList.confirmTarget', { code: workflowCode })
      const confirmConsequence = t('triggerList.pauseConfirmConsequence')
      const confirmButtonText = t('triggerList.pauseConfirmButton')
      await confirmDanger({
        verb: confirmVerb,
        target: confirmTarget,
        consequence: confirmConsequence,
        confirmButtonText,
      })
      await pauseTrigger(String(row.workflowCode), tenant.tenantId)
      ElMessage.success(t('triggerList.pauseSuccess'))
      await load()
    } catch {
      /* cancel */
    }
  }

  async function doResume(row: Record<string, unknown>) {
    if (!ensureWriteAvailable()) return
    try {
      await resumeTrigger(String(row.workflowCode), tenant.tenantId)
      ElMessage.success(t('triggerList.resumeSuccess'))
      await load()
    } catch {
      /* cancel */
    }
  }

  useTenantReload(load)
</script>

<style scoped></style>
