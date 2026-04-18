<template>
  <PageContainer>
    <PageHeader
      title="通知与投递"
      description="通知渠道、订阅规则、Webhook 端点与投递日志。"
      :show-description="true"
    />

    <SectionCard>
      <el-tabs v-model="activeTab" v-hover-tab-activate="true" class="pill-tabs">
        <!-- Channels -->
        <el-tab-pane label="通知渠道" name="channels">
          <ProTable
            :data="pagedChannels"
            :loading="loadingChannels"
            :total="channels.length"
            v-model:page="channelPage"
            v-model:page-size="channelPageSize"
            @change="() => {}"
          >
            <template #query>
              <ListPageQueryBar
                :filter-busy="false"
                :refresh-busy="loadingChannels"
                @search="() => {}"
                @reset="() => {}"
                @refresh="loadChannels"
              >
                <template #prepend>
                  <el-button
                    type="primary"
                    v-track-click="'新增通知渠道'"
                    @click="openChannelCreate"
                    >新增渠道</el-button
                  >
                </template>
              </ListPageQueryBar>
            </template>
            <el-table-column prop="channelCode" label="渠道编码" width="160" />
            <el-table-column
              prop="channelName"
              label="渠道名称"
              min-width="160"
              show-overflow-tooltip
            />
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
        </el-tab-pane>

        <!-- Rules -->
        <el-tab-pane label="订阅规则" name="rules">
          <ProTable
            :data="pagedRules"
            :loading="loadingRules"
            :total="rules.length"
            v-model:page="rulePage"
            v-model:page-size="rulePageSize"
            @change="() => {}"
          >
            <template #query>
              <ListPageQueryBar
                :filter-busy="false"
                :refresh-busy="loadingRules"
                @search="() => {}"
                @reset="() => {}"
                @refresh="loadRules"
              >
                <template #prepend>
                  <el-button type="primary" @click="openRuleCreate">新增规则</el-button>
                </template>
              </ListPageQueryBar>
            </template>
            <el-table-column prop="ruleId" label="ID" width="80" />
            <el-table-column
              prop="ruleName"
              label="规则名称"
              min-width="160"
              show-overflow-tooltip
            />
            <el-table-column
              prop="eventTypes"
              label="事件类型"
              min-width="200"
              show-overflow-tooltip
            />
            <el-table-column prop="channelId" label="渠道 ID" width="100" />
            <el-table-column prop="enabled" label="启用" width="80">
              <template #default="{ row }">
                <StatusTag :value="String(row.enabled)" category="yn" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{ row }">
                <div class="table-actions">
                  <el-button size="small" plain type="primary" @click="openRuleEdit(row)"
                    >编辑</el-button
                  >
                  <el-button size="small" plain type="danger" @click="confirmDeleteRule(row)"
                    >删除</el-button
                  >
                </div>
              </template>
            </el-table-column>
          </ProTable>
        </el-tab-pane>

        <!-- Webhook -->
        <el-tab-pane label="Webhook" name="webhooks">
          <ProTable
            :data="pagedWebhookRows"
            :loading="loadingWebhooks"
            :total="webhookRows.length"
            v-model:page="webhookPage"
            v-model:page-size="webhookPageSize"
            @change="() => {}"
          >
            <template #query>
              <ListPageQueryBar
                :filter-busy="false"
                :refresh-busy="loadingWebhooks"
                @search="() => {}"
                @reset="() => {}"
                @refresh="loadWebhooks"
              >
                <template #prepend>
                  <el-button type="primary" @click="openWebhookCreate">新增 Webhook</el-button>
                </template>
              </ListPageQueryBar>
            </template>
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="url" label="URL" min-width="250" show-overflow-tooltip />
            <el-table-column
              prop="eventTypes"
              label="事件类型"
              min-width="160"
              show-overflow-tooltip
            />
            <el-table-column prop="enabled" label="启用" width="80">
              <template #default="{ row }">
                <StatusTag :value="String(row.enabled)" category="yn" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{ row }">
                <div class="table-actions">
                  <el-button size="small" plain type="primary" @click="openWebhookEdit(row)"
                    >编辑</el-button
                  >
                  <el-button size="small" plain @click="viewWebhookLogs(row)">投递日志</el-button>
                  <el-button size="small" plain type="danger" @click="confirmDeleteWebhook(row)"
                    >删除</el-button
                  >
                </div>
              </template>
            </el-table-column>
          </ProTable>
        </el-tab-pane>

        <!-- Delivery Logs -->
        <el-tab-pane label="投递日志" name="deliveryLogs">
          <ProTable
            :data="pagedDeliveryLogs"
            :loading="loadingLogs"
            :total="deliveryLogs.length"
            v-model:page="logPage"
            v-model:page-size="logPageSize"
            @change="() => {}"
          >
            <template #query>
              <ListPageQueryBar
                :filter-busy="false"
                :refresh-busy="loadingLogs"
                @search="() => {}"
                @reset="() => {}"
                @refresh="loadDeliveryLogs"
              />
            </template>
            <el-table-column prop="id" label="ID" width="80">
              <template #default="{ row }">{{ row.id ?? '—' }}</template>
            </el-table-column>
            <el-table-column prop="channelId" label="渠道 ID" width="100">
              <template #default="{ row }">{{ row.channelId ?? '—' }}</template>
            </el-table-column>
            <el-table-column prop="eventType" label="事件类型" width="160">
              <template #default="{ row }">{{ row.eventType || '—' }}</template>
            </el-table-column>
            <el-table-column prop="deliveryStatus" label="状态" width="100">
              <template #default="{ row }">
                <StatusTag
                  v-if="row.deliveryStatus"
                  :value="String(row.deliveryStatus)"
                  category="deliveryStatus"
                />
                <span v-else class="cell-empty">—</span>
              </template>
            </el-table-column>
            <el-table-column prop="httpStatus" label="HTTP" width="80">
              <template #default="{ row }">{{ row.httpStatus ?? '—' }}</template>
            </el-table-column>
            <el-table-column prop="responseBody" label="响应" min-width="200" show-overflow-tooltip>
              <template #default="{ row }">{{ row.responseBody || '—' }}</template>
            </el-table-column>
            <DatetimeColumn prop="createdAt" label="时间" width="160" />
          </ProTable>
        </el-tab-pane>
      </el-tabs>
    </SectionCard>

    <!-- Channel Form Dialog -->
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
          <el-select v-model="channelForm.channelType" placeholder="选择类型" style="width: 100%">
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

    <!-- Rule Form Dialog -->
    <el-dialog
      v-model="ruleFormVisible"
      :title="ruleEditingId ? '编辑规则' : '新增规则'"
      width="560px"
    >
      <el-form label-width="100px">
        <el-form-item label="名称">
          <el-input v-model="ruleForm.ruleName" placeholder="规则名称" />
        </el-form-item>
        <el-form-item label="事件类型">
          <el-input
            v-model="ruleForm.eventTypes"
            placeholder="逗号分隔，如 JOB_FAILED,JOB_TIMEOUT"
          />
        </el-form-item>
        <el-form-item label="渠道 ID">
          <el-input-number
            v-model="ruleForm.channelId"
            :min="1"
            placeholder="渠道 ID"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="ruleForm.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="ruleFormVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingRule" @click="saveRule">保存</el-button>
      </template>
    </el-dialog>
    <!-- Webhook Form Dialog -->
    <el-dialog
      v-model="webhookFormVisible"
      :title="webhookEditingId ? '编辑 Webhook' : '新增 Webhook'"
      width="560px"
    >
      <el-form label-width="100px">
        <el-form-item label="URL">
          <el-input v-model="webhookForm.url" placeholder="https://..." />
        </el-form-item>
        <el-form-item label="事件类型">
          <el-input
            v-model="webhookForm.eventTypes"
            placeholder="逗号分隔，如 JOB_COMPLETED,JOB_FAILED"
          />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="webhookForm.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="webhookFormVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingWebhook" @click="saveWebhook">保存</el-button>
      </template>
    </el-dialog>

    <!-- Webhook Delivery Log Dialog -->
    <el-dialog v-model="webhookLogVisible" title="Webhook 投递日志" width="800px">
      <el-table :data="webhookDeliveryLogs" border size="small" height="400" class="console-table">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="eventType" label="事件" width="160" />
        <el-table-column prop="httpStatus" label="HTTP" width="80" />
        <el-table-column prop="responseBody" label="响应" min-width="200" show-overflow-tooltip />
        <DatetimeColumn prop="createdAt" label="时间" width="160" />
      </el-table>
    </el-dialog>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, reactive, computed } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    listNotificationChannels,
    createNotificationChannel,
    updateNotificationChannel,
    deleteNotificationChannel,
    testNotificationChannel,
    listNotificationRules,
    createNotificationRule,
    updateNotificationRule,
    deleteNotificationRule,
    listNotificationDeliveryLogs,
  } from '@/api/notifications'
  import {
    listWebhooks,
    createWebhook,
    updateWebhook,
    deleteWebhook,
    listWebhookDeliveryLogs,
  } from '@/api/webhooks'
  import { toPageResult } from '@/api/adapters'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import ProTable from '@/components/table/ProTable.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'

  const tenant = useTenantStore()
  const activeTab = ref('channels')

  const { data: metaEnums } = useConsoleMetaEnumsQuery()

  const channelTypeOptions = computed(() => pickMetaEnumGroup(metaEnums.value, 'channelType'))

  // ── Pagination state ──
  const channelPage = ref(1)
  const channelPageSize = ref(20)
  const rulePage = ref(1)
  const rulePageSize = ref(20)
  const webhookPage = ref(1)
  const webhookPageSize = ref(20)
  const logPage = ref(1)
  const logPageSize = ref(20)

  // ── Channels ──
  const loadingChannels = ref(false)
  const savingChannel = ref(false)
  const channelFormVisible = ref(false)
  const channelEditingCode = ref<string | null>(null)
  const channels = ref<Record<string, unknown>[]>([])
  const channelForm = reactive({
    channelCode: '',
    channelName: '',
    channelType: '',
    config: '',
    enabled: true,
  })

  async function loadChannels() {
    loadingChannels.value = true
    try {
      const data = await listNotificationChannels(tenant.tenantId)
      channels.value = Array.isArray(data) ? (data as Record<string, unknown>[]) : []
    } catch {
      channels.value = []
    } finally {
      loadingChannels.value = false
    }
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

  // ── Rules ──
  const loadingRules = ref(false)
  const savingRule = ref(false)
  const ruleFormVisible = ref(false)
  const ruleEditingId = ref<number | null>(null)
  const rules = ref<Record<string, unknown>[]>([])
  const ruleForm = reactive({ ruleName: '', eventTypes: '', channelId: 1, enabled: true })

  async function loadRules() {
    loadingRules.value = true
    try {
      const data = await listNotificationRules(tenant.tenantId)
      rules.value = Array.isArray(data) ? (data as Record<string, unknown>[]) : []
    } catch {
      rules.value = []
    } finally {
      loadingRules.value = false
    }
  }

  function openRuleCreate() {
    ruleEditingId.value = null
    ruleForm.ruleName = ''
    ruleForm.eventTypes = ''
    ruleForm.channelId = 1
    ruleForm.enabled = true
    ruleFormVisible.value = true
  }

  function openRuleEdit(row: Record<string, unknown>) {
    ruleEditingId.value = Number(row.ruleId ?? row.id ?? 0) || null
    ruleForm.ruleName = String(row.ruleName ?? '')
    ruleForm.eventTypes = String(row.eventTypes ?? '')
    ruleForm.channelId = Number(row.channelId ?? 1)
    ruleForm.enabled = !!row.enabled
    ruleFormVisible.value = true
  }

  async function saveRule() {
    if (!ruleForm.ruleName.trim()) {
      ElMessage.warning('名称不能为空')
      return
    }
    savingRule.value = true
    try {
      const body = { ...ruleForm }
      if (ruleEditingId.value) {
        await updateNotificationRule(ruleEditingId.value, tenant.tenantId, body)
      } else {
        await createNotificationRule(tenant.tenantId, body)
      }
      ElMessage.success('已保存')
      ruleFormVisible.value = false
      await loadRules()
    } finally {
      savingRule.value = false
    }
  }

  async function confirmDeleteRule(row: Record<string, unknown>) {
    const ruleId = Number(row.ruleId ?? row.id ?? 0)
    try {
      await ElMessageBox.confirm(`删除规则 #${ruleId}（${row.ruleName}）？`, '删除确认', {
        type: 'warning',
      })
      await deleteNotificationRule(ruleId, tenant.tenantId)
      ElMessage.success('已删除')
      await loadRules()
    } catch {
      /* cancel */
    }
  }

  // ── Delivery Logs ──
  const loadingLogs = ref(false)
  const deliveryLogs = ref<Record<string, unknown>[]>([])

  async function loadDeliveryLogs() {
    loadingLogs.value = true
    try {
      const data = await listNotificationDeliveryLogs(tenant.tenantId)
      deliveryLogs.value = Array.isArray(data) ? (data as Record<string, unknown>[]) : []
    } catch {
      deliveryLogs.value = []
    } finally {
      loadingLogs.value = false
    }
  }

  // ── Webhooks ──
  const loadingWebhooks = ref(false)
  const savingWebhook = ref(false)
  const webhookFormVisible = ref(false)
  const webhookLogVisible = ref(false)
  const webhookEditingId = ref<number | null>(null)
  const webhookRows = ref<Record<string, unknown>[]>([])
  const webhookDeliveryLogs = ref<Record<string, unknown>[]>([])
  const webhookForm = reactive({ url: '', eventTypes: '', enabled: true })

  async function loadWebhooks() {
    loadingWebhooks.value = true
    try {
      webhookRows.value = (await listWebhooks(tenant.tenantId)) as Record<string, unknown>[]
    } catch {
      webhookRows.value = []
    } finally {
      loadingWebhooks.value = false
    }
  }

  function openWebhookCreate() {
    webhookEditingId.value = null
    webhookForm.url = ''
    webhookForm.eventTypes = ''
    webhookForm.enabled = true
    webhookFormVisible.value = true
  }

  function openWebhookEdit(row: Record<string, unknown>) {
    webhookEditingId.value = row.id as number
    webhookForm.url = String(row.url ?? '')
    webhookForm.eventTypes = String(row.eventTypes ?? '')
    webhookForm.enabled = !!row.enabled
    webhookFormVisible.value = true
  }

  async function saveWebhook() {
    savingWebhook.value = true
    try {
      const body = {
        tenantId: tenant.tenantId,
        url: webhookForm.url,
        eventTypes: webhookForm.eventTypes,
        enabled: webhookForm.enabled,
      }
      if (webhookEditingId.value) await updateWebhook(webhookEditingId.value, body)
      else await createWebhook(body)
      ElMessage.success('已保存')
      webhookFormVisible.value = false
      await loadWebhooks()
    } finally {
      savingWebhook.value = false
    }
  }

  async function confirmDeleteWebhook(row: Record<string, unknown>) {
    try {
      await ElMessageBox.confirm(`删除 Webhook #${row.id}？`, '删除确认', { type: 'warning' })
      await deleteWebhook(row.id as number, tenant.tenantId)
      ElMessage.success('已删除')
      await loadWebhooks()
    } catch {
      /* cancel */
    }
  }

  async function viewWebhookLogs(row: Record<string, unknown>) {
    webhookDeliveryLogs.value = (await listWebhookDeliveryLogs(
      tenant.tenantId,
      row.id as number,
    )) as Record<string, unknown>[]
    webhookLogVisible.value = true
  }

  // ── Paged computeds ──
  const pagedChannels = computed(
    () =>
      toPageResult(channels.value, channelPage.value, channelPageSize.value)
        .records as unknown as Record<string, unknown>[],
  )
  const pagedRules = computed(
    () =>
      toPageResult(rules.value, rulePage.value, rulePageSize.value).records as unknown as Record<
        string,
        unknown
      >[],
  )
  const pagedWebhookRows = computed(
    () =>
      toPageResult(webhookRows.value, webhookPage.value, webhookPageSize.value)
        .records as unknown as Record<string, unknown>[],
  )
  const pagedDeliveryLogs = computed(
    () =>
      toPageResult(deliveryLogs.value, logPage.value, logPageSize.value)
        .records as unknown as Record<string, unknown>[],
  )

  function loadAll() {
    void loadChannels()
    void loadRules()
    void loadWebhooks()
  }

  useTenantReload(loadAll)
</script>

<style scoped></style>
