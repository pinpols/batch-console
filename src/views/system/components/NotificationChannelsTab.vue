<template>
  <div>
    <ProTable
      :data="pagedChannels"
      :loading="loadingChannels"
      :error="loadChannelsError"
      :on-retry="loadChannels"
      :total="filteredChannels.length"
      v-model:page="channelPage"
      v-model:page-size="channelPageSize"
      @change="() => {}"
      :has-active-filters="hasActiveChannelFilters"
    >
      <template v-if="!hasActiveChannelFilters" #empty>
        <EmptyState :description="t('notificationChannelsTab.emptyDescription')" :image-size="80">
          <template #action>
            <el-button type="primary" :icon="Plus" @click="openChannelCreate">
              {{ t('notificationCommon.btnAdd') }}
            </el-button>
          </template>
        </EmptyState>
      </template>
      <template #query>
        <ListPageQueryBar
          :filter-busy="filterBusy"
          :refresh-busy="loadingChannels"
          @search="applyChannelFilter"
          @reset="resetChannelFilter"
          @refresh="() => runRefresh(loadChannels)"
        >
          <el-form-item :label="t('notificationCommon.keywordLabel')">
            <el-input
              class="query-w-220"
              v-model="channelFilterDraft.keyword"
              clearable
              :placeholder="t('notificationChannelsTab.kwPlaceholder')"
              @keyup.enter="applyChannelFilter"
            />
          </el-form-item>
          <el-form-item :label="t('notificationCommon.enabledLabel')">
            <el-select
              class="query-w-140"
              v-model="channelFilterDraft.enabled"
              clearable
              :placeholder="t('notificationCommon.allPlaceholder')"
            >
              <el-option :label="t('notificationCommon.optEnabled')" :value="true" />
              <el-option :label="t('notificationCommon.optDisabled')" :value="false" />
            </el-select>
          </el-form-item>
        </ListPageQueryBar>
      </template>
      <el-table-column
        prop="channelCode"
        :label="t('notificationChannelsTab.colCode')"
        width="160"
      />
      <el-table-column
        prop="channelName"
        :label="t('notificationChannelsTab.colName')"
        min-width="160"
        show-overflow-tooltip
      />
      <el-table-column prop="channelType" :label="t('notificationChannelsTab.colType')" width="120">
        <template #default="{ row }">
          <StatusTag
            v-if="row.channelType"
            :value="String(row.channelType)"
            category="channelType"
          />
          <span v-else class="cell-empty">—</span>
        </template>
      </el-table-column>
      <el-table-column prop="enabled" :label="t('notificationCommon.colEnabled')" width="80">
        <template #default="{ row }">
          <StatusTag :value="String(row.enabled)" category="yn" />
        </template>
      </el-table-column>
      <DatetimeColumn
        prop="createdAt"
        :label="t('notificationChannelsTab.colCreatedAt')"
        width="160"
      />
      <el-table-column :label="t('notificationCommon.colActions')" width="260" fixed="right">
        <template #default="{ row }">
          <div class="table-actions">
            <el-button size="small" plain type="primary" @click="openChannelEdit(row)">
              {{ t('notificationCommon.btnEdit') }}
            </el-button>
            <el-button
              size="small"
              plain
              v-track-click="{
                action: t('notificationChannelsTab.trackTest'),
                code: row.channelCode,
              }"
              @click="testChannel(row)"
            >
              {{ t('notificationChannelsTab.btnTest') }}
            </el-button>
            <el-button
              size="small"
              plain
              type="danger"
              v-track-click="{
                action: t('notificationChannelsTab.trackDelete'),
                code: row.channelCode,
              }"
              @click="confirmDeleteChannel(row)"
            >
              {{ t('notificationCommon.btnDelete') }}
            </el-button>
          </div>
        </template>
      </el-table-column>
    </ProTable>

    <el-drawer
      :append-to-body="true"
      v-model="channelFormVisible"
      :title="
        channelEditingCode
          ? t('notificationChannelsTab.dialogTitleEdit')
          : t('notificationChannelsTab.dialogTitleCreate')
      "
      direction="rtl"
      size="640px"
    >
      <el-form
        ref="channelFormRef"
        :model="channelForm"
        :rules="channelFormRules"
        label-width="88px"
      >
        <el-form-item :label="t('notificationChannelsTab.fieldCode')" prop="channelCode">
          <el-input
            v-model="channelForm.channelCode"
            :disabled="!!channelEditingCode"
            :placeholder="t('notificationChannelsTab.codePlaceholder')"
            maxlength="64"
          />
        </el-form-item>
        <el-form-item :label="t('notificationChannelsTab.fieldName')" prop="channelName">
          <el-input
            v-model="channelForm.channelName"
            :placeholder="t('notificationChannelsTab.namePlaceholder')"
            maxlength="128"
          />
        </el-form-item>
        <el-form-item :label="t('notificationChannelsTab.fieldType')" prop="channelType">
          <el-select
            v-model="channelForm.channelType"
            :placeholder="t('notificationChannelsTab.typePlaceholder')"
            class="query-w-full"
          >
            <el-option
              v-for="opt in channelTypeOptions"
              :key="opt.value"
              :label="`${opt.label} (${opt.value})`"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('notificationChannelsTab.fieldConfig')" prop="config">
          <el-input
            v-model="channelForm.config"
            type="textarea"
            :rows="4"
            :placeholder="t('notificationChannelsTab.configPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('notificationChannelsTab.fieldEnabled')" prop="enabled">
          <el-switch v-model="channelForm.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="channelFormVisible = false">
          {{ t('common.cancel') }}
        </el-button>
        <el-button type="primary" :loading="savingChannel" @click="saveChannel">
          {{ t('common.save') }}
        </el-button>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'

  const { t } = useI18n({ useScope: 'global' })
  import { confirmDanger } from '@/composables/useDangerConfirm'
  import type { FormRules } from 'element-plus'
  import { Plus } from '@element-plus/icons-vue'
  import { useFormValidate, rules } from '@/composables/useFormValidate'
  import {
    listNotificationChannels,
    createNotificationChannel,
    updateNotificationChannel,
    deleteNotificationChannel,
    testNotificationChannel,
  } from '@/api/notifications'
  import { toPageResult } from '@/api/adapters'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import ProTable from '@/components/table/ProTable.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import DatetimeColumn from '@/components/common/DatetimeColumn.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useListLoadState } from '@/composables/useListLoadState'

  const tenant = useTenantStore()
  const { data: metaEnums } = useConsoleMetaEnumsQuery()
  // 通知渠道用 notificationChannelType(EMAIL/FEISHU/DINGDING/SMS 等),
  // 不能用 channelType(那是文件渠道:SFTP/API/API_PUSH...)。
  const channelTypeOptions = computed(() =>
    pickMetaEnumGroup(metaEnums.value, 'notificationChannelType', 'channelType'),
  )

  const {
    loading: loadingChannels,
    error: loadChannelsError,
    run: runLoadingChannels,
  } = useListLoadState()
  const { filterBusy, runSearch, runReset, runRefresh } = useListFilterFeedback(loadingChannels)
  const savingChannel = ref(false)
  const channelFormVisible = ref(false)
  const channelEditingCode = ref<string | null>(null)
  const channels = ref<Record<string, unknown>[]>([])
  const channelPage = ref(1)
  const channelPageSize = ref(15)
  const channelFilterDraft = reactive({ keyword: '', enabled: undefined as boolean | undefined })
  const channelFilterApplied = reactive({ keyword: '', enabled: undefined as boolean | undefined })
  const hasActiveChannelFilters = computed(
    () => !!(channelFilterApplied.keyword.trim() || channelFilterApplied.enabled !== undefined),
  )
  const channelForm = reactive({
    channelCode: '',
    channelName: '',
    channelType: '',
    config: '',
    enabled: true,
  })

  const { formRef: channelFormRef, validate: validateChannelForm } = useFormValidate()
  const channelFormRules: FormRules = {
    channelCode: [
      rules.required(t('notificationChannelsTab.ruleCode')),
      rules.code(t('notificationChannelsTab.ruleCodePattern')),
      rules.maxLength(128),
    ],
    channelName: [rules.required(t('notificationChannelsTab.ruleName')), rules.maxLength(128)],
    channelType: [rules.required(t('notificationChannelsTab.ruleType'), 'change')],
  }

  async function loadChannels() {
    await runLoadingChannels(async () => {
      const data = await listNotificationChannels(tenant.tenantId)
      channels.value = Array.isArray(data) ? (data as Record<string, unknown>[]) : []
    }).catch(() => {
      channels.value = []
    })
  }

  function openChannelCreate() {
    channelEditingCode.value = null
    channelForm.channelCode = ''
    channelForm.channelName = ''
    channelForm.channelType = ''
    channelForm.config = ''
    channelForm.enabled = true
    channelFormVisible.value = true
  }

  function openChannelEdit(row: Record<string, unknown>) {
    channelEditingCode.value = String(row.channelCode ?? '')
    channelForm.channelCode = channelEditingCode.value
    channelForm.channelName = String(row.channelName ?? '')
    channelForm.channelType = String(row.channelType ?? '')
    channelForm.config = String(row.config ?? '')
    channelForm.enabled = !!row.enabled
    channelFormVisible.value = true
  }

  async function saveChannel() {
    if (!(await validateChannelForm())) return
    savingChannel.value = true
    try {
      const body = { ...channelForm }
      if (channelEditingCode.value) {
        await updateNotificationChannel(channelEditingCode.value, tenant.tenantId, body)
      } else {
        await createNotificationChannel(tenant.tenantId, body)
      }
      ElMessage.success(t('notificationCommon.savedToast'))
      channelFormVisible.value = false
      await loadChannels()
    } finally {
      savingChannel.value = false
    }
  }

  async function testChannel(row: Record<string, unknown>) {
    try {
      await testNotificationChannel(String(row.channelCode), tenant.tenantId)
      ElMessage.success(t('notificationChannelsTab.testSent'))
    } catch {
      ElMessage.error(t('notificationChannelsTab.testFailed'))
    }
  }

  async function confirmDeleteChannel(row: Record<string, unknown>) {
    try {
      await confirmDanger({
        verb: t('notificationCommon.deleteVerb'),
        target: t('notificationChannelsTab.deleteTarget', { name: row.channelName }),
        consequence: t('notificationChannelsTab.deleteConsequence'),
        irreversible: false,
      })
      await deleteNotificationChannel(String(row.channelCode), tenant.tenantId)
      ElMessage.success(t('notificationCommon.deletedToast'))
      await loadChannels()
    } catch {
      /* cancel */
    }
  }

  function normalize(s: unknown) {
    return String(s ?? '')
      .trim()
      .toLowerCase()
  }

  const filteredChannels = computed(() => {
    const k = normalize(channelFilterApplied.keyword)
    const en = channelFilterApplied.enabled
    return channels.value.filter((row) => {
      const okEnabled = en === undefined ? true : !!row.enabled === en
      if (!okEnabled) return false
      if (!k) return true
      const hay = `${row.channelCode ?? ''} ${row.channelName ?? ''}`.toLowerCase()
      return hay.includes(k)
    })
  })

  const pagedChannels = computed(
    () => toPageResult(filteredChannels.value, channelPage.value, channelPageSize.value).records,
  )

  function applyChannelFilter() {
    return runSearch(() => {
      channelFilterApplied.keyword = channelFilterDraft.keyword.trim()
      channelFilterApplied.enabled = channelFilterDraft.enabled
      channelPage.value = 1
    })
  }

  function resetChannelFilter() {
    return runReset(() => {
      channelFilterDraft.keyword = ''
      channelFilterDraft.enabled = undefined
      channelFilterApplied.keyword = ''
      channelFilterApplied.enabled = undefined
      channelPage.value = 1
    })
  }

  useTenantReload(() => {
    channelPage.value = 1
    void loadChannels()
  })

  defineExpose({ openChannelCreate })
</script>
