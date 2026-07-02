<template>
  <PageContainer>
    <PageHeader />

    <div>
      <ProTable
        :data="pagedRows"
        :loading="tableBlocking"
        :error="loadError"
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
            <el-form-item :label="t('triggerList.jobCodeLabel')">
              <el-input
                class="query-w-220"
                v-model="kwDraft"
                clearable
                :placeholder="t('triggerList.jobCodePlaceholder')"
                @keyup.enter="onSearch"
              />
            </el-form-item>
          </ListPageQueryBar>
        </template>
        <el-table-column
          prop="jobCode"
          :label="t('triggerList.colJobCode')"
          min-width="180"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <CopyableText :text="String(row.jobCode ?? '')" />
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
                v-track-click="{ action: 'register trigger', jobCode: row.jobCode }"
                @click="doRegister(row)"
              >
                {{ t('triggerList.actionRegister') }}
              </el-button>
              <el-button
                v-if="canUnregister(row)"
                size="small"
                plain
                type="danger"
                v-track-click="{ action: 'unregister trigger', jobCode: row.jobCode }"
                @click="doUnregister(row)"
              >
                {{ t('triggerList.actionUnregister') }}
              </el-button>
              <el-button
                v-if="canPause(row)"
                size="small"
                plain
                type="warning"
                v-track-click="{ action: 'pause trigger', jobCode: row.jobCode }"
                @click="doPause(row)"
              >
                {{ t('triggerList.actionPause') }}
              </el-button>
              <el-button
                v-if="canResume(row)"
                size="small"
                plain
                type="success"
                v-track-click="{ action: 'resume trigger', jobCode: row.jobCode }"
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
  import { ref, computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { confirmDanger } from '@/composables/useDangerConfirm'

  const { t, te } = useI18n({ useScope: 'global' })

  function resolveTriggerType(value?: string | null): string {
    if (!value) return '—'
    const key = `enum.triggerType.${value}`
    return te(key) ? t(key) : value
  }

  // 破坏性动作按行状态门控:未注册只显示"注册";已注册显示"注销";
  // 运行中(NORMAL/REGISTERED)才可"暂停";仅"已暂停"可"恢复"。
  function triggerStatusOf(row: Record<string, unknown>): string {
    return String(row.triggerStatus ?? row.status ?? '').toUpperCase()
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
    return ['NORMAL', 'REGISTERED'].includes(triggerStatusOf(row))
  }
  function canResume(row: Record<string, unknown>): boolean {
    return triggerStatusOf(row) === 'PAUSED'
  }
  import {
    listTriggers,
    registerTrigger,
    unregisterTrigger,
    pauseTrigger,
    resumeTrigger,
  } from '@/api/triggers'
  import { toPageResult } from '@/api/adapters'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import CopyableText from '@/components/common/CopyableText.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'

  const tenant = useTenantStore()
  const loading = ref(false)
  const loadError = ref<unknown>(null)
  const { filterBusy, tableBlocking, runSearch, runReset, runRefresh } =
    useListFilterFeedback(loading)
  const allRows = ref<Record<string, unknown>[]>([])
  const page = ref(1)
  const pageSize = ref(15)
  const kwDraft = ref('')
  const keyword = ref('')

  const filtered = computed(() => {
    const k = keyword.value.trim().toLowerCase()
    if (!k) return allRows.value
    return allRows.value.filter((r) =>
      String(r.jobCode ?? '')
        .toLowerCase()
        .includes(k),
    )
  })

  const pagedRows = computed(
    () =>
      toPageResult(filtered.value, page.value, pageSize.value).records as unknown as Record<
        string,
        unknown
      >[],
  )

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
      allRows.value = (await listTriggers(tenant.tenantId)) as Record<string, unknown>[]
    } catch (err) {
      loadError.value = err
      allRows.value = []
    } finally {
      loading.value = false
    }
  }

  async function doRegister(row: Record<string, unknown>) {
    try {
      await confirmDanger({
        verb: t('triggerList.registerConfirmVerb'),
        target: t('triggerList.confirmTarget', { code: String(row.jobCode) }),
        consequence: t('triggerList.registerConfirmConsequence'),
        confirmButtonText: t('triggerList.registerConfirmButton'),
      })
      await registerTrigger(String(row.jobCode), tenant.tenantId)
      ElMessage.success(t('triggerList.registerSuccess'))
      await load()
    } catch {
      /* cancel */
    }
  }

  async function doUnregister(row: Record<string, unknown>) {
    try {
      await confirmDanger({
        verb: t('triggerList.unregisterConfirmVerb'),
        target: t('triggerList.confirmTarget', { code: String(row.jobCode) }),
        consequence: t('triggerList.unregisterConfirmConsequence'),
        irreversible: true,
        confirmButtonText: t('triggerList.unregisterConfirmButton'),
      })
      await unregisterTrigger(String(row.jobCode), tenant.tenantId)
      ElMessage.success(t('triggerList.unregisterSuccess'))
      await load()
    } catch {
      /* cancel */
    }
  }

  async function doPause(row: Record<string, unknown>) {
    try {
      await confirmDanger({
        verb: t('triggerList.pauseConfirmVerb'),
        target: t('triggerList.confirmTarget', { code: String(row.jobCode) }),
        consequence: t('triggerList.pauseConfirmConsequence'),
        confirmButtonText: t('triggerList.pauseConfirmButton'),
      })
      await pauseTrigger(String(row.jobCode), tenant.tenantId)
      ElMessage.success(t('triggerList.pauseSuccess'))
      await load()
    } catch {
      /* cancel */
    }
  }

  async function doResume(row: Record<string, unknown>) {
    try {
      await resumeTrigger(String(row.jobCode), tenant.tenantId)
      ElMessage.success(t('triggerList.resumeSuccess'))
      await load()
    } catch {
      /* cancel */
    }
  }

  useTenantReload(load)
</script>

<style scoped></style>
