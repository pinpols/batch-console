<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button
          v-if="canMutateConfig"
          type="primary"
          :icon="Plus"
          class="pretty-add-button"
          @click="openCreate"
        >
          {{ t('pipelineDefinitionList.headerCreate') }}
        </el-button>
      </template>
    </PageHeader>

    <!-- 照设计 dump(docs/redesign/proto-nav-流水线定义.html):独立筛选卡片(r12 / 16 18 / label 12 text-3) -->
    <div class="pd-filter">
      <div class="pd-filter__field pd-filter__field--code">
        <div class="pd-filter__label">{{ t('pipelineDefinitionList.keywordLabel') }}</div>
        <el-input
          v-model="keyword"
          clearable
          :placeholder="t('pipelineDefinitionList.keywordPlaceholder')"
          @keyup.enter="onQueryBarSearch"
        />
      </div>
      <div class="pd-filter__field pd-filter__field--type">
        <div class="pd-filter__label">{{ t('pipelineDefinitionList.typeLabel') }}</div>
        <el-select
          v-model="pipelineType"
          clearable
          filterable
          :placeholder="t('pipelineDefinitionList.typePlaceholder')"
        >
          <el-option
            v-for="option in pipelineTypeOptions"
            :key="option"
            :label="option"
            :value="option"
          />
        </el-select>
      </div>
      <div class="pd-filter__field pd-filter__field--enabled">
        <div class="pd-filter__label">{{ t('pipelineDefinitionList.enabledLabel') }}</div>
        <el-select
          v-model="enabledFilter"
          clearable
          :placeholder="t('pipelineDefinitionList.enabledPlaceholder')"
        >
          <el-option :label="t('pipelineDefinitionList.optEnabled')" :value="true" />
          <el-option :label="t('pipelineDefinitionList.optDisabled')" :value="false" />
        </el-select>
      </div>
      <div class="pd-filter__actions">
        <el-button type="primary" :loading="filterBusy" @click="onQueryBarSearch">
          {{ t('common.search') }}
        </el-button>
        <el-button @click="onQueryBarReset">{{ t('common.reset') }}</el-button>
        <el-button :loading="loading" @click="() => runRefresh(load)">
          {{ t('common.refresh') }}
        </el-button>
      </div>
    </div>

    <SectionCard>
      <ProTable
        :data="rows"
        :loading="tableBlocking"
        :total="total"
        v-model:page="page"
        v-model:page-size="pageSize"
        @change="load"
        :error="loadError"
        :on-retry="load"
        :has-active-filters="hasActiveFilters"
      >
        <template #toolbar>
          <OpsListToolbar
            :status="live.status.value"
            :last-refreshed-at="live.lastRefreshedAt.value"
          />
        </template>
        <template v-if="!hasActiveFilters" #empty>
          <EmptyState :description="t('pipelineDefinitionList.emptyDescription')" :image-size="80">
            <template #action>
              <el-button v-if="canMutateConfig" type="primary" :icon="Plus" @click="openCreate">
                {{ t('pipelineDefinitionList.headerCreate') }}
              </el-button>
            </template>
          </EmptyState>
        </template>
        <el-table-column
          prop="pipelineCode"
          :label="t('pipelineDefinitionList.colCode')"
          width="220"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <!-- 照 dump:code 走 mono + accent,点击开详情抽屉 -->
            <span class="pd-code" @click="openDetail(row, 'overview')">{{ row.pipelineCode }}</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="pipelineName"
          :label="t('pipelineDefinitionList.colName')"
          min-width="260"
          show-overflow-tooltip
        />
        <el-table-column :label="t('pipelineDefinitionList.colType')" width="120">
          <template #default="{ row }">
            <!-- 照 dump:类型徽章 mono 彩底(IMPORT/EXPORT/其他 三档语义色) -->
            <span
              v-if="row.pipelineType"
              class="pd-badge"
              :style="typeBadgeStyle(row.pipelineType)"
              >{{ row.pipelineType }}</span
            >
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <DatetimeColumn
          prop="updatedAt"
          :label="t('pipelineDefinitionList.colUpdatedAt')"
          width="180"
        />
        <el-table-column :label="t('pipelineDefinitionList.colEnabled')" width="120">
          <template #default="{ row }">
            <el-switch
              :model-value="row.enabled"
              :loading="togglingId === row.id"
              inline-prompt
              :active-text="t('pipelineDefinitionList.switchOn')"
              :inactive-text="t('pipelineDefinitionList.switchOff')"
              @change="toggle(row)"
            />
          </template>
        </el-table-column>
        <el-table-column :label="t('pipelineDefinitionList.colActions')" width="180" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" plain type="primary" @click="openDetail(row, 'runs')">
                {{ t('pipelineDefinitionList.actionRuns') }}
              </el-button>
              <el-button size="small" plain @click="openEdit(row)">
                {{ t('pipelineDefinitionList.actionEdit') }}
              </el-button>
            </div>
          </template>
        </el-table-column>
      </ProTable>
    </SectionCard>

    <el-drawer :append-to-body="true" v-model="drawerVisible" :title="drawerTitle" size="800px">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="120px">
        <el-form-item :label="t('pipelineDefinitionList.fieldPipelineCode')" prop="pipelineCode">
          <el-input v-model="form.pipelineCode" :disabled="editingId != null" maxlength="128" />
        </el-form-item>
        <el-form-item :label="t('pipelineDefinitionList.fieldPipelineName')" prop="pipelineName">
          <el-input v-model="form.pipelineName" maxlength="256" />
        </el-form-item>
        <el-form-item :label="t('pipelineDefinitionList.fieldPipelineType')" prop="pipelineType">
          <MetaSelect
            v-model="form.pipelineType"
            class="query-w-full"
            enum-key="pipelineType"
            :placeholder="t('pipelineDefinitionList.typeFieldPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('pipelineDefinitionList.fieldEnabled')">
          <el-switch v-model="form.enabled" />
        </el-form-item>
        <el-form-item :label="t('pipelineDefinitionList.fieldDescription')">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            maxlength="512"
            show-word-limit
          />
        </el-form-item>
        <el-form-item :label="t('pipelineDefinitionList.stepsTitle')">
          <!-- 没选 pipelineType:提示先选,不显空白卡片 -->
          <el-alert
            v-if="!form.pipelineType"
            type="info"
            :closable="false"
            show-icon
            :title="t('pipelineDefinitionList.flowSelectTypeFirst')"
          />
          <div v-else class="pipeline-flow">
            <div class="pipeline-flow__hint">
              <el-icon><InfoFilled /></el-icon>
              <span>{{
                t('pipelineDefinitionList.flowHint', {
                  type: form.pipelineType,
                  n: steps.length,
                })
              }}</span>
            </div>
            <div class="pipeline-flow__list">
              <template v-for="(row, index) in steps" :key="row.stageCode">
                <div v-if="index > 0" class="pipeline-flow__connector">
                  <span class="pipeline-flow__arrow">↓</span>
                </div>
                <div class="stage-card">
                  <div
                    class="stage-card__icon"
                    :style="{ background: stageMeta(row.stageCode).color }"
                  >
                    <el-icon :size="22" color="#fff">
                      <component :is="stageMeta(row.stageCode).icon" />
                    </el-icon>
                  </div>
                  <div class="stage-card__main">
                    <div class="stage-card__head">
                      <span class="stage-card__index">{{ index + 1 }}</span>
                      <span class="stage-card__stage">{{ row.stageCode }}</span>
                      <span class="stage-card__sub">{{ stageMeta(row.stageCode).desc }}</span>
                      <!-- impl 显示成 readonly chip:每个 (type,stage) 通常对应 1 个 worker 实现,用户不应选 -->
                      <span
                        class="stage-card__impl"
                        :title="t('pipelineDefinitionList.implReadonlyHint')"
                      >
                        <el-icon><Cpu /></el-icon>
                        <code>{{ row.stepType || t('pipelineDefinitionList.implAuto') }}</code>
                        <el-tooltip
                          v-if="implsForStage(row.stageCode).length > 1"
                          :content="t('pipelineDefinitionList.implOverrideHint')"
                          placement="top"
                        >
                          <el-button
                            link
                            size="small"
                            class="stage-card__impl-override"
                            @click="toggleImplEdit(index)"
                          >
                            {{ implEditOpen.has(index) ? '✕' : '✏' }}
                          </el-button>
                        </el-tooltip>
                      </span>
                    </div>
                    <div class="stage-card__row">
                      <el-input
                        v-model="row.stepName"
                        size="small"
                        :placeholder="
                          t('pipelineDefinitionList.flowNamePlaceholder', { code: row.stepCode })
                        "
                        class="stage-card__name"
                      />
                      <el-input
                        v-model="row.description"
                        size="small"
                        :placeholder="t('pipelineDefinitionList.flowMemoPlaceholder')"
                        class="stage-card__memo"
                      />
                    </div>
                    <!-- 高级:同 (type,stage) 注册多个 impl 时(A/B / 自定义 worker)才出现编辑入口 -->
                    <div v-if="implEditOpen.has(index)" class="stage-card__impl-edit">
                      <span class="stage-card__impl-edit-label">{{
                        t('pipelineDefinitionList.implOverrideLabel')
                      }}</span>
                      <el-select
                        v-model="row.stepType"
                        size="small"
                        filterable
                        clearable
                        :placeholder="t('pipelineDefinitionList.flowImplPlaceholder')"
                        class="stage-card__impl-select"
                      >
                        <el-option
                          v-for="impl in implsForStage(row.stageCode)"
                          :key="impl"
                          :label="impl"
                          :value="impl"
                        />
                      </el-select>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </el-form-item>
        <div class="drawer-actions">
          <el-button @click="drawerVisible = false">
            {{ t('pipelineDefinitionList.drawerCancel') }}
          </el-button>
          <el-button type="primary" :loading="submitAction.loading.value" @click="submitForm">
            {{ t('pipelineDefinitionList.drawerSave') }}
          </el-button>
        </div>
      </el-form>
    </el-drawer>

    <!-- Run-centric 详情抽屉(P2 对称):Overview + 最近运行 -->
    <el-drawer
      :append-to-body="true"
      v-model="detailVisible"
      :title="t('pipelineDefinitionList.detailTitle', { code: detailRow?.pipelineCode || '' })"
      size="720px"
    >
      <el-tabs v-if="detailRow" v-model="activeDetailTab">
        <el-tab-pane name="overview" :label="t('pipelineDefinitionList.detailTabOverview')">
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item :label="t('pipelineDefinitionList.fieldPipelineCode')">{{
              detailRow.pipelineCode
            }}</el-descriptions-item>
            <el-descriptions-item :label="t('pipelineDefinitionList.fieldPipelineName')">{{
              detailRow.pipelineName
            }}</el-descriptions-item>
            <el-descriptions-item :label="t('pipelineDefinitionList.fieldPipelineType')">{{
              detailRow.pipelineType || '—'
            }}</el-descriptions-item>
            <el-descriptions-item :label="t('pipelineDefinitionList.fieldEnabled')">
              {{ detailRow.enabled ? t('common.yes') : t('common.no') }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('common.tenantId')">{{
              detailRow.tenantId
            }}</el-descriptions-item>
            <el-descriptions-item
              v-if="detailRow.description"
              :label="t('pipelineDefinitionList.fieldDescription')"
              :span="2"
            >
              {{ detailRow.description }}
            </el-descriptions-item>
          </el-descriptions>
        </el-tab-pane>

        <el-tab-pane name="runs" :lazy="true">
          <template #label>
            <span>
              {{ t('pipelineDefinitionList.detailTabRuns') }}
              <el-tag v-if="detailRunsRows.length" size="small" round>{{
                detailRunsRows.length
              }}</el-tag>
            </span>
          </template>
          <div class="detail-runs-header">
            <span>{{
              t('pipelineDefinitionList.detailRunsHint', { code: detailRow.pipelineCode })
            }}</span>
            <el-button text type="primary" @click="goInstancesFiltered(detailRow.pipelineCode)">
              {{ t('runs.viewAll') }} →
            </el-button>
          </div>
          <el-table
            v-loading="detailRunsLoading"
            :data="detailRunsRows"
            size="small"
            empty-text="—"
            stripe
            @row-click="goJobInstance"
          >
            <el-table-column :label="t('runs.colInstance')" min-width="200">
              <template #default="{ row }">
                <span class="cell-link">{{ row.instanceNo }}</span>
              </template>
            </el-table-column>
            <el-table-column :label="t('runs.colStatus')" width="110">
              <template #default="{ row }">
                <StatusTag :value="row.instanceStatus" category="instance" />
              </template>
            </el-table-column>
            <el-table-column prop="bizDate" :label="t('runs.colBizDate')" width="110" />
            <el-table-column :label="t('runs.colStarted')" width="160">
              <template #default="{ row }">{{ fmtDatetime(row.startedAt) }}</template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-drawer>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'

  const { t } = useI18n({ useScope: 'global' })
  import type { FormInstance, FormRules } from 'element-plus'
  import {
    Plus,
    Info as InfoFilled,
    Cpu,
    Download,
    Sparkles as MagicStick,
    FileText as Document,
    CircleCheck,
    Upload,
    MessageCircle as ChatLineRound,
    Settings as Setting,
    Activity as DataLine,
    FilePlus as DocumentAdd,
    Folder,
    Notebook,
    Check,
    Send as Promotion,
    Bell,
    RefreshCw as Refresh,
    RotateCcw as RefreshLeft,
    CircleCheckBig as Finished,
  } from 'lucide-vue-next'
  import type { Component } from 'vue'

  // Stage → 图标 + 主题色 + 一句话描述。覆盖 STAGES_BY_TYPE 全 17 种,缺省走默认。
  // 色板走 design token `--color-stage-*`(tokens.css),el-icon `color` 接受 CSS var()。
  const STAGE_META: Record<string, { icon: Component; color: string; desc: string }> = {
    RECEIVE: { icon: Download, color: 'var(--color-stage-receive)', desc: '接收源文件' },
    PREPROCESS: { icon: MagicStick, color: 'var(--color-stage-preprocess)', desc: '解密 / 预处理' },
    PARSE: { icon: Document, color: 'var(--color-stage-parse)', desc: '解析为记录' },
    VALIDATE: { icon: CircleCheck, color: 'var(--color-stage-validate)', desc: '校验' },
    LOAD: { icon: Upload, color: 'var(--color-stage-load)', desc: '入库' },
    FEEDBACK: { icon: ChatLineRound, color: 'var(--color-stage-feedback)', desc: '回执 / 通知' },
    PREPARE: { icon: Setting, color: 'var(--color-stage-prepare)', desc: '准备执行上下文' },
    COMPUTE: { icon: DataLine, color: 'var(--color-stage-compute)', desc: '业务计算' },
    GENERATE: { icon: DocumentAdd, color: 'var(--color-stage-generate)', desc: '生成文件' },
    STORE: { icon: Folder, color: 'var(--color-stage-store)', desc: '存档' },
    REGISTER: { icon: Notebook, color: 'var(--color-stage-register)', desc: '登记元数据' },
    COMMIT: { icon: Check, color: 'var(--color-stage-commit)', desc: '提交' },
    COMPLETE: { icon: Finished, color: 'var(--color-stage-complete)', desc: '完成' },
    DISPATCH: { icon: Promotion, color: 'var(--color-stage-dispatch)', desc: '推送下游' },
    ACK: { icon: Bell, color: 'var(--color-stage-ack)', desc: '等待 ACK' },
    RETRY: { icon: Refresh, color: 'var(--color-stage-retry)', desc: '失败重试' },
    COMPENSATE: { icon: RefreshLeft, color: 'var(--color-stage-compensate)', desc: '补偿' },
  }
  const DEFAULT_META = { icon: Setting, color: 'var(--color-text-tertiary)', desc: '' }
  function stageMeta(code: string) {
    return STAGE_META[code] ?? DEFAULT_META
  }
  import {
    createPipelineDefinition,
    queryPipelineDefinitionDetail,
    queryPipelineDefinitions,
    togglePipelineDefinition,
    updatePipelineDefinition,
    type PipelineDefinitionForm,
    type PipelineDefinitionRow,
  } from '@/api/system'
  import { useSseAutoReload } from '@/composables/useSseAutoReload'
  import OpsListToolbar from '@/components/table/OpsListToolbar.vue'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useRoute, useRouter } from 'vue-router'
  import { useDrawerAutoClose } from '@/composables/useDrawerAutoClose'
  import { useAsyncAction } from '@/composables/useAsyncAction'
  import { instanceApi } from '@/api/instance'
  import { fetchPipelineStages, fetchStepImpls, type PipelineStagesMap } from '@/api/pipelineMeta'
  import { fmtDatetime } from '@/utils/datetime'
  import StatusTag from '@/components/common/StatusTag.vue'
  import type { ConsoleJobInstanceResponse } from '@/types/console-api'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import { usePermission } from '@/composables/usePermission'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'

  const { canMutateConfig } = usePermission()
  const tenant = useTenantStore()
  const formRef = ref<FormInstance>()
  const loading = ref(false)
  const loadError = ref<unknown>(null)
  const { filterBusy, tableBlocking, runSearch, runReset, runRefresh } =
    useListFilterFeedback(loading)
  // 9-stages 字典 + step impl 字典(BE 维护,FE 首次加载缓存。两个接口都 permitAll-style 缓存稳)
  const stagesMap = ref<PipelineStagesMap>({})
  // stepImplOptions 按当前 pipelineType 拉(BE /meta/step-impls?module=IMPORT),
  // 而不是混所有 type 的 impl —— 之前 EXPORT pipeline 能看到 ImportXxxStep 是 bug
  const stepImplOptions = ref<string[]>([])
  // 高级:仅同 (type,stage) 注册多 impl 时(A/B / 自定义 worker)用户才会主动展开 override
  const implEditOpen = ref<Set<number>>(new Set())
  function toggleImplEdit(i: number) {
    const next = new Set(implEditOpen.value)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    implEditOpen.value = next
  }
  /** 该 stage 卡片可选的 impl:命名含 stage 名(ExportPrepareStep 匹配 PREPARE),命名不含的不展示 */
  function implsForStage(stage: string): string[] {
    if (!stage) return stepImplOptions.value
    const needle = stage.toLowerCase()
    const matched = stepImplOptions.value.filter((c) => c.toLowerCase().includes(needle))
    // 命名不规范时 fallback 露当前 module 全部 impl,不要让下拉空白
    return matched.length > 0 ? matched : stepImplOptions.value
  }
  /** 选 stage 后挑唯一匹配的 impl 自动填 */
  function pickDefaultImpl(stage: string): string {
    const matches = implsForStage(stage)
    return matches.length === 1 ? matches[0] : ''
  }
  /** 按当前 pipelineType 拉 impl 字典 —— 没选 type 时拉全量(用于初次 mount 没数据可看) */
  function reloadStepImpls(module?: string) {
    fetchStepImpls(module)
      .then((list) => (stepImplOptions.value = list || []))
      .catch(() => {})
  }
  onMounted(() => {
    fetchPipelineStages()
      .then((m) => (stagesMap.value = m || {}))
      .catch(() => {})
    reloadStepImpls()
  })

  const togglingId = ref<number | null>(null)
  const rows = ref<PipelineDefinitionRow[]>([])
  const allRows = ref<PipelineDefinitionRow[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(15)
  // 深链:WorkflowMermaidViewer 点 pipeline 节点跳转 /jobs/pipelines?pipelineCode=X,
  // 用该 code 预填关键字过滤(queryKeyword 命中 pipelineCode),落地即定位到目标流水线。
  const route = useRoute()
  const keyword = ref(typeof route.query.pipelineCode === 'string' ? route.query.pipelineCode : '')
  const pipelineType = ref('')
  const enabledFilter = ref<boolean | undefined>()
  const hasActiveFilters = computed(
    () => !!(keyword.value.trim() || pipelineType.value.trim() || enabledFilter.value != null),
  )
  const drawerVisible = ref(false)

  // ── Run-centric 详情抽屉(P2 对称) ─────
  const router = useRouter()
  const detailVisible = ref(false)
  useDrawerAutoClose([drawerVisible, detailVisible])
  const detailRow = ref<PipelineDefinitionRow | null>(null)
  const activeDetailTab = ref<'overview' | 'runs'>('overview')
  const detailRunsRows = ref<ConsoleJobInstanceResponse[]>([])
  const detailRunsLoading = ref(false)
  const detailRunsLoadedFor = ref('')

  // Pipeline 在 BE 落到 job_instance 表(pipelineCode == jobCode);用 instanceApi.list 拉
  async function loadDetailRuns() {
    const def = detailRow.value
    if (!def?.pipelineCode || detailRunsLoadedFor.value === def.pipelineCode) return
    detailRunsLoading.value = true
    try {
      const pageResult = await instanceApi.list({
        tenantId: def.tenantId ?? tenant.tenantId,
        jobCode: def.pipelineCode,
        page: 1,
        pageSize: 15,
      })
      detailRunsRows.value = pageResult.records ?? []
      detailRunsLoadedFor.value = def.pipelineCode
    } catch {
      detailRunsRows.value = []
    } finally {
      detailRunsLoading.value = false
    }
  }

  function openDetail(row: PipelineDefinitionRow, initialTab: 'overview' | 'runs') {
    detailRow.value = row
    detailRunsRows.value = []
    detailRunsLoadedFor.value = ''
    activeDetailTab.value = initialTab
    detailVisible.value = true
    if (initialTab === 'runs') void loadDetailRuns()
  }

  function goJobInstance(row: ConsoleJobInstanceResponse) {
    void router.push(`/monitor/job-instances/${row.id}`)
  }

  function goInstancesFiltered(pipelineCode: string) {
    // 同 JobDefinitionList.goInstances:看的是该 pipeline 的全部历史实例,清掉今日锚定
    void router.push({
      path: '/monitor/job-instances',
      query: { jobCode: pipelineCode, range: 'all' },
    })
  }

  watch(activeDetailTab, (tab) => {
    if (tab === 'runs') void loadDetailRuns()
  })
  const editingId = ref<number | null>(null)
  const form = ref<PipelineDefinitionForm>({
    tenantId: '',
    pipelineCode: '',
    pipelineName: '',
    pipelineType: '',
    enabled: true,
    description: '',
  })
  const steps = ref<
    Array<{
      stepCode: string
      stepName: string
      stageCode: string
      stepType: string
      description: string
    }>
  >([])

  const queryKeyword = computed(() => keyword.value.trim().toLowerCase())
  const drawerTitle = computed(() =>
    editingId.value == null
      ? t('pipelineDefinitionList.drawerCreateTitle')
      : t('pipelineDefinitionList.drawerEditTitle'),
  )
  const pipelineTypeOptions = computed(() =>
    Array.from(
      new Set(
        allRows.value.map((row) => row.pipelineType).filter((item): item is string => !!item),
      ),
    ),
  )

  const formRules: FormRules = {
    tenantId: [
      { required: true, message: t('pipelineDefinitionList.ruleTenantId'), trigger: 'blur' },
    ],
    pipelineCode: [
      { required: true, message: t('pipelineDefinitionList.rulePipelineCode'), trigger: 'blur' },
      {
        pattern: /^[a-zA-Z0-9_-]+$/,
        message: t('pipelineDefinitionList.rulePipelineCodePattern'),
        trigger: 'blur',
      },
    ],
    pipelineName: [
      { required: true, message: t('pipelineDefinitionList.rulePipelineName'), trigger: 'blur' },
    ],
    pipelineType: [
      { required: true, message: t('pipelineDefinitionList.rulePipelineType'), trigger: 'blur' },
    ],
  }

  function resetForm() {
    form.value = {
      tenantId: tenant.tenantId,
      pipelineCode: '',
      pipelineName: '',
      pipelineType: '',
      enabled: true,
      description: '',
    }
    steps.value = []
  }

  function onQueryBarSearch() {
    return runSearch(async () => {
      page.value = 1
      await load()
    })
  }

  function onQueryBarReset() {
    return runReset(async () => {
      keyword.value = ''
      pipelineType.value = ''
      enabledFilter.value = undefined
      page.value = 1
      await load()
    })
  }

  async function load() {
    loadError.value = null
    // admin 多租户:未选当前租户时 tenantId 为空,直接返回空态;
    // 否则会发 tenantId= 的请求,BE 返 400「租户参数缺失」,异常冒泡导致组件渲染崩溃。
    if (!tenant.tenantId) {
      allRows.value = []
      rows.value = []
      total.value = 0
      return
    }
    loading.value = true
    try {
      const pr = await queryPipelineDefinitions(tenant.tenantId, 1, 200)
      allRows.value = pr.items
      const filtered = queryKeyword.value
        ? pr.items.filter((row) =>
            `${row.pipelineCode} ${row.pipelineName} ${row.pipelineType}`
              .toLowerCase()
              .includes(queryKeyword.value),
          )
        : pr.items
      const refined = filtered.filter((row) => {
        if (pipelineType.value.trim() && !row.pipelineType?.includes(pipelineType.value.trim())) {
          return false
        }
        if (enabledFilter.value != null && row.enabled !== enabledFilter.value) return false
        return true
      })
      total.value = refined.length
      const start = (page.value - 1) * pageSize.value
      rows.value = refined.slice(start, start + pageSize.value)
    } catch (e) {
      // 加载失败兜底:置 loadError,让 ProTable 渲染错误面板(:error / :on-retry 已绑定),
      // 避免异常向上冒泡触发 Vue 渲染错误(整页「组件渲染异常」)。
      loadError.value = e
      allRows.value = []
      rows.value = []
      total.value = 0
    } finally {
      loading.value = false
      live.markRefreshed()
    }
  }

  function openCreate() {
    editingId.value = null
    resetForm()
    drawerVisible.value = true
    formRef.value?.clearValidate()
  }

  async function openEdit(row: PipelineDefinitionRow) {
    formRef.value?.clearValidate()
    const detail = await queryPipelineDefinitionDetail(tenant.tenantId, row.id)
    const obj = detail as Record<string, unknown>
    editingId.value = row.id
    form.value = {
      tenantId: String(obj.tenantId ?? row.tenantId ?? tenant.tenantId),
      // BE PipelineDefinitionDetailResponse 字段是 jobCode,本地 form 沿用 pipelineCode 名
      pipelineCode: String(obj.jobCode ?? obj.pipelineCode ?? row.pipelineCode ?? ''),
      pipelineName: String(obj.pipelineName ?? row.pipelineName ?? ''),
      pipelineType: String(obj.pipelineType ?? row.pipelineType ?? ''),
      enabled: Boolean(obj.enabled ?? row.enabled),
      description: String(obj.description ?? row.description ?? ''),
    }
    steps.value = Array.isArray(obj.steps)
      ? obj.steps.map((item) => {
          const step = item as Record<string, unknown>
          return {
            stepCode: String(step.stepCode ?? ''),
            stageCode: String(step.stageCode ?? ''),
            // BE StepResponse: stepName / implCode;本地编辑模型用 description / stepType 兼容历史模板
            stepName: String(step.stepName ?? ''),
            stepType: String(step.implCode ?? step.stepType ?? ''),
            description: String(step.description ?? ''),
          }
        })
      : []
    drawerVisible.value = true
  }

  // useAsyncAction:连点抗抖,完成后 300ms 内 :loading 仍 true,
  // 防止用户在 drawer 收起动画期间二次提交触发重复 create/update
  const submitAction = useAsyncAction(
    async () => {
      const payload = {
        tenantId: form.value.tenantId || tenant.tenantId,
        // BE PipelineDefinitionSaveRequest 必填 jobCode(@NotBlank);本地 form pipelineCode 翻译过去
        jobCode: form.value.pipelineCode,
        pipelineName: form.value.pipelineName,
        pipelineType: form.value.pipelineType,
        enabled: form.value.enabled,
        description: form.value.description,
        steps: steps.value
          .filter((item) => item.stepCode || item.stageCode || item.stepType || item.description)
          .map((item, index) => ({
            stepCode: item.stepCode,
            // BE StepItem 必填 stepName + implCode;UI 暂时用 description 当 stepName,stepType 当 implCode
            stepName: item.stepName || item.description || item.stepCode,
            stageCode: item.stageCode,
            implCode: item.stepType,
            stepOrder: index + 1,
          })),
      }
      const isCreate = editingId.value == null
      if (isCreate) await createPipelineDefinition(payload)
      else await updatePipelineDefinition(editingId.value!, payload)
      ElMessage.success(
        t('pipelineDefinitionList.saveSuccess', {
          action: isCreate
            ? t('pipelineDefinitionList.actionCreate')
            : t('pipelineDefinitionList.actionUpdate'),
          code: form.value.pipelineCode,
        }),
      )
      drawerVisible.value = false
      await load()
    },
    { cooldownMs: 300 },
  )

  async function submitForm() {
    const valid = await formRef.value
      ?.validate()
      .catch((errors: Record<string, Array<{ message?: string }>> | unknown) => {
        ElMessage.warning(t('pipelineDefinitionList.checkRequired'))
        // 自动滚到首个错误字段:大表单时用户看不到错误位置
        const firstField =
          errors && typeof errors === 'object' ? Object.keys(errors as object)[0] : null
        if (firstField) formRef.value?.scrollToField(firstField)
        return false
      })
    if (!valid) return
    await submitAction.run()
  }

  async function toggle(row: PipelineDefinitionRow) {
    if (!row.id) return
    const target = !row.enabled
    try {
      const action = target
        ? t('pipelineDefinitionList.enable')
        : t('pipelineDefinitionList.disable')
      await ElMessageBox.confirm(
        t('pipelineDefinitionList.toggleConfirmText', { code: row.pipelineCode, action }),
        t('pipelineDefinitionList.toggleConfirmTitle'),
        { type: 'warning' },
      )
    } catch {
      return
    }
    togglingId.value = row.id
    try {
      await togglePipelineDefinition(row.id, tenant.tenantId, target)
      row.enabled = target
      const action = target
        ? t('pipelineDefinitionList.enable')
        : t('pipelineDefinitionList.disable')
      ElMessage.success(
        t('pipelineDefinitionList.toggleSuccess', { action, code: row.pipelineCode }),
      )
    } finally {
      togglingId.value = null
    }
  }

  /**
   * Pipeline 是固定模板:type 决定固定的 stage 序列(STAGES_BY_TYPE 白名单)。
   * pipelineType 变化时按 stagesMap[type] 重渲 stage 卡片,保留同 stageCode 已有定制(name / impl / desc)。
   */
  function regenerateStepsForType(newType: string) {
    if (!newType) {
      steps.value = []
      return
    }
    const stageList = stagesMap.value[newType] ?? []
    if (stageList.length === 0) return
    const existingByStage = new Map(steps.value.map((s) => [s.stageCode, s]))
    steps.value = stageList.map((stage) => {
      const existing = existingByStage.get(stage)
      if (existing) return existing
      return {
        stepCode: `${newType}_${stage}`,
        stepName: '',
        stageCode: stage,
        stepType: pickDefaultImpl(stage),
        description: '',
      }
    })
  }
  watch(
    () => form.value.pipelineType,
    (newType) => {
      // 切 type 时同步切 impl 字典:只显该 type 注册的 impl,避免下拉串味
      reloadStepImpls(newType || undefined)
      regenerateStepsForType(newType)
    },
  )
  // 字典异步到位后,若已选 type 但 steps 是空(字典还没到时 watch 跑过一遍),补渲一次
  watch(stagesMap, () => {
    if (form.value.pipelineType && steps.value.length === 0) {
      regenerateStepsForType(form.value.pipelineType)
    }
  })

  watch([keyword, pipelineType, enabledFilter, page, pageSize], () => load())

  const live = useSseAutoReload({
    domain: 'pipeline-definitions',
    reload: load,
    scope: () => tenant.tenantId,
    // 未选当前租户(admin 多租户)时不开 SSE,避免 events?tenantId= 触发 500
    enabled: computed(() => !!tenant.tenantId),
  })

  useTenantReload(() => {
    resetForm()
    void load()
  })
</script>

<style scoped>
  .drawer-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }

  .detail-runs-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-sm);
    font-size: 13px;
    color: var(--color-text-secondary);
  }

  :deep(.el-table__row) {
    cursor: pointer;
  }

  /* Pipeline flow:固定模板渲染,卡片列竖排 + 箭头连接,跟领域模型对齐(不可加减、不可拖) */
  .pipeline-flow {
    width: 100%;
  }
  .pipeline-flow__hint {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 12px;
    padding: 8px 12px;
    background: var(--color-bg-subtle, #f5f7fa);
    border-radius: 6px;
    font-size: 12px;
    color: var(--color-text-secondary);
  }
  .pipeline-flow__list {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .pipeline-flow__connector {
    display: flex;
    justify-content: center;
    padding: 2px 0;
  }
  .pipeline-flow__arrow {
    font-size: 18px;
    color: var(--color-text-secondary);
    opacity: 0.6;
    line-height: 1;
  }
  .stage-card {
    display: flex;
    align-items: stretch;
    gap: 12px;
    padding: 12px;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-card-lg, 8px);
    background: var(--color-bg-card, #fff);
    transition: box-shadow 0.15s ease;
  }
  .stage-card:hover {
    box-shadow: var(--shadow-surface-hover);
  }
  .stage-card__icon {
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
  }
  .stage-card__main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .stage-card__head {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .stage-card__index {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--color-bg-subtle, #f5f7fa);
    font-size: 11px;
    color: var(--color-text-secondary);
    font-weight: 600;
  }
  .stage-card__stage {
    font-weight: 700;
    font-size: 14px;
    color: var(--color-text-primary);
    letter-spacing: 0.5px;
  }
  .stage-card__sub {
    font-size: 12px;
    color: var(--color-text-secondary);
  }
  .stage-card__impl {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--color-text-secondary);
  }
  .stage-card__impl code {
    font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    background: var(--color-bg-subtle, #f5f7fa);
    padding: 1px 6px;
    border-radius: 4px;
    color: var(--color-text-primary);
  }
  .stage-card__row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
    gap: 8px;
  }
  @media (max-width: 720px) {
    .stage-card__row {
      grid-template-columns: 1fr;
    }
  }
  .stage-card__impl-override {
    margin-left: 4px !important;
    padding: 0 4px !important;
    height: auto !important;
    font-size: 12px;
    color: var(--color-text-secondary);
  }
  .stage-card__impl-edit {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: var(--color-bg-subtle, #f5f7fa);
    border-radius: 6px;
    margin-top: 4px;
  }
  .stage-card__impl-edit-label {
    font-size: 12px;
    color: var(--color-text-secondary);
    white-space: nowrap;
  }
</style>
