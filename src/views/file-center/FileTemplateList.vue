<template>
  <PageContainer v-if="canReadFileConfig">
    <PageHeader>
      <template #actions>
        <el-button
          v-if="canMutateConfig"
          type="primary"
          :icon="Plus"
          :disabled="!auth.profileLoaded"
          @click="onCreateClick"
        >
          {{ activeCreateLabel }}
        </el-button>
      </template>
    </PageHeader>

    <el-tabs
      v-model="activeTab"
      class="pill-tabs file-config-tabs"
      :class="{ 'single-mode': mode !== 'all' }"
    >
      <el-tab-pane :label="t('fileTemplateList.tabTemplates')" name="templates">
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
                  class="query-w-280"
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
                <StatusSegment
                  :model-value="templateEnabledSegment"
                  :items="enabledStatusSegmentItems"
                  :aria-label="t('fileTemplateList.enabledLabel')"
                  @update:model-value="onTemplateEnabledSegmentChange"
                />
              </el-form-item>
            </ListPageQueryBar>
          </template>

          <el-table-column prop="templateCode" :label="t('fileTemplateList.colCode')" width="220">
            <template #default="{ row }">
              <CopyableText v-if="row.templateCode" :text="row.templateCode" />
            </template>
          </el-table-column>
          <el-table-column
            prop="templateName"
            :label="t('fileTemplateList.colName')"
            min-width="260"
          >
            <template #default="{ row }">
              <CopyableText v-if="row.templateName" :text="row.templateName" />
            </template>
          </el-table-column>
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
          <el-table-column prop="bizType" :label="t('fileTemplateList.colBizType')" min-width="160">
            <template #default="{ row }">
              <CopyableText v-if="row.bizType" :text="row.bizType" />
            </template>
          </el-table-column>
          <el-table-column prop="version" :label="t('fileTemplateList.colVersion')" width="90" />
          <el-table-column :label="t('fileTemplateList.colEnabled')" width="90">
            <template #default="{ row }">
              <el-switch
                :model-value="row.enabled"
                inline-prompt
                :active-text="t('fileTemplateList.switchOn')"
                :inactive-text="t('fileTemplateList.switchOff')"
                :loading="togglingTemplateIds.has(row.id)"
                :disabled="!canMutateConfig"
                @change="toggleTemplate(row as ConsoleFileTemplateResponse)"
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
              <RowActions
                :actions="templateRowActions(row as ConsoleFileTemplateResponse)"
                :inline-limit="2"
              />
            </template>
          </el-table-column>
        </ProTable>
      </el-tab-pane>

      <el-tab-pane :label="t('fileTemplateList.tabChannels')" name="channels">
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
              class="query__search query-w-280"
              clearable
              :placeholder="t('fileTemplateList.channelKeywordPlaceholder')"
            />
          </el-form-item>
          <el-form-item :label="t('workerManagement.channelTypeLabel')">
            <MetaSelect
              v-model="channelType"
              class="query-w-160"
              clearable
              filterable
              enum-key="channelType"
              :options="channelTypeOptions"
              :placeholder="t('workerManagement.channelTypePlaceholder')"
            />
          </el-form-item>
          <el-form-item :label="t('fileTemplateList.enabledLabel')">
            <StatusSegment
              :model-value="channelEnabledSegment"
              :items="enabledStatusSegmentItems"
              :aria-label="t('fileTemplateList.enabledLabel')"
              @update:model-value="onChannelEnabledSegmentChange"
            />
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
          >
            <template #default="{ row }">
              <CopyableText v-if="row.channelCode" :text="row.channelCode" />
            </template>
          </el-table-column>
          <el-table-column
            prop="channelName"
            :label="t('fileTemplateList.colChannelName')"
            min-width="240"
          >
            <template #default="{ row }">
              <CopyableText v-if="row.channelName" :text="row.channelName" />
            </template>
          </el-table-column>
          <el-table-column
            prop="channelType"
            :label="t('fileTemplateList.colChannelType')"
            width="130"
          />
          <el-table-column
            prop="timeoutSeconds"
            :label="t('workerManagement.channelColTimeout')"
            width="100"
          />
          <el-table-column
            prop="targetEndpoint"
            :label="t('fileTemplateList.colTargetEndpoint')"
            min-width="320"
          >
            <template #default="{ row }"
              ><CopyableText v-if="row.targetEndpoint" :text="row.targetEndpoint" :copyable="false"
            /></template>
          </el-table-column>
          <el-table-column prop="authType" :label="t('fileTemplateList.colAuthType')" width="120">
            <template #default="{ row }">
              {{ resolveEnumLabel('authType', row.authType) }}
            </template>
          </el-table-column>
          <el-table-column
            prop="receiptPolicy"
            :label="t('fileTemplateList.colReceiptPolicy')"
            width="140"
          >
            <template #default="{ row }">
              {{ resolveEnumLabel('receiptPolicy', row.receiptPolicy) }}
            </template>
          </el-table-column>
          <el-table-column :label="t('fileTemplateList.colEnabled')" width="110">
            <template #default="{ row }">
              <el-switch
                :model-value="row.enabled"
                inline-prompt
                :active-text="t('fileTemplateList.switchOn')"
                :inactive-text="t('fileTemplateList.switchOff')"
                :loading="row.id != null && togglingChannelIds.has(row.id)"
                :disabled="!canMutateConfig"
                @change="toggleChannel(row)"
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
              <el-button
                size="small"
                plain
                type="primary"
                :icon="View"
                @click="openChannelDetail(row)"
              >
                {{ t('workerManagement.channelActionDetail') }}
              </el-button>
              <el-button
                v-if="canMutateConfig"
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

    <FileTemplateDetailDrawer v-model="detailVisible" :detail="detail" />

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
      <el-form :model="templateForm" label-position="top">
        <!-- 基本信息 -->
        <div class="form-section">
          <div class="section-title">{{ t('fileTemplateList.sectionBasic') }}</div>
          <el-form-item :label="t('fileTemplateList.fieldTemplateCode')" required>
            <el-input
              v-if="templateEditingId != null"
              v-model="templateForm.templateCode"
              disabled
              maxlength="128"
            />
            <!-- 新建态:CodeNameBuilder 默认 DOMAIN=IMPORT(文件模板多用于导入) -->
            <CodeNameBuilder v-else v-model="templateForm.templateCode" default-domain="IMPORT" />
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
          <el-form-item :label="t('fileTemplateList.fieldEnabled')"
            ><el-switch v-model="templateForm.enabled"
          /></el-form-item>
          <el-form-item :label="t('fileTemplateList.fieldVersion')"
            ><el-input-number v-model="templateForm.version" :min="1" :max="2147483647"
          /></el-form-item>
          <el-form-item :label="t('fileTemplateList.fieldDescription')"
            ><el-input
              v-model="templateForm.description"
              type="textarea"
              maxlength="512"
              show-word-limit
          /></el-form-item>
        </div>

        <!-- 文件格式:按所选格式渐进披露;编码等高级项默认折叠 -->
        <FileTemplateFormatFields
          v-model:file-format-type="templateForm.fileFormatType"
          v-model:delimiter="templateForm.delimiter"
          v-model:line-separator="templateForm.lineSeparator"
          v-model:charset="templateForm.charset"
          v-model:target-charset="templateForm.targetCharset"
          v-model:with-bom="templateForm.withBom"
          v-model:show-advanced="showFormatAdvanced"
        />

        <!-- 字段映射 -->
        <div class="form-section">
          <div class="section-title">{{ t('fileTemplateList.sectionMapping') }}</div>
          <MappingDraftAssistant
            v-if="
              templateEditingId == null &&
              isDelimited &&
              ['IMPORT', 'EXPORT'].includes(templateForm.templateType)
            "
            :tenant-id="tenant.tenantId"
            :direction="templateForm.templateType === 'EXPORT' ? 'EXPORT' : 'IMPORT'"
            :can-apply="
              !templateForm.fieldMappingsJson.trim() &&
              !templateForm.queryParamSchemaJson.trim() &&
              (templateForm.templateType !== 'EXPORT' || !templateForm.defaultQuerySql.trim())
            "
            @apply="applyMappingDraft"
          />
          <el-form-item :label="t('fileTemplateList.fieldFieldMappingsJson')">
            <JsonTextareaInput
              v-model="templateForm.fieldMappingsJson"
              :rows="4"
              :initialize-default="false"
            />
          </el-form-item>
          <el-form-item :label="t('fileTemplateList.fieldQueryParamSchemaJson')">
            <JsonTextareaInput
              v-model="templateForm.queryParamSchemaJson"
              :rows="3"
              :initialize-default="false"
            />
          </el-form-item>
          <el-form-item
            v-if="templateForm.templateType === 'EXPORT'"
            :label="t('fileTemplateList.fieldDefaultQuerySql')"
          >
            <el-input v-model="templateForm.defaultQuerySql" type="textarea" :rows="4" />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="templateDialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="templateSaving" @click="saveTemplate">{{
          t('common.save')
        }}</el-button>
      </template>
    </el-drawer>

    <FileChannelDrawers
      v-model:editor-visible="channelDialogVisible"
      v-model:detail-visible="channelDetailVisible"
      :form="channelForm"
      :editing-id="channelEditingId"
      :saving="channelSaving"
      :detail-row="channelDetailRow"
      @save="saveChannel"
    />
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, onScopeDispose, reactive, ref, shallowReactive, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { Pencil as Edit, Plus, Eye as View } from '@lucide/vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { createFileTemplateValidation, optionalText } from './fileTemplateValidation'
  import { createFileTemplateForm } from './fileTemplateForm'

  const { t, te } = useI18n({ useScope: 'global' })
  const { requireText, requireCode } = createFileTemplateValidation((key, label) =>
    t(key, { label }),
  )
  // P2 IA 拆分:route.meta.mode 限定本页只显示某一类资源,实现两条路由共用一个组件
  // 'templates' | 'channels' — 缺省视为单 tab 模式;不传则两个 tab 全显示(兼容老入口)
  const route = useRoute()
  const mode = computed<'templates' | 'channels' | 'all'>(
    () => (route.meta?.mode as 'templates' | 'channels' | undefined) ?? 'all',
  )
  function resolveEnumLabel(group: string, value?: string | null): string {
    if (!value) return ''
    const key = `enum.${group}.${value}`
    return te(key) ? t(key) : value
  }
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import { getMetaBizTypes, type MetaOption } from '@/api/meta'
  import { userErrorMessage } from '@/utils/userErrorMessage'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import CopyableText from '@/components/common/CopyableText.vue'
  import CodeNameBuilder from '@/components/common/CodeNameBuilder.vue'
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
  import { useTenantRequirement } from '@/composables/useTenantRequirement'
  import { useAuthStore } from '@/stores/auth'
  import { usePermissionStore } from '@/stores/permission'
  import { currentAuthSession, isSharedAuthRevisionCurrent } from '@/api/authSession'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useTenantRequestScope } from '@/composables/useTenantRequestScope'
  import { usePermission } from '@/composables/usePermission'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import StatusSegment, { type StatusSegmentItem } from '@/components/table/StatusSegment.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import FileChannelDrawers from './FileChannelDrawers.vue'
  import FileTemplateDetailDrawer from './FileTemplateDetailDrawer.vue'
  import FileTemplateFormatFields from './FileTemplateFormatFields.vue'
  import JsonTextareaInput from '@/components/common/JsonTextareaInput.vue'
  import MappingDraftAssistant from './MappingDraftAssistant.vue'
  import type { FileTemplateMappingDraftResponse } from '@/api/system'
  import RowActions, { type RowAction } from '@/components/common/RowActions.vue'
  import type { ConsoleFileChannelResponse, ConsoleFileTemplateResponse } from '@/types/console-api'

  const tenant = useTenantStore()
  const { ensureTenantSelected } = useTenantRequirement()
  const auth = useAuthStore()
  const permissionStore = usePermissionStore()
  const canReadFileConfig = computed(() => {
    if (!auth.isLoggedIn || !auth.profileLoaded) return false
    if (
      !['ROLE_ADMIN', 'ROLE_TENANT_ADMIN', 'ROLE_AUDITOR'].some((role) => auth.hasPermission(role))
    )
      return false
    return (
      permissionStore.hasBackendMenuAccess('/files/templates') ||
      (mode.value === 'channels' && permissionStore.hasBackendMenuAccess('/files/channels'))
    )
  })
  const templatesScope = useTenantRequestScope()
  const channelsScope = useTenantRequestScope()
  const bizTypesScope = useTenantRequestScope()
  const detailScope = useTenantRequestScope()
  const { canMutateConfig } = usePermission()
  const loadingTemplates = ref(false)
  const loadingChannels = ref(false)
  const loading = computed(() => loadingTemplates.value || loadingChannels.value)
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
  const initialDefaultQuerySql = ref<string | null>(null)
  const channelEditingId = ref<number | null>(null)
  const templateSaving = ref(false)
  const channelSaving = ref(false)
  type EditorScope = { tenantId: string; username: string; session: number }
  let templateEditor: EditorScope | null = null
  let channelEditor: EditorScope | null = null
  function newContextScope(): EditorScope | null {
    const username = auth.userInfo?.username
    if (
      !tenant.tenantId ||
      !username ||
      !auth.isLoggedIn ||
      !auth.profileLoaded ||
      !canReadFileConfig.value ||
      !canMutateConfig.value ||
      !isSharedAuthRevisionCurrent()
    )
      return null
    return { tenantId: tenant.tenantId, username, session: currentAuthSession() }
  }
  function contextIsCurrent(scope: EditorScope) {
    return (
      scope.tenantId === tenant.tenantId &&
      scope.username === auth.userInfo?.username &&
      scope.session === currentAuthSession() &&
      auth.isLoggedIn &&
      auth.profileLoaded &&
      canReadFileConfig.value &&
      canMutateConfig.value &&
      isSharedAuthRevisionCurrent()
    )
  }
  function editorIsCurrent(scope: EditorScope | null, kind: 'template' | 'channel') {
    return (
      !!scope &&
      scope === (kind === 'template' ? templateEditor : channelEditor) &&
      (kind === 'template' ? templateDialogVisible.value : channelDialogVisible.value) &&
      contextIsCurrent(scope)
    )
  }
  function captureReadSession() {
    return { username: auth.userInfo?.username, session: currentAuthSession() }
  }
  function readSessionIsCurrent(scope: ReturnType<typeof captureReadSession>) {
    return (
      scope.session === currentAuthSession() &&
      scope.username === auth.userInfo?.username &&
      auth.isLoggedIn &&
      auth.profileLoaded &&
      canReadFileConfig.value &&
      isSharedAuthRevisionCurrent()
    )
  }
  const togglingTemplateIds = shallowReactive(new Map<number, EditorScope>())
  const togglingChannelIds = shallowReactive(new Map<number, EditorScope>())
  let templateToggleRevision = 0
  let channelToggleRevision = 0
  const activeTab = ref<'templates' | 'channels'>(
    mode.value === 'channels' ? 'channels' : 'templates',
  )
  // 不在 el-tab-pane 根节点叠加 v-show，显隐由 Element Plus 按当前 tab 管理。
  watch(mode, (value) => {
    activeTab.value = value === 'channels' ? 'channels' : 'templates'
  })

  // PageHeader 右上"新建"按钮按当前 tab 切换文案与动作
  const activeCreateLabel = computed(() =>
    activeTab.value === 'templates'
      ? t('fileTemplateList.actionCreateTemplate')
      : t('fileTemplateList.actionCreateChannel'),
  )
  function onCreateClick() {
    if (!canMutateConfig.value) return
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
  const pageSize = ref(15)
  const keyword = ref('')
  const templateType = ref('')
  const bizType = ref('')
  const enabled = ref<boolean | undefined>()
  const channelKeyword = ref('')
  const channelType = ref('')
  const channelDetailVisible = ref(false)
  const channelDetailRow = ref<ConsoleFileChannelResponse | null>(null)
  const channelEnabled = ref<boolean | undefined>()
  const enabledStatusSegmentItems = computed<StatusSegmentItem[]>(() => [
    { value: 'ALL', label: t('dateRangePicker.all'), tone: 'neutral' },
    {
      value: 'ENABLED',
      label: t('fileTemplateList.optEnabled'),
      tone: 'success',
    },
    {
      value: 'DISABLED',
      label: t('fileTemplateList.optDisabled'),
      tone: 'muted',
    },
  ])
  const templateEnabledSegment = computed(() =>
    enabled.value === true ? 'ENABLED' : enabled.value === false ? 'DISABLED' : 'ALL',
  )
  const channelEnabledSegment = computed(() =>
    channelEnabled.value === true ? 'ENABLED' : channelEnabled.value === false ? 'DISABLED' : 'ALL',
  )

  function onChannelEnabledSegmentChange(value: string) {
    channelEnabled.value = value === 'ENABLED' ? true : value === 'DISABLED' ? false : undefined
  }

  function onTemplateEnabledSegmentChange(value: string) {
    enabled.value = value === 'ENABLED' ? true : value === 'DISABLED' ? false : undefined
  }

  const templateForm = reactive(createFileTemplateForm())

  // 渐进式披露:分隔符/行分隔符仅对分隔符格式(DELIMITED)相关;其余格式隐藏(值仍保留在 model,提交语义不变)。
  const isDelimited = computed(() => templateForm.fileFormatType === 'DELIMITED')
  function applyMappingDraft(draft: FileTemplateMappingDraftResponse) {
    if (
      !editorIsCurrent(templateEditor, 'template') ||
      templateEditingId.value != null ||
      !isDelimited.value ||
      templateForm.fieldMappingsJson.trim() ||
      templateForm.queryParamSchemaJson.trim() ||
      (templateForm.templateType === 'EXPORT' && templateForm.defaultQuerySql.trim()) ||
      draft.direction !== templateForm.templateType
    )
      return
    if (!draft.fieldMappingsJson || !draft.queryParamSchemaJson) return
    templateForm.fieldMappingsJson = draft.fieldMappingsJson
    templateForm.queryParamSchemaJson = draft.queryParamSchemaJson
    if (draft.direction === 'EXPORT') templateForm.defaultQuerySql = draft.defaultQuerySql ?? ''
  }
  // 编码等高级项默认折叠(已给 UTF-8 合理默认),减少新建时的认知负担。
  const showFormatAdvanced = ref(false)

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

  function handleValidationError(err: unknown) {
    if (err instanceof Error) ElMessage.warning(userErrorMessage(err))
  }
  // templateType 走后端 enum(完整候选);未到达时 fallback 到 rows 派生
  const { data: metaEnums } = useConsoleMetaEnumsQuery()
  const channelTypeOptions = computed(() => pickMetaEnumGroup(metaEnums.value, 'channelType'))
  const templateTypeOptions = computed(() => {
    const fromEnum = pickMetaEnumGroup(metaEnums.value, 'fileTemplateType')
    if (fromEnum.length > 0) return fromEnum
    const configuredTemplateTypes = allRows.value
      .map((row) => row.templateType)
      .filter((item): item is string => !!item)
    const uniqueTemplateTypes = Array.from(new Set(configuredTemplateTypes))
    return uniqueTemplateTypes.map((templateType) => ({ value: templateType, label: templateType }))
  })
  // bizType 是租户级业务字典(独立 API),进页面 + 切租户时拉
  const bizTypeOptions = ref<MetaOption[]>([])
  async function loadBizTypes() {
    if (!canReadFileConfig.value) return
    const scope = bizTypesScope.begin()
    const session = captureReadSession()
    if (!scope.tenantId) return
    try {
      const result = await getMetaBizTypes(scope.tenantId)
      if (bizTypesScope.isCurrent(scope) && readSessionIsCurrent(session))
        bizTypeOptions.value = result
    } catch {
      if (bizTypesScope.isCurrent(scope) && readSessionIsCurrent(session)) bizTypeOptions.value = []
    }
  }

  const filtered = computed(() => {
    const trimmedKeyword = keyword.value.trim()
    const k = trimmedKeyword.toLowerCase()
    const selectedTemplateType = templateType.value.trim()
    const selectedBizType = bizType.value.trim()
    return allRows.value.filter((row) => {
      if (k) {
        const searchableTemplateText =
          `${row.templateCode} ${row.templateName} ${row.templateType}`.toLowerCase()
        if (!searchableTemplateText.includes(k)) return false
      }
      if (selectedTemplateType && !row.templateType?.includes(selectedTemplateType)) {
        return false
      }
      if (selectedBizType && !row.bizType?.includes(selectedBizType)) {
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
    if (!canReadFileConfig.value) return
    const scope = templatesScope.begin()
    const session = captureReadSession()
    if (!scope.tenantId) return
    loadingTemplates.value = true
    loadError.value = null
    try {
      const result = await listFileTemplates(scope.tenantId)
      if (templatesScope.isCurrent(scope) && readSessionIsCurrent(session)) allRows.value = result
    } catch (err) {
      if (templatesScope.isCurrent(scope) && readSessionIsCurrent(session)) {
        loadError.value = err
        allRows.value = []
      }
    } finally {
      if (templatesScope.isCurrent(scope)) {
        if (readSessionIsCurrent(session)) syncPage()
        loadingTemplates.value = false
      }
    }
  }

  function syncChannelRows() {
    const trimmedChannelKeyword = channelKeyword.value.trim()
    const k = trimmedChannelKeyword.toLowerCase()
    channelRows.value = allChannelRows.value.filter((row) => {
      if (k) {
        const searchableChannelText =
          `${row.channelCode ?? ''} ${row.channelName ?? ''} ${row.channelType ?? ''}`.toLowerCase()
        if (!searchableChannelText.includes(k)) return false
      }
      if (channelEnabled.value != null && row.enabled !== channelEnabled.value) return false
      if (channelType.value && !String(row.channelType ?? '').includes(channelType.value))
        return false
      return true
    })
  }

  function openChannelDetail(row: ConsoleFileChannelResponse) {
    if (!canReadFileConfig.value || (row.tenantId && row.tenantId !== tenant.tenantId)) return
    channelDetailRow.value = row
    channelDetailVisible.value = true
  }

  async function loadChannels() {
    if (!canReadFileConfig.value) return
    const scope = channelsScope.begin()
    const session = captureReadSession()
    if (!scope.tenantId) return
    loadingChannels.value = true
    try {
      const result = await listFileChannels(scope.tenantId)
      if (channelsScope.isCurrent(scope) && readSessionIsCurrent(session))
        allChannelRows.value = result
    } catch {
      if (channelsScope.isCurrent(scope) && readSessionIsCurrent(session)) allChannelRows.value = []
    } finally {
      if (channelsScope.isCurrent(scope)) {
        if (readSessionIsCurrent(session)) syncChannelRows()
        loadingChannels.value = false
      }
    }
  }

  async function openDetail(row: ConsoleFileTemplateResponse) {
    if (!canReadFileConfig.value) return
    // 防御:BE 返回的 row 字段可能全为 null(数据坏 / schema drift / 权限过滤);
    // 不带 templateCode 直接 fetch 会 GET /file-templates/undefined → 404 报错
    if (!row?.templateCode) {
      ElMessage.warning(t('fileTemplateList.detailUnavailable'))
      return
    }
    const scope = detailScope.begin()
    const session = captureReadSession()
    if (!scope.tenantId || (row.tenantId && row.tenantId !== scope.tenantId)) return
    const result = await queryFileTemplateDetail(scope.tenantId, row.templateCode)
    if (!detailScope.isCurrent(scope) || !readSessionIsCurrent(session)) return
    detail.value = result
    detailVisible.value = true
  }

  function templateRowActions(row: ConsoleFileTemplateResponse): RowAction[] {
    const actions: RowAction[] = [
      {
        key: 'detail',
        label: t('fileTemplateList.actionDetail'),
        primary: !canMutateConfig.value,
        onClick: () => openDetail(row),
      },
    ]
    if (canMutateConfig.value) {
      actions.unshift({
        key: 'edit',
        label: t('common.edit'),
        primary: true,
        onClick: () => openTemplateEdit(row),
      })
    }
    return actions
  }

  function openTemplateCreate() {
    if (!ensureTenantSelected()) return
    const scope = newContextScope()
    if (!scope) return
    templateEditor = scope
    templateEditingId.value = null
    initialDefaultQuerySql.value = null
    Object.assign(templateForm, createFileTemplateForm())
    templateDialogVisible.value = true
  }

  function openTemplateEdit(row: ConsoleFileTemplateResponse) {
    const scope = newContextScope()
    if (!scope || (row.tenantId && row.tenantId !== scope.tenantId)) return
    templateEditor = scope
    templateEditingId.value = row.id
    initialDefaultQuerySql.value = row.defaultQuerySql ?? null
    Object.assign(templateForm, {
      templateCode: row.templateCode ?? '',
      templateName: row.templateName ?? '',
      templateType: row.templateType ?? 'EXPORT',
      bizType: row.bizType ?? '',
      fileFormatType: row.fileFormatType ?? 'CSV',
      charset: row.charset ?? 'UTF-8',
      targetCharset: row.targetCharset ?? 'UTF-8',
      withBom: row.withBom ?? false,
      delimiter: row.delimiter ?? ',',
      lineSeparator: row.lineSeparator ?? '\\n',
      fieldMappingsJson: row.fieldMappings ?? '',
      queryParamSchemaJson: row.queryParamSchema ?? '',
      defaultQuerySql: row.defaultQuerySql ?? '',
      enabled: row.enabled ?? true,
      version: row.version ?? 1,
      description: row.description ?? '',
    })
    templateDialogVisible.value = true
  }

  function buildTemplatePayload(tenantId: string): FileTemplateSavePayload {
    return {
      tenantId,
      ...(templateEditingId.value == null
        ? {
            templateCode: requireCode(
              templateForm.templateCode,
              t('fileTemplateList.fieldTemplateCode'),
            ),
          }
        : {}),
      templateName: optionalText(templateForm.templateName),
      templateType: requireText(templateForm.templateType, t('fileTemplateList.fieldTemplateType')),
      bizType: optionalText(templateForm.bizType),
      fileFormatType: optionalText(templateForm.fileFormatType),
      charset: optionalText(templateForm.charset),
      targetCharset: optionalText(templateForm.targetCharset),
      withBom: templateForm.withBom,
      delimiter: optionalText(templateForm.delimiter),
      lineSeparator: optionalText(templateForm.lineSeparator),
      fieldMappingsJson: optionalText(templateForm.fieldMappingsJson),
      queryParamSchemaJson: optionalText(templateForm.queryParamSchemaJson),
      defaultQuerySql:
        templateEditingId.value == null || initialDefaultQuerySql.value == null
          ? optionalText(templateForm.defaultQuerySql)
          : templateForm.defaultQuerySql,
      enabled: templateForm.enabled,
      version: templateForm.version,
      description: optionalText(templateForm.description),
    }
  }

  async function saveTemplate() {
    const scope = templateEditor
    if (!editorIsCurrent(scope, 'template') || !scope || templateSaving.value) return
    templateSaving.value = true
    try {
      const payload = buildTemplatePayload(scope.tenantId)
      if (templateEditingId.value == null) await createFileTemplate(payload)
      else await updateFileTemplate(templateEditingId.value, payload)
      if (!editorIsCurrent(scope, 'template')) return
      ElMessage.success(t('fileTemplateList.saveSuccess'))
      templateDialogVisible.value = false
      await load()
    } catch (err) {
      if (editorIsCurrent(scope, 'template')) handleValidationError(err)
    } finally {
      if (templateEditor === scope) templateSaving.value = false
    }
  }

  async function toggleTemplate(row: ConsoleFileTemplateResponse) {
    const scope = newContextScope()
    if (!scope || (row.tenantId && row.tenantId !== scope.tenantId)) return
    const pending = togglingTemplateIds.get(row.id)
    if (pending && contextIsCurrent(pending)) return
    const revision = templateToggleRevision
    const enabled = !row.enabled
    togglingTemplateIds.set(row.id, scope)
    try {
      await toggleFileTemplate(row.id, scope.tenantId, enabled)
      if (revision !== templateToggleRevision || !contextIsCurrent(scope)) return
      row.enabled = enabled
      ElMessage.success(t('fileTemplateList.saveSuccess'))
    } finally {
      if (togglingTemplateIds.get(row.id) === scope) togglingTemplateIds.delete(row.id)
    }
  }

  function openChannelCreate() {
    if (!ensureTenantSelected()) return
    const scope = newContextScope()
    if (!scope) return
    channelEditor = scope
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
    const scope = newContextScope()
    if (!scope || row.id == null || (row.tenantId && row.tenantId !== scope.tenantId)) return
    channelEditor = scope
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

  function buildChannelPayload(tenantId: string): FileChannelSavePayload {
    const channelCode =
      channelEditingId.value == null
        ? requireCode(channelForm.channelCode, t('fileTemplateList.fieldChannelCode'))
        : undefined
    const channelType = requireText(channelForm.channelType, t('fileTemplateList.fieldChannelType'))
    const configJson = optionalText(channelForm.configJson)
    if (configJson) {
      let parsed: unknown
      try {
        parsed = JSON.parse(configJson)
      } catch {
        throw new Error(t('fileTemplateList.validationConfigJson'))
      }
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error(t('fileTemplateList.validationConfigJson'))
      }
    }
    return {
      tenantId,
      ...(channelCode ? { channelCode } : {}),
      channelName: optionalText(channelForm.channelName),
      channelType,
      targetEndpoint: optionalText(channelForm.targetEndpoint),
      authType: optionalText(channelForm.authType),
      configJson,
      receiptPolicy: optionalText(channelForm.receiptPolicy),
      timeoutSeconds: channelForm.timeoutSeconds,
      enabled: channelForm.enabled,
    }
  }

  async function saveChannel() {
    const scope = channelEditor
    if (!editorIsCurrent(scope, 'channel') || !scope || channelSaving.value) return
    channelSaving.value = true
    try {
      const payload = buildChannelPayload(scope.tenantId)
      if (channelEditingId.value == null) await createFileChannel(payload)
      else await updateFileChannel(channelEditingId.value, payload)
      if (!editorIsCurrent(scope, 'channel')) return
      ElMessage.success(t('fileTemplateList.saveSuccess'))
      channelDialogVisible.value = false
      await loadChannels()
    } catch (err) {
      if (editorIsCurrent(scope, 'channel')) handleValidationError(err)
    } finally {
      if (channelEditor === scope) channelSaving.value = false
    }
  }

  async function toggleChannel(row: ConsoleFileChannelResponse) {
    const scope = newContextScope()
    if (!scope || row.id == null || (row.tenantId && row.tenantId !== scope.tenantId)) return
    const pending = togglingChannelIds.get(row.id)
    if (pending && contextIsCurrent(pending)) return
    const revision = channelToggleRevision
    const enabled = !row.enabled
    togglingChannelIds.set(row.id, scope)
    try {
      await toggleFileChannel(row.id, scope.tenantId, enabled)
      if (revision !== channelToggleRevision || !contextIsCurrent(scope)) return
      row.enabled = enabled
      ElMessage.success(t('fileTemplateList.saveSuccess'))
    } finally {
      if (togglingChannelIds.get(row.id) === scope) togglingChannelIds.delete(row.id)
    }
  }

  function onChannelSearch() {
    return runSearch(syncChannelRows)
  }

  function resetChannels() {
    return runReset(() => {
      channelKeyword.value = ''
      channelType.value = ''
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

  function invalidateEditors() {
    templateEditor = null
    channelEditor = null
    templateSaving.value = false
    channelSaving.value = false
    templateToggleRevision++
    channelToggleRevision++
    togglingTemplateIds.clear()
    togglingChannelIds.clear()
    templateDialogVisible.value = false
    channelDialogVisible.value = false
  }
  watch(
    [
      () => tenant.tenantId,
      () => auth.userInfo?.username,
      () => auth.isLoggedIn,
      () => auth.profileLoaded,
      canMutateConfig,
      canReadFileConfig,
    ],
    invalidateEditors,
    { flush: 'sync' },
  )
  watch(
    templateDialogVisible,
    (visible) => {
      if (!visible) {
        templateEditor = null
        templateSaving.value = false
      }
    },
    { flush: 'sync' },
  )
  watch(
    channelDialogVisible,
    (visible) => {
      if (!visible) {
        channelEditor = null
        channelSaving.value = false
      }
    },
    { flush: 'sync' },
  )
  onScopeDispose(invalidateEditors)
  watch(
    [
      () => tenant.tenantId,
      () => auth.userInfo?.username,
      () => auth.isLoggedIn,
      () => auth.profileLoaded,
      canReadFileConfig,
    ],
    ([tenantId, username, loggedIn, profileLoaded], [oldTenantId]) => {
      templatesScope.begin()
      channelsScope.begin()
      bizTypesScope.begin()
      detailScope.begin()
      allRows.value = []
      allChannelRows.value = []
      bizTypeOptions.value = []
      detail.value = null
      detailVisible.value = false
      channelDetailRow.value = null
      channelDetailVisible.value = false
      loadingTemplates.value = false
      loadingChannels.value = false
      loadError.value = null
      syncPage()
      syncChannelRows()
      if (tenantId === oldTenantId && tenantId && username && loggedIn && profileLoaded) {
        void load()
        void loadChannels()
        void loadBizTypes()
      }
    },
    { flush: 'sync' },
  )
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

<style scoped src="./FileTemplateList.css"></style>
