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
    >
      <template #query>
        <ListPageQueryBar
          :filter-busy="filterBusy"
          :refresh-busy="loadingChannels"
          @search="applyChannelFilter"
          @reset="resetChannelFilter"
          @refresh="() => runRefresh(loadChannels)"
        >
          <template #prepend>
            <el-button
              type="primary"
              :icon="Plus"
              class="pretty-add-button"
              v-track-click="'新增通知渠道'"
              @click="openChannelCreate"
              >新增</el-button
            >
          </template>
          <el-form-item label="关键字">
            <el-input
              class="query-w-220"
              v-model="channelFilterDraft.keyword"
              clearable
              placeholder="搜索编码/名称"
              @keyup.enter="applyChannelFilter"
            />
          </el-form-item>
          <el-form-item label="启用">
            <el-select
              class="query-w-140"
              v-model="channelFilterDraft.enabled"
              clearable
              placeholder="全部"
            >
              <el-option label="已启用" :value="true" />
              <el-option label="已停用" :value="false" />
            </el-select>
          </el-form-item>
        </ListPageQueryBar>
      </template>
      <el-table-column prop="channelCode" label="渠道编码" width="160" />
      <el-table-column prop="channelName" label="渠道名称" min-width="160" show-overflow-tooltip />
      <el-table-column prop="channelType" label="类型" width="120">
        <template #default="{ row }">
          <StatusTag
            v-if="row.channelType"
            :value="String(row.channelType)"
            category="channelType"
          />
          <span v-else class="cell-empty">—</span>
        </template>
      </el-table-column>
      <el-table-column prop="enabled" label="启用" width="80">
        <template #default="{ row }">
          <StatusTag :value="String(row.enabled)" category="yn" />
        </template>
      </el-table-column>
      <DatetimeColumn prop="createdAt" label="创建时间" width="160" />
      <el-table-column label="操作" width="260" fixed="right">
        <template #default="{ row }">
          <div class="table-actions">
            <el-button size="small" plain type="primary" @click="openChannelEdit(row)"
              >编辑</el-button
            >
            <el-button
              size="small"
              plain
              v-track-click="{ action: '测试通知渠道', code: row.channelCode }"
              @click="testChannel(row)"
              >测试</el-button
            >
            <el-button
              size="small"
              plain
              type="danger"
              v-track-click="{ action: '删除通知渠道', code: row.channelCode }"
              @click="confirmDeleteChannel(row)"
              >删除</el-button
            >
          </div>
        </template>
      </el-table-column>
    </ProTable>

    <el-dialog
      v-model="channelFormVisible"
      :title="channelEditingCode ? '编辑渠道' : '新增渠道'"
      width="560px"
    >
      <el-form label-width="100px">
        <el-form-item label="编码">
          <el-input
            v-model="channelForm.channelCode"
            :disabled="!!channelEditingCode"
            placeholder="唯一编码，如 ops-email"
          />
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="channelForm.channelName" placeholder="渠道名称" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="channelForm.channelType" placeholder="选择类型" class="query-w-full">
            <el-option
              v-for="opt in channelTypeOptions"
              :key="opt.value"
              :label="`${opt.label} (${opt.value})`"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="配置">
          <el-input
            v-model="channelForm.config"
            type="textarea"
            :rows="4"
            placeholder='JSON 配置，如 {"url":"..."}'
          />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="channelForm.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="channelFormVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingChannel" @click="saveChannel">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Plus } from '@element-plus/icons-vue'
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
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import DatetimeColumn from '@/components/common/DatetimeColumn.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useListLoadState } from '@/composables/useListLoadState'

  const tenant = useTenantStore()
  const { data: metaEnums } = useConsoleMetaEnumsQuery()
  const channelTypeOptions = computed(() => pickMetaEnumGroup(metaEnums.value, 'channelType'))

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
  const channelPageSize = ref(20)
  const channelFilterDraft = reactive({ keyword: '', enabled: undefined as boolean | undefined })
  const channelFilterApplied = reactive({ keyword: '', enabled: undefined as boolean | undefined })
  const channelForm = reactive({
    channelCode: '',
    channelName: '',
    channelType: '',
    config: '',
    enabled: true,
  })

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
    if (!channelForm.channelCode.trim()) {
      ElMessage.warning('编码不能为空')
      return
    }
    if (!channelForm.channelName.trim()) {
      ElMessage.warning('名称不能为空')
      return
    }
    savingChannel.value = true
    try {
      const body = { ...channelForm }
      if (channelEditingCode.value) {
        await updateNotificationChannel(channelEditingCode.value, tenant.tenantId, body)
      } else {
        await createNotificationChannel(tenant.tenantId, body)
      }
      ElMessage.success('已保存')
      channelFormVisible.value = false
      await loadChannels()
    } finally {
      savingChannel.value = false
    }
  }

  async function testChannel(row: Record<string, unknown>) {
    try {
      await testNotificationChannel(String(row.channelCode), tenant.tenantId)
      ElMessage.success('测试消息已发送')
    } catch {
      ElMessage.error('测试发送失败')
    }
  }

  async function confirmDeleteChannel(row: Record<string, unknown>) {
    try {
      await ElMessageBox.confirm(
        `删除渠道 ${row.channelCode}（${row.channelName}）？`,
        '删除确认',
        { type: 'warning' },
      )
      await deleteNotificationChannel(String(row.channelCode), tenant.tenantId)
      ElMessage.success('已删除')
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
</script>
