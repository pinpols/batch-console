<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button type="primary" :icon="Plus" @click="onCreateClick">
          {{ activeCreateLabel }}
        </el-button>
      </template>
    </PageHeader>

    <SectionCard>
      <el-tabs
        v-model="activeTab"
        class="pill-tabs file-config-tabs"
        :class="{ 'single-mode': mode !== 'all' }"
      >
        <!-- el-tab-pane 不能用 v-if(EP unmount bug panes.indexOf undefined);用 v-show 防崩 -->
        <el-tab-pane
          v-show="showTemplatesTab"
          :label="t('fileTemplateList.tabTemplates')"
          name="templates"
        >
          <div class="panel-head">
            <div class="panel-title">
              <span class="dot dot--primary" />
              {{ t('fileTemplateList.sectionTemplates') }}
            </div>
          </div>
          <ProTable
            :data="rows"
            :loading="tableBlocking"
            :total="total"
            v-model:page="page"
            v-model:page-size="pageSize"
            @change="load"
            :error="loadError"
            :on-retry="load"
          >
            <template #query>
              <ListPageQueryBar
                :filter-busy="queryActionBusy"
                :refresh-busy="loading"
                :disabled="loading"
                @search="onSearch"
                @reset="reset"
                @refresh="() => runRefresh(load)"
              >
                <el-form-item :label="t('fileTemplateList.codeLabel')">
                  <el-input
                    v-model="keyword"
                    clearable
                    :placeholder="t('fileTemplateList.codePlaceholder')"
                  />
                </el-form-item>
                <el-form-item :label="t('fileTemplateList.typeLabel')">
                  <MetaSelect
                    class="query-w-160"
                    v-model="templateType"
                    :options="templateTypeOptions"
                    clearable
                    filterable
                    enum-key="fileTemplateType"
                    :placeholder="t('fileTemplateList.typePlaceholder')"
                  />
                </el-form-item>
                <el-form-item :label="t('fileTemplateList.bizTypeLabel')">
                  <MetaSelect
                    class="query-w-160"
                    v-model="bizType"
                    :options="bizTypeOptions"
                    clearable
                    filterable
                    :placeholder="t('fileTemplateList.bizTypePlaceholder')"
                  />
                </el-form-item>
                <el-form-item :label="t('fileTemplateList.enabledLabel')">
                  <el-select
                    v-model="enabled"
                    clearable
                    :placeholder="t('fileTemplateList.enabledPlaceholder')"
                    class="query-w-120"
                  >
                    <el-option :label="t('fileTemplateList.optEnabled')" :value="true" />
                    <el-option :label="t('fileTemplateList.optDisabled')" :value="false" />
                  </el-select>
                </el-form-item>
              </ListPageQueryBar>
            </template>

            <el-table-column
              prop="templateCode"
              :label="t('fileTemplateList.colCode')"
              width="220"
              show-overflow-tooltip
            />
            <el-table-column
              prop="templateName"
              :label="t('fileTemplateList.colName')"
              min-width="260"
              show-overflow-tooltip
            />
            <el-table-column prop="templateType" :label="t('fileTemplateList.colType')" width="120">
              <template #default="{ row }">
                {{ resolveEnumLabel('fileTemplateType', row.templateType) }}
              </template>
            </el-table-column>
            <el-table-column
              prop="fileFormatType"
              :label="t('fileTemplateList.colFormat')"
              width="120"
            >
              <template #default="{ row }">
                {{ resolveEnumLabel('fileTemplateFormat', row.fileFormatType) }}
              </template>
            </el-table-column>
            <el-table-column prop="bizType" :label="t('fileTemplateList.colBizType')" width="120" />
            <el-table-column prop="version" :label="t('fileTemplateList.colVersion')" width="90" />
            <el-table-column :label="t('fileTemplateList.colEnabled')" width="90">
              <template #default="{ row }">
                <el-switch
                  :model-value="row.enabled"
                  inline-prompt
                  :active-text="t('fileTemplateList.switchOn')"
                  :inactive-text="t('fileTemplateList.switchOff')"
                  :loading="togglingTemplateId === row.id"
                  @change="toggleTemplate(row)"
                />
              </template>
            </el-table-column>
            <DatetimeColumn
              prop="updatedAt"
              :label="t('fileTemplateList.colUpdatedAt')"
              width="180"
            />
            <el-table-column :label="t('fileTemplateList.colActions')" width="180" fixed="right">
              <template #default="{ row }">
                <RowActions :actions="templateRowActions(row)" :inline-limit="2" />
              </template>
            </el-table-column>
          </ProTable>
        </el-tab-pane>

        <el-tab-pane
          v-show="showChannelsTab"
          :label="t('fileTemplateList.tabChannels')"
          name="channels"
        >
          <div class="panel-head">
            <div class="panel-title">
              <span class="dot dot--success" />
              {{ t('fileTemplateList.sectionChannels') }}
            </div>
          </div>
          <ListPageQueryBar
            class="query"
            :filter-busy="queryActionBusy"
            :refresh-busy="loading"
            :disabled="loading"
            @search="onChannelSearch"
            @reset="resetChannels"
            @refresh="() => runRefresh(loadChannels)"
          >
            <el-form-item :label="t('fileTemplateList.channelKeywordLabel')">
              <el-input
                v-model="channelKeyword"
                clearable
                :placeholder="t('fileTemplateList.channelKeywordPlaceholder')"
                class="query__search"
              />
            </el-form-item>
            <el-form-item :label="t('fileTemplateList.enabledLabel')">
              <el-select
                v-model="channelEnabled"
                clearable
                class="query-w-120"
                :placeholder="t('fileTemplateList.enabledPlaceholder')"
              >
                <el-option :label="t('fileTemplateList.optEnabled')" :value="true" />
                <el-option :label="t('fileTemplateList.optDisabled')" :value="false" />
              </el-select>
            </el-form-item>
          </ListPageQueryBar>
          <el-table
            v-loading="loading"
            :data="channelRows"
            stripe
            border
            size="small"
            highlight-current-row
            :empty-text="t('common.noData')"
            class="console-table"
          >
            <el-table-column
              prop="channelCode"
              :label="t('fileTemplateList.colChannelCode')"
              width="220"
              show-overflow-tooltip
            />
            <el-table-column
              prop="channelName"
              :label="t('fileTemplateList.colChannelName')"
              min-width="240"
              show-overflow-tooltip
            />
            <el-table-column
              prop="channelType"
              :label="t('fileTemplateList.colChannelType')"
              width="130"
            />
            <el-table-column
              prop="targetEndpoint"
              :label="t('fileTemplateList.colTargetEndpoint')"
              min-width="320"
              show-overflow-tooltip
            />
            <el-table-column
              prop="authType"
              :label="t('fileTemplateList.colAuthType')"
              width="120"
            />
            <el-table-column
              prop="receiptPolicy"
              :label="t('fileTemplateList.colReceiptPolicy')"
              width="140"
            />
            <el-table-column :label="t('fileTemplateList.colEnabled')" width="110">
              <template #default="{ row }">
                <el-switch
                  :model-value="row.enabled"
                  inline-prompt
                  :active-text="t('fileTemplateList.switchOn')"
                  :inactive-text="t('fileTemplateList.switchOff')"
                  :loading="togglingChannelId === row.id"
                  @change="toggleChannel(row)"
                />
              </template>
            </el-table-column>
            <DatetimeColumn
              prop="updatedAt"
              :label="t('fileTemplateList.colUpdatedAt')"
              width="180"
            />
            <el-table-column :label="t('fileTemplateList.colActions')" width="120" fixed="right">
              <template #default="{ row }">
                <el-button
                  type="primary"
                  plain
                  size="small"
                  :icon="Edit"
                  @click="openChannelEdit(row)"
                >
                  {{ t('common.edit') }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </SectionCard>

    <el-drawer
      :append-to-body="true"
      v-model="detailVisible"
      :title="t('fileTemplateList.detailTitle')"
      size="800px"
    >
      <el-descriptions v-if="detail" :column="2" border size="small">
        <el-descriptions-item :label="t('fileTemplateList.descTemplateCode')">{{
          detail.templateCode
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('fileTemplateList.descTemplateName')">{{
          detail.templateName
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('fileTemplateList.descTemplateType')">{{
          detail.templateType
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('fileTemplateList.descFileFormatType')">{{
          detail.fileFormatType
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('fileTemplateList.descBizType')">{{
          detail.bizType
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('fileTemplateList.descVersion')">{{
          detail.version
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('fileTemplateList.descCharset')">{{
          detail.charset
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('fileTemplateList.descTargetCharset')">{{
          detail.targetCharset
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('fileTemplateList.descDelimiter')">{{
          detail.delimiter || '—'
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('fileTemplateList.descLineSeparator')">{{
          detail.lineSeparator || '—'
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('fileTemplateList.descQueryParamSchema')" :span="2">
          <JsonPreview :data="detail.queryParamSchema || '—'" />
        </el-descriptions-item>
        <el-descriptions-item :label="t('fileTemplateList.descFieldMappings')" :span="2">
          <JsonPreview :data="detail.fieldMappings || '—'" />
        </el-descriptions-item>
        <el-descriptions-item :label="t('fileTemplateList.descDescription')" :span="2">
          <JsonPreview :data="detail.description || '—'" />
        </el-descriptions-item>
      </el-descriptions>
    </el-drawer>

    <el-drawer
      :append-to-body="true"
      v-model="templateDialogVisible"
      :title="
        templateEditingId == null
          ? t('fileTemplateList.templateCreateTitle')
          : t('fileTemplateList.templateEditTitle')
      "
      direction="rtl"
      size="800px"
      destroy-on-close
    >
      <el-form :model="templateForm" label-width="120px">
        <el-form-item :label="t('fileTemplateList.fieldTemplateCode')" required>
          <el-input
            v-model="templateForm.templateCode"
            :disabled="templateEditingId != null"
            maxlength="128"
          />
        </el-form-item>
        <el-form-item :label="t('fileTemplateList.fieldTemplateName')"
          ><el-input v-model="templateForm.templateName" maxlength="256"
        /></el-form-item>
        <el-form-item :label="t('fileTemplateList.fieldTemplateType')" required
          ><MetaSelect
            v-model="templateForm.templateType"
            enum-key="fileTemplateType"
            class="query-w-full"
        /></el-form-item>
        <el-form-item :label="t('fileTemplateList.fieldBizType')"
          ><MetaSelect
            v-model="templateForm.bizType"
            :options="bizTypeOptions"
            clearable
            filterable
        /></el-form-item>
        <el-form-item :label="t('fileTemplateList.fieldFileFormatType')"
          ><MetaSelect
            v-model="templateForm.fileFormatType"
            enum-key="fileTemplateFormat"
            class="query-w-full"
            clearable
        /></el-form-item>
        <el-form-item :label="t('fileTemplateList.fieldCharset')"
          ><el-input v-model="templateForm.charset" maxlength="32"
        /></el-form-item>
        <el-form-item :label="t('fileTemplateList.fieldTargetCharset')"
          ><el-input v-model="templateForm.targetCharset" maxlength="32"
        /></el-form-item>
        <el-form-item :label="t('fileTemplateList.fieldDelimiter')"
          ><el-input v-model="templateForm.delimiter" maxlength="8"
        /></el-form-item>
        <el-form-item :label="t('fileTemplateList.fieldLineSeparator')"
          ><el-input v-model="templateForm.lineSeparator" maxlength="16"
        /></el-form-item>
        <el-form-item :label="t('fileTemplateList.fieldVersion')"
          ><el-input-number v-model="templateForm.version" :min="1"
        /></el-form-item>
        <el-form-item :label="t('fileTemplateList.fieldEnabled')"
          ><el-switch v-model="templateForm.enabled"
        /></el-form-item>
        <el-form-item :label="t('fileTemplateList.fieldFieldMappingsJson')">
          <JsonTextareaInput v-model="templateForm.fieldMappingsJson" :rows="4" />
        </el-form-item>
        <el-form-item :label="t('fileTemplateList.fieldQueryParamSchemaJson')">
          <JsonTextareaInput v-model="templateForm.queryParamSchemaJson" :rows="3" />
        </el-form-item>
        <el-form-item :label="t('fileTemplateList.fieldDescription')"
          ><el-input
            v-model="templateForm.description"
            type="textarea"
            maxlength="512"
            show-word-limit
        /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="templateDialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="saving" @click="saveTemplate">{{
          t('common.save')
        }}</el-button>
      </template>
    </el-drawer>

    <el-drawer
      :append-to-body="true"
      v-model="channelDialogVisible"
      :title="
        channelEditingId == null
          ? t('fileTemplateList.channelCreateTitle')
          : t('fileTemplateList.channelEditTitle')
      "
      direction="rtl"
      size="800px"
      destroy-on-close
    >
      <el-form :model="channelForm" label-width="120px">
        <el-form-item :label="t('fileTemplateList.fieldChannelCode')" required>
          <el-input
            v-model="channelForm.channelCode"
            :disabled="channelEditingId != null"
            maxlength="128"
          />
        </el-form-item>
        <el-form-item :label="t('fileTemplateList.fieldChannelName')"
          ><el-input v-model="channelForm.channelName" maxlength="256"
        /></el-form-item>
        <el-form-item :label="t('fileTemplateList.fieldChannelType')" required
          ><MetaSelect
            v-model="channelForm.channelType"
            enum-key="channelType"
            class="query-w-full"
        /></el-form-item>
        <el-form-item :label="t('fileTemplateList.fieldTargetEndpoint')"
          ><el-input v-model="channelForm.targetEndpoint" maxlength="1024"
        /></el-form-item>
        <el-form-item :label="t('fileTemplateList.fieldAuthType')"
          ><MetaSelect
            v-model="channelForm.authType"
            enum-key="authType"
            class="query-w-full"
            clearable
        /></el-form-item>
        <el-form-item :label="t('fileTemplateList.fieldReceiptPolicy')"
          ><MetaSelect
            v-model="channelForm.receiptPolicy"
            enum-key="receiptPolicy"
            class="query-w-full"
            clearable
        /></el-form-item>
        <el-form-item :label="t('fileTemplateList.fieldTimeoutSeconds')"
          ><el-input-number v-model="channelForm.timeoutSeconds" :min="0" :max="2147483647"
        /></el-form-item>
        <el-form-item :label="t('fileTemplateList.fieldEnabled')"
          ><el-switch v-model="channelForm.enabled"
        /></el-form-item>
        <el-form-item :label="t('fileTemplateList.fieldConfigJson')">
          <JsonTextareaInput v-model="channelForm.configJson" :rows="5" expect="object" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="channelDialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="saving" @click="saveChannel">{{
          t('common.save')
        }}</el-button>
      </template>
    </el-drawer>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { Edit, Plus, View } from '@element-plus/icons-vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'

  const { t, te } = useI18n({ useScope: 'global' })
  // P2 IA 拆分:route.meta.mode 限定本页只显示某一类资源,实现两条路由共用一个组件
  // 'templates' | 'channels' — 缺省视为单 tab 模式;不传则两个 tab 全显示(兼容老入口)
  const route = useRoute()
  const mode = computed<'templates' | 'channels' | 'all'>(
    () => (route.meta?.mode as 'templates' | 'channels' | undefined) ?? 'all',
  )
  const showTemplatesTab = computed(() => mode.value === 'all' || mode.value === 'templates')
  const showChannelsTab = computed(() => mode.value === 'all' || mode.value === 'channels')

  function resolveEnumLabel(group: string, value?: string | null): string {
    if (!value) return ''
    const key = `enum.${group}.${value}`
    return te(key) ? t(key) : value
  }
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import { getMetaBizTypes, type MetaOption } from '@/api/meta'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import {
    createFileChannel,
    createFileTemplate,
    listFileChannels,
    listFileTemplates,
    queryFileTemplateDetail,
    toggleFileChannel,
    toggleFileTemplate,
    updateFileChannel,
    updateFileTemplate,
    type FileChannelSavePayload,
    type FileTemplateSavePayload,
  } from '@/api/system'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'
  import JsonTextareaInput from '@/components/common/JsonTextareaInput.vue'
  import RowActions, { type RowAction } from '@/components/common/RowActions.vue'
  import type { ConsoleFileChannelResponse, ConsoleFileTemplateResponse } from '@/types/console-api'

  const tenant = useTenantStore()
  const loading = ref(false)
  const loadError = ref<unknown>(null)
  const {
    filterBusy: queryActionBusy,
    runRefresh,
    tableBlocking,
    runSearch,
    runReset,
  } = useListFilterFeedback(loading)
  const detailVisible = ref(false)
  const templateDialogVisible = ref(false)
  const channelDialogVisible = ref(false)
  const templateEditingId = ref<number | null>(null)
  const channelEditingId = ref<number | null>(null)
  const saving = ref(false)
  const togglingTemplateId = ref<number | null>(null)
  const togglingChannelId = ref<number | null>(null)
  const activeTab = ref<'templates' | 'channels'>(
    mode.value === 'channels' ? 'channels' : 'templates',
  )

  // PageHeader 右上"新建"按钮按当前 tab 切换文案与动作
  const activeCreateLabel = computed(() =>
    activeTab.value === 'templates'
      ? t('fileTemplateList.actionCreateTemplate')
      : t('fileTemplateList.actionCreateChannel'),
  )
  function onCreateClick() {
    if (activeTab.value === 'templates') openTemplateCreate()
    else openChannelCreate()
  }
  const detail = ref<ConsoleFileTemplateResponse | null>(null)
  const allRows = ref<ConsoleFileTemplateResponse[]>([])
  const rows = ref<ConsoleFileTemplateResponse[]>([])
  const allChannelRows = ref<ConsoleFileChannelResponse[]>([])
  const channelRows = ref<ConsoleFileChannelResponse[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(20)
  const keyword = ref('')
  const templateType = ref('')
  const bizType = ref('')
  const enabled = ref<boolean | undefined>()
  const channelKeyword = ref('')
  const channelEnabled = ref<boolean | undefined>()

  const templateForm = reactive({
    templateCode: '',
    templateName: '',
    templateType: 'EXPORT',
    bizType: '',
    fileFormatType: 'CSV',
    charset: 'UTF-8',
    targetCharset: 'UTF-8',
    delimiter: ',',
    lineSeparator: '\\n',
    fieldMappingsJson: '',
    queryParamSchemaJson: '',
    enabled: true,
    version: 1,
    description: '',
  })

  const channelForm = reactive({
    channelCode: '',
    channelName: '',
    channelType: 'SFTP',
    targetEndpoint: '',
    authType: 'NONE',
    configJson: '',
    receiptPolicy: '',
    timeoutSeconds: 30,
    enabled: true,
  })

  function optionalText(value: string) {
    const text = value.trim()
    return text ? text : undefined
  }

  function requireText(value: string, label: string) {
    const text = value.trim()
    if (!text) throw new Error(`${label} 必填`)
    return text
  }

  function handleValidationError(err: unknown) {
    if (err instanceof Error) ElMessage.warning(err.message)
  }
  // templateType 走后端 enum(完整候选);未到达时 fallback 到 rows 派生
  const { data: metaEnums } = useConsoleMetaEnumsQuery()
  const templateTypeOptions = computed(() => {
    const fromEnum = pickMetaEnumGroup(metaEnums.value, 'fileTemplateType')
    if (fromEnum.length > 0) return fromEnum
    return Array.from(
      new Set(
        allRows.value.map((row) => row.templateType).filter((item): item is string => !!item),
      ),
    ).map((v) => ({ value: v, label: v }))
  })
  // bizType 是租户级业务字典(独立 API),进页面 + 切租户时拉
  const bizTypeOptions = ref<MetaOption[]>([])
  async function loadBizTypes() {
    try {
      bizTypeOptions.value = await getMetaBizTypes(tenant.tenantId)
    } catch {
      bizTypeOptions.value = []
    }
  }

  const filtered = computed(() => {
    const k = keyword.value.trim().toLowerCase()
    return allRows.value.filter((row) => {
      if (
        k &&
        !`${row.templateCode} ${row.templateName} ${row.templateType}`.toLowerCase().includes(k)
      ) {
        return false
      }
      if (templateType.value.trim() && !row.templateType?.includes(templateType.value.trim())) {
        return false
      }
      if (bizType.value.trim() && !row.bizType?.includes(bizType.value.trim())) {
        return false
      }
      if (enabled.value != null && row.enabled !== enabled.value) return false
      return true
    })
  })

  function syncPage() {
    const start = (page.value - 1) * pageSize.value
    total.value = filtered.value.length
    rows.value = filtered.value.slice(start, start + pageSize.value)
  }

  async function load() {
    loading.value = true
    loadError.value = null
    try {
      allRows.value = await listFileTemplates(tenant.tenantId)
      syncPage()
    } catch (err) {
      loadError.value = err
      throw err
    } finally {
      loading.value = false
    }
  }

  function syncChannelRows() {
    const k = channelKeyword.value.trim().toLowerCase()
    channelRows.value = allChannelRows.value.filter((row) => {
      if (
        k &&
        !`${row.channelCode ?? ''} ${row.channelName ?? ''} ${row.channelType ?? ''}`
          .toLowerCase()
          .includes(k)
      ) {
        return false
      }
      if (channelEnabled.value != null && row.enabled !== channelEnabled.value) return false
      return true
    })
  }

  async function loadChannels() {
    loading.value = true
    try {
      allChannelRows.value = await listFileChannels(tenant.tenantId)
      syncChannelRows()
    } finally {
      loading.value = false
    }
  }

  async function openDetail(row: ConsoleFileTemplateResponse) {
    // 防御:BE 返回的 row 字段可能全为 null(数据坏 / schema drift / 权限过滤);
    // 不带 templateCode 直接 fetch 会 GET /file-templates/undefined → 404 报错
    if (!row?.templateCode) {
      ElMessage.warning(t('fileTemplateList.detailUnavailable'))
      return
    }
    detail.value = await queryFileTemplateDetail(tenant.tenantId, row.templateCode)
    detailVisible.value = true
  }

  function templateRowActions(row: ConsoleFileTemplateResponse): RowAction[] {
    return [
      {
        key: 'edit',
        label: t('common.edit'),
        primary: true,
        onClick: () => openTemplateEdit(row),
      },
      {
        key: 'detail',
        label: t('fileTemplateList.actionDetail'),
        onClick: () => openDetail(row),
      },
    ]
  }

  function openTemplateCreate() {
    templateEditingId.value = null
    Object.assign(templateForm, {
      templateCode: '',
      templateName: '',
      templateType: 'EXPORT',
      bizType: '',
      fileFormatType: 'CSV',
      charset: 'UTF-8',
      targetCharset: 'UTF-8',
      delimiter: ',',
      lineSeparator: '\\n',
      fieldMappingsJson: '',
      queryParamSchemaJson: '',
      enabled: true,
      version: 1,
      description: '',
    })
    templateDialogVisible.value = true
  }

  function openTemplateEdit(row: ConsoleFileTemplateResponse) {
    templateEditingId.value = row.id
    Object.assign(templateForm, {
      templateCode: row.templateCode ?? '',
      templateName: row.templateName ?? '',
      templateType: row.templateType ?? 'EXPORT',
      bizType: row.bizType ?? '',
      fileFormatType: row.fileFormatType ?? 'CSV',
      charset: row.charset ?? 'UTF-8',
      targetCharset: row.targetCharset ?? 'UTF-8',
      delimiter: row.delimiter ?? ',',
      lineSeparator: row.lineSeparator ?? '\\n',
      fieldMappingsJson: row.fieldMappings ?? '',
      queryParamSchemaJson: row.queryParamSchema ?? '',
      enabled: row.enabled ?? true,
      version: row.version ?? 1,
      description: row.description ?? '',
    })
    templateDialogVisible.value = true
  }

  function buildTemplatePayload(): FileTemplateSavePayload {
    return {
      tenantId: tenant.tenantId,
      ...(templateEditingId.value == null
        ? { templateCode: requireText(templateForm.templateCode, 'templateCode') }
        : {}),
      templateName: optionalText(templateForm.templateName),
      templateType: requireText(templateForm.templateType, 'templateType'),
      bizType: optionalText(templateForm.bizType),
      fileFormatType: optionalText(templateForm.fileFormatType),
      charset: optionalText(templateForm.charset),
      targetCharset: optionalText(templateForm.targetCharset),
      delimiter: optionalText(templateForm.delimiter),
      lineSeparator: optionalText(templateForm.lineSeparator),
      fieldMappingsJson: optionalText(templateForm.fieldMappingsJson),
      queryParamSchemaJson: optionalText(templateForm.queryParamSchemaJson),
      enabled: templateForm.enabled,
      version: templateForm.version,
      description: optionalText(templateForm.description),
    }
  }

  async function saveTemplate() {
    saving.value = true
    try {
      const payload = buildTemplatePayload()
      if (templateEditingId.value == null) await createFileTemplate(payload)
      else await updateFileTemplate(templateEditingId.value, payload)
      ElMessage.success(t('fileTemplateList.saveSuccess'))
      templateDialogVisible.value = false
      await load()
    } catch (err) {
      handleValidationError(err)
    } finally {
      saving.value = false
    }
  }

  async function toggleTemplate(row: ConsoleFileTemplateResponse) {
    togglingTemplateId.value = row.id
    try {
      await toggleFileTemplate(row.id, row.tenantId ?? tenant.tenantId, !row.enabled)
      row.enabled = !row.enabled
      ElMessage.success(t('fileTemplateList.saveSuccess'))
    } finally {
      togglingTemplateId.value = null
    }
  }

  function openChannelCreate() {
    channelEditingId.value = null
    Object.assign(channelForm, {
      channelCode: '',
      channelName: '',
      channelType: 'SFTP',
      targetEndpoint: '',
      authType: 'NONE',
      configJson: '',
      receiptPolicy: '',
      timeoutSeconds: 30,
      enabled: true,
    })
    channelDialogVisible.value = true
  }

  function openChannelEdit(row: ConsoleFileChannelResponse) {
    channelEditingId.value = row.id
    Object.assign(channelForm, {
      channelCode: row.channelCode ?? '',
      channelName: row.channelName ?? '',
      channelType: row.channelType ?? 'SFTP',
      targetEndpoint: row.targetEndpoint ?? '',
      authType: row.authType ?? 'NONE',
      configJson: row.configJson ?? '',
      receiptPolicy: row.receiptPolicy ?? '',
      timeoutSeconds: row.timeoutSeconds ?? 30,
      enabled: row.enabled ?? true,
    })
    channelDialogVisible.value = true
  }

  function buildChannelPayload(): FileChannelSavePayload {
    return {
      tenantId: tenant.tenantId,
      ...(channelEditingId.value == null
        ? { channelCode: requireText(channelForm.channelCode, 'channelCode') }
        : {}),
      channelName: optionalText(channelForm.channelName),
      channelType: requireText(channelForm.channelType, 'channelType'),
      targetEndpoint: optionalText(channelForm.targetEndpoint),
      authType: optionalText(channelForm.authType),
      configJson: optionalText(channelForm.configJson),
      receiptPolicy: optionalText(channelForm.receiptPolicy),
      timeoutSeconds: channelForm.timeoutSeconds,
      enabled: channelForm.enabled,
    }
  }

  async function saveChannel() {
    saving.value = true
    try {
      const payload = buildChannelPayload()
      if (channelEditingId.value == null) await createFileChannel(payload)
      else await updateFileChannel(channelEditingId.value, payload)
      ElMessage.success(t('fileTemplateList.saveSuccess'))
      channelDialogVisible.value = false
      await loadChannels()
    } catch (err) {
      handleValidationError(err)
    } finally {
      saving.value = false
    }
  }

  async function toggleChannel(row: ConsoleFileChannelResponse) {
    togglingChannelId.value = row.id
    try {
      await toggleFileChannel(row.id, row.tenantId ?? tenant.tenantId, !row.enabled)
      row.enabled = !row.enabled
      ElMessage.success(t('fileTemplateList.saveSuccess'))
    } finally {
      togglingChannelId.value = null
    }
  }

  function onChannelSearch() {
    return runSearch(syncChannelRows)
  }

  function resetChannels() {
    return runReset(() => {
      channelKeyword.value = ''
      channelEnabled.value = undefined
      syncChannelRows()
    })
  }

  function onSearch() {
    return runSearch(() => {
      page.value = 1
      syncPage()
    })
  }

  function reset() {
    return runReset(() => {
      keyword.value = ''
      templateType.value = ''
      bizType.value = ''
      enabled.value = undefined
      page.value = 1
      syncPage()
    })
  }

  watch([page, pageSize], syncPage)
  watch(activeTab, (tab) => {
    if (tab === 'channels' && allChannelRows.value.length === 0) void loadChannels()
  })

  useTenantReload(() => {
    void load()
    void loadChannels()
    void loadBizTypes()
  })
</script>

<style scoped>
  .file-config-tabs :deep(.el-tabs__content) {
    overflow: visible;
  }

  /* P2 单模式路由(/files/templates 或 /files/channels):隐藏 tab 头,
     用户从侧栏菜单进入相应路由后直接看到内容,无需多看一层 tab */
  .file-config-tabs.single-mode :deep(.el-tabs__header) {
    display: none;
  }

  .panel-head {
    margin-bottom: var(--space-sm);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    flex-wrap: wrap;
  }

  .panel-title {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-md);
    font-weight: 700;
    color: var(--color-text-primary);
    line-height: var(--line-height-tight);
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: var(--radius-content);
  }

  .dot--primary {
    background: var(--color-primary);
  }

  .dot--success {
    background: var(--color-success);
  }

  .query {
    margin-bottom: var(--page-block-gap);
  }

  .query__search {
    width: min(360px, 100%);
  }
</style>
