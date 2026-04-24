<template>
  <PageContainer>
    <PageHeader
      title="可观测性查询"
      description="Dead Letters、重试调度、执行日志、Channel 回执查询。"
    />

    <SectionCard>
      <el-tabs
        v-model="activeTab"
        v-hover-tab-activate="true"
        class="pill-tabs"
        @tab-change="onTabChange"
      >
        <!-- Dead Letters -->
        <el-tab-pane label="Dead Letters" name="deadLetters">
          <ListPageQueryBar
            :filter-busy="false"
            :refresh-busy="loadingDL"
            @search="
              () => {
                dlApplied.sourceType = dlDraft.sourceType.trim()
                dlApplied.sourceId = dlDraft.sourceId.trim()
                dlApplied.keyword = dlDraft.keyword.trim()
                dlPage = 1
              }
            "
            @reset="
              () => {
                dlDraft.sourceType = ''
                dlDraft.sourceId = ''
                dlDraft.keyword = ''
                dlApplied.sourceType = ''
                dlApplied.sourceId = ''
                dlApplied.keyword = ''
                dlPage = 1
              }
            "
            @refresh="loadDeadLetters"
          >
            <el-form-item label="来源类型">
              <el-select
                class="query-w-180"
                v-model="dlDraft.sourceType"
                clearable
                filterable
                placeholder="全部"
              >
                <el-option
                  v-for="opt in dlSourceTypeOptions"
                  :key="opt"
                  :label="opt"
                  :value="opt"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="来源 ID">
              <el-input
                class="query-w-200"
                v-model="dlDraft.sourceId"
                clearable
                placeholder="精确匹配"
                @keyup.enter="
                  () => {
                    dlApplied.sourceType = dlDraft.sourceType.trim()
                    dlApplied.sourceId = dlDraft.sourceId.trim()
                    dlApplied.keyword = dlDraft.keyword.trim()
                    dlPage = 1
                  }
                "
              />
            </el-form-item>
            <el-form-item label="关键字">
              <el-input
                class="query-w-220"
                v-model="dlDraft.keyword"
                clearable
                placeholder="原因 / 状态 模糊匹配"
                @keyup.enter="
                  () => {
                    dlApplied.sourceType = dlDraft.sourceType.trim()
                    dlApplied.sourceId = dlDraft.sourceId.trim()
                    dlApplied.keyword = dlDraft.keyword.trim()
                    dlPage = 1
                  }
                "
              />
            </el-form-item>
          </ListPageQueryBar>
          <el-table
            :data="pagedDL.records"
            stripe
            border
            empty-text="暂无数据"
            size="small"
            class="console-table"
          >
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="sourceType" label="来源类型" width="120" />
            <el-table-column prop="sourceId" label="来源 ID" width="100" />
            <el-table-column
              prop="deadLetterReason"
              label="原因"
              min-width="250"
              show-overflow-tooltip
            />
            <DatetimeColumn prop="createdAt" label="失败时间" width="160" />
            <el-table-column prop="replayCount" label="重试次数" width="90" />
            <el-table-column prop="replayStatus" label="状态" width="100" />
            <el-table-column label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <div class="table-actions">
                  <el-button
                    size="small"
                    plain
                    type="primary"
                    @click="openDetail('deadLetters', row)"
                  >
                    详情
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <TablePagerBar
            :page="dlPage"
            :page-size="dlPageSize"
            :total="pagedDL.total"
            @update:page="(p: number) => (dlPage = p)"
            @update:page-size="
              (s: number) => {
                dlPageSize = s
                dlPage = 1
              }
            "
          />
        </el-tab-pane>

        <!-- Retries -->
        <el-tab-pane label="重试调度" name="retries">
          <ListPageQueryBar
            :filter-busy="false"
            :refresh-busy="loadingRetry"
            @search="
              () => {
                retryApplied.relatedType = retryDraft.relatedType.trim()
                retryApplied.relatedId = retryDraft.relatedId.trim()
                retryApplied.status = retryDraft.status.trim()
                retryPage = 1
              }
            "
            @reset="
              () => {
                retryDraft.relatedType = ''
                retryDraft.relatedId = ''
                retryDraft.status = ''
                retryApplied.relatedType = ''
                retryApplied.relatedId = ''
                retryApplied.status = ''
                retryPage = 1
              }
            "
            @refresh="loadRetries"
          >
            <el-form-item label="关联类型">
              <el-select
                class="query-w-180"
                v-model="retryDraft.relatedType"
                clearable
                filterable
                placeholder="全部"
              >
                <el-option
                  v-for="opt in retryRelatedTypeOptions"
                  :key="opt"
                  :label="opt"
                  :value="opt"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="关联 ID">
              <el-input
                class="query-w-200"
                v-model="retryDraft.relatedId"
                clearable
                placeholder="精确匹配"
                @keyup.enter="
                  () => {
                    retryApplied.relatedType = retryDraft.relatedType.trim()
                    retryApplied.relatedId = retryDraft.relatedId.trim()
                    retryApplied.status = retryDraft.status.trim()
                    retryPage = 1
                  }
                "
              />
            </el-form-item>
            <el-form-item label="状态">
              <el-select
                class="query-w-180"
                v-model="retryDraft.status"
                clearable
                filterable
                placeholder="全部"
              >
                <el-option v-for="opt in retryStatusOptions" :key="opt" :label="opt" :value="opt" />
              </el-select>
            </el-form-item>
          </ListPageQueryBar>
          <el-table
            :data="pagedRetries.records"
            stripe
            border
            empty-text="暂无数据"
            size="small"
            class="console-table"
          >
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="relatedType" label="关联类型" width="120" />
            <el-table-column prop="relatedId" label="关联 ID" width="100" />
            <el-table-column prop="retryStatus" label="状态" width="120" />
            <DatetimeColumn prop="nextRetryAt" label="下次重试" width="160" />
            <el-table-column prop="retryCount" label="重试次数" width="90" />
            <el-table-column prop="maxRetryCount" label="最大重试" width="90" />
            <DatetimeColumn prop="createdAt" label="创建时间" width="160" />
            <el-table-column label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <div class="table-actions">
                  <el-button size="small" plain type="primary" @click="openDetail('retries', row)">
                    详情
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <TablePagerBar
            :page="retryPage"
            :page-size="retryPageSize"
            :total="pagedRetries.total"
            @update:page="(p: number) => (retryPage = p)"
            @update:page-size="
              (s: number) => {
                retryPageSize = s
                retryPage = 1
              }
            "
          />
        </el-tab-pane>

        <!-- Execution Logs -->
        <el-tab-pane label="执行日志" name="executionLogs">
          <ListPageQueryBar
            :filter-busy="false"
            :refresh-busy="loadingExec"
            @search="
              () => {
                execApplied.operationType = execDraft.operationType.trim()
                execApplied.result = execDraft.result.trim()
                execApplied.traceId = execDraft.traceId.trim()
                execPage = 1
              }
            "
            @reset="
              () => {
                execDraft.operationType = ''
                execDraft.result = ''
                execDraft.traceId = ''
                execApplied.operationType = ''
                execApplied.result = ''
                execApplied.traceId = ''
                execPage = 1
              }
            "
            @refresh="loadExecutionLogs"
          >
            <el-form-item label="操作类型">
              <el-select
                class="query-w-200"
                v-model="execDraft.operationType"
                clearable
                filterable
                placeholder="全部"
              >
                <el-option
                  v-for="opt in execOperationTypeOptions"
                  :key="opt"
                  :label="opt"
                  :value="opt"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="结果">
              <el-select
                class="query-w-180"
                v-model="execDraft.result"
                clearable
                filterable
                placeholder="全部"
              >
                <el-option v-for="opt in execResultOptions" :key="opt" :label="opt" :value="opt" />
              </el-select>
            </el-form-item>
            <el-form-item label="Trace">
              <el-input
                class="query-w-220"
                v-model="execDraft.traceId"
                clearable
                placeholder="模糊匹配"
                @keyup.enter="
                  () => {
                    execApplied.operationType = execDraft.operationType.trim()
                    execApplied.result = execDraft.result.trim()
                    execApplied.traceId = execDraft.traceId.trim()
                    execPage = 1
                  }
                "
              />
            </el-form-item>
          </ListPageQueryBar>
          <el-table
            :data="pagedExec.records"
            stripe
            border
            empty-text="暂无数据"
            size="small"
            class="console-table"
          >
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="operationType" label="操作类型" width="140" />
            <el-table-column prop="operationResult" label="结果" width="100" />
            <el-table-column prop="operatorId" label="操作人" width="140" show-overflow-tooltip />
            <el-table-column
              prop="detailSummary"
              label="摘要"
              min-width="300"
              show-overflow-tooltip
            />
            <el-table-column prop="traceId" label="Trace ID" width="180" show-overflow-tooltip />
            <DatetimeColumn prop="createdAt" label="时间" width="160" />
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{ row }">
                <div class="table-actions">
                  <el-button
                    size="small"
                    plain
                    type="primary"
                    @click="openDetail('executionLogs', row)"
                  >
                    详情
                  </el-button>
                  <el-button
                    v-if="row.traceId"
                    size="small"
                    plain
                    type="info"
                    @click="goTrace(String(row.traceId))"
                  >
                    Trace
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <TablePagerBar
            :page="execPage"
            :page-size="execPageSize"
            :total="pagedExec.total"
            @update:page="(p: number) => (execPage = p)"
            @update:page-size="
              (s: number) => {
                execPageSize = s
                execPage = 1
              }
            "
          />
        </el-tab-pane>

        <!-- Channel Receipts -->
        <el-tab-pane label="Channel 回执" name="channelReceipts">
          <ListPageQueryBar
            :filter-busy="false"
            :refresh-busy="loadingReceipts"
            @search="
              () => {
                receiptApplied.channelCode = receiptDraft.channelCode.trim()
                receiptApplied.fileId = receiptDraft.fileId.trim()
                receiptApplied.status = receiptDraft.status.trim()
                receiptPage = 1
              }
            "
            @reset="
              () => {
                receiptDraft.channelCode = ''
                receiptDraft.fileId = ''
                receiptDraft.status = ''
                receiptApplied.channelCode = ''
                receiptApplied.fileId = ''
                receiptApplied.status = ''
                receiptPage = 1
              }
            "
            @refresh="loadChannelReceipts"
          >
            <el-form-item label="渠道">
              <el-input
                class="query-w-220"
                v-model="receiptDraft.channelCode"
                clearable
                placeholder="模糊匹配"
                @keyup.enter="
                  () => {
                    receiptApplied.channelCode = receiptDraft.channelCode.trim()
                    receiptApplied.fileId = receiptDraft.fileId.trim()
                    receiptApplied.status = receiptDraft.status.trim()
                    receiptPage = 1
                  }
                "
              />
            </el-form-item>
            <el-form-item label="文件 ID">
              <el-input
                class="query-w-200"
                v-model="receiptDraft.fileId"
                clearable
                placeholder="精确匹配"
                @keyup.enter="
                  () => {
                    receiptApplied.channelCode = receiptDraft.channelCode.trim()
                    receiptApplied.fileId = receiptDraft.fileId.trim()
                    receiptApplied.status = receiptDraft.status.trim()
                    receiptPage = 1
                  }
                "
              />
            </el-form-item>
            <el-form-item label="回执状态">
              <el-select
                class="query-w-180"
                v-model="receiptDraft.status"
                clearable
                filterable
                placeholder="全部"
              >
                <el-option
                  v-for="opt in receiptStatusOptions"
                  :key="opt"
                  :label="opt"
                  :value="opt"
                />
              </el-select>
            </el-form-item>
          </ListPageQueryBar>
          <el-table
            :data="pagedReceipts.records"
            stripe
            border
            empty-text="暂无数据"
            size="small"
            class="console-table"
          >
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column
              prop="channelCode"
              label="渠道"
              min-width="160"
              show-overflow-tooltip
            />
            <el-table-column prop="fileId" label="文件 ID" width="100" />
            <el-table-column prop="dispatchStatus" label="投递状态" width="100" />
            <el-table-column prop="receiptStatus" label="回执状态" width="100" />
            <el-table-column
              prop="errorMessage"
              label="错误信息"
              min-width="250"
              show-overflow-tooltip
            />
            <DatetimeColumn prop="dispatchedAt" label="投递时间" width="160" />
            <el-table-column label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <div class="table-actions">
                  <el-button
                    size="small"
                    plain
                    type="primary"
                    @click="openDetail('channelReceipts', row)"
                  >
                    详情
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <TablePagerBar
            :page="receiptPage"
            :page-size="receiptPageSize"
            :total="pagedReceipts.total"
            @update:page="(p: number) => (receiptPage = p)"
            @update:page-size="
              (s: number) => {
                receiptPageSize = s
                receiptPage = 1
              }
            "
          />
        </el-tab-pane>
      </el-tabs>
    </SectionCard>

    <el-drawer v-model="detailVisible" :title="detailTitle" size="720px">
      <div v-if="detailRow" class="detail-drawer">
        <div class="detail-drawer__meta">
          <div v-if="detailMeta.primaryLabel" class="detail-drawer__meta-row">
            <span class="detail-drawer__label">{{ detailMeta.primaryLabel }}</span>
            <CopyableText :text="detailMeta.primaryValue" />
          </div>
          <div v-if="detailMeta.secondaryLabel" class="detail-drawer__meta-row">
            <span class="detail-drawer__label">{{ detailMeta.secondaryLabel }}</span>
            <CopyableText :text="detailMeta.secondaryValue" />
          </div>
          <div v-if="detailMeta.tertiaryLabel" class="detail-drawer__meta-row">
            <span class="detail-drawer__label">{{ detailMeta.tertiaryLabel }}</span>
            <CopyableText :text="detailMeta.tertiaryValue" />
          </div>
        </div>
        <pre class="json-preview">{{ detailJson }}</pre>
      </div>
    </el-drawer>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, computed, reactive } from 'vue'
  import { useRouter } from 'vue-router'
  import {
    queryDeadLetters,
    queryRetries,
    queryExecutionLogs,
    queryChannelReceipts,
  } from '@/api/observabilityQueries'
  import { toPageResult } from '@/api/adapters'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import TablePagerBar from '@/components/table/TablePagerBar.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import CopyableText from '@/components/common/CopyableText.vue'

  const tenant = useTenantStore()
  const router = useRouter()
  const activeTab = ref('deadLetters')

  const loadingDL = ref(false)
  const loadingRetry = ref(false)
  const loadingExec = ref(false)
  const loadingReceipts = ref(false)

  const dlDraft = reactive({ sourceType: '', sourceId: '', keyword: '' })
  const dlApplied = reactive({ sourceType: '', sourceId: '', keyword: '' })
  const retryDraft = reactive({ relatedType: '', relatedId: '', status: '' })
  const retryApplied = reactive({ relatedType: '', relatedId: '', status: '' })
  const execDraft = reactive({ operationType: '', result: '', traceId: '' })
  const execApplied = reactive({ operationType: '', result: '', traceId: '' })
  const receiptDraft = reactive({ channelCode: '', fileId: '', status: '' })
  const receiptApplied = reactive({ channelCode: '', fileId: '', status: '' })

  const detailVisible = ref(false)
  const detailTab = ref<'deadLetters' | 'retries' | 'executionLogs' | 'channelReceipts'>(
    'deadLetters',
  )
  const detailRow = ref<Record<string, unknown> | null>(null)
  const detailTitle = computed(() => {
    if (detailTab.value === 'deadLetters') return 'Dead Letter 详情'
    if (detailTab.value === 'retries') return '重试调度详情'
    if (detailTab.value === 'executionLogs') return '执行日志详情'
    return 'Channel 回执详情'
  })

  const detailJson = computed(() => {
    if (!detailRow.value) return ''
    try {
      return JSON.stringify(detailRow.value, null, 2)
    } catch {
      return String(detailRow.value)
    }
  })

  function pickString(row: Record<string, unknown>, key: string): string {
    const v = row[key]
    if (v == null) return ''
    return typeof v === 'string' ? v : String(v)
  }

  const detailMeta = computed(() => {
    const r = detailRow.value ?? {}
    if (detailTab.value === 'deadLetters') {
      return {
        primaryLabel: '来源类型',
        primaryValue: pickString(r, 'sourceType'),
        secondaryLabel: '来源 ID',
        secondaryValue: pickString(r, 'sourceId'),
        tertiaryLabel: '状态',
        tertiaryValue: pickString(r, 'replayStatus'),
      }
    }
    if (detailTab.value === 'retries') {
      return {
        primaryLabel: '关联类型',
        primaryValue: pickString(r, 'relatedType'),
        secondaryLabel: '关联 ID',
        secondaryValue: pickString(r, 'relatedId'),
        tertiaryLabel: '状态',
        tertiaryValue: pickString(r, 'retryStatus'),
      }
    }
    if (detailTab.value === 'executionLogs') {
      return {
        primaryLabel: '操作类型',
        primaryValue: pickString(r, 'operationType'),
        secondaryLabel: '结果',
        secondaryValue: pickString(r, 'operationResult'),
        tertiaryLabel: 'Trace',
        tertiaryValue: pickString(r, 'traceId'),
      }
    }
    return {
      primaryLabel: '渠道',
      primaryValue: pickString(r, 'channelCode'),
      secondaryLabel: '文件 ID',
      secondaryValue: pickString(r, 'fileId'),
      tertiaryLabel: '回执状态',
      tertiaryValue: pickString(r, 'receiptStatus'),
    }
  })

  function openDetail(
    tab: 'deadLetters' | 'retries' | 'executionLogs' | 'channelReceipts',
    row: Record<string, unknown>,
  ) {
    detailTab.value = tab
    detailRow.value = row
    detailVisible.value = true
  }

  function goTrace(traceId: string) {
    if (!traceId.trim()) return
    router.push({ path: '/logs', query: { traceId } })
  }

  const dlRows = ref<Record<string, unknown>[]>([])
  const dlPage = ref(1)
  const dlPageSize = ref(20)
  const dlSourceTypeOptions = computed(() =>
    Array.from(
      new Set(
        (dlRows.value || [])
          .map((x) => String(x.sourceType ?? '').trim())
          .filter((x) => x && x !== 'null' && x !== 'undefined'),
      ),
    ).sort(),
  )
  const filteredDL = computed(() => {
    let rows = dlRows.value || []
    const st = dlApplied.sourceType.trim()
    if (st) rows = rows.filter((x) => String(x.sourceType ?? '') === st)
    const sid = dlApplied.sourceId.trim()
    if (sid) rows = rows.filter((x) => String(x.sourceId ?? '') === sid)
    const k = dlApplied.keyword.trim().toLowerCase()
    if (k) {
      rows = rows.filter((x) => {
        const hay = `${x.deadLetterReason ?? ''} ${x.replayStatus ?? ''}`.toLowerCase()
        return hay.includes(k)
      })
    }
    return rows
  })
  const pagedDL = computed(() => toPageResult(filteredDL.value, dlPage.value, dlPageSize.value))

  const retryRows = ref<Record<string, unknown>[]>([])
  const retryPage = ref(1)
  const retryPageSize = ref(20)
  const retryRelatedTypeOptions = computed(() =>
    Array.from(
      new Set(
        (retryRows.value || [])
          .map((x) => String(x.relatedType ?? '').trim())
          .filter((x) => x && x !== 'null' && x !== 'undefined'),
      ),
    ).sort(),
  )
  const retryStatusOptions = computed(() =>
    Array.from(
      new Set(
        (retryRows.value || [])
          .map((x) => String(x.retryStatus ?? '').trim())
          .filter((x) => x && x !== 'null' && x !== 'undefined'),
      ),
    ).sort(),
  )
  const filteredRetries = computed(() => {
    let rows = retryRows.value || []
    const rt = retryApplied.relatedType.trim()
    if (rt) rows = rows.filter((x) => String(x.relatedType ?? '') === rt)
    const rid = retryApplied.relatedId.trim()
    if (rid) rows = rows.filter((x) => String(x.relatedId ?? '') === rid)
    const st = retryApplied.status.trim()
    if (st) rows = rows.filter((x) => String(x.retryStatus ?? '') === st)
    return rows
  })
  const pagedRetries = computed(() =>
    toPageResult(filteredRetries.value, retryPage.value, retryPageSize.value),
  )

  const execRows = ref<Record<string, unknown>[]>([])
  const execPage = ref(1)
  const execPageSize = ref(20)
  const execOperationTypeOptions = computed(() =>
    Array.from(
      new Set(
        (execRows.value || [])
          .map((x) => String(x.operationType ?? '').trim())
          .filter((x) => x && x !== 'null' && x !== 'undefined'),
      ),
    ).sort(),
  )
  const execResultOptions = computed(() =>
    Array.from(
      new Set(
        (execRows.value || [])
          .map((x) => String(x.operationResult ?? '').trim())
          .filter((x) => x && x !== 'null' && x !== 'undefined'),
      ),
    ).sort(),
  )
  const filteredExec = computed(() => {
    let rows = execRows.value || []
    const ot = execApplied.operationType.trim()
    if (ot) rows = rows.filter((x) => String(x.operationType ?? '') === ot)
    const res = execApplied.result.trim()
    if (res) rows = rows.filter((x) => String(x.operationResult ?? '') === res)
    const t = execApplied.traceId.trim().toLowerCase()
    if (t)
      rows = rows.filter((x) =>
        String(x.traceId ?? '')
          .toLowerCase()
          .includes(t),
      )
    return rows
  })
  const pagedExec = computed(() =>
    toPageResult(filteredExec.value, execPage.value, execPageSize.value),
  )

  const receiptRows = ref<Record<string, unknown>[]>([])
  const receiptPage = ref(1)
  const receiptPageSize = ref(20)
  const receiptStatusOptions = computed(() =>
    Array.from(
      new Set(
        (receiptRows.value || [])
          .map((x) => String(x.receiptStatus ?? '').trim())
          .filter((x) => x && x !== 'null' && x !== 'undefined'),
      ),
    ).sort(),
  )
  const filteredReceipts = computed(() => {
    let rows = receiptRows.value || []
    const cc = receiptApplied.channelCode.trim().toLowerCase()
    if (cc)
      rows = rows.filter((x) =>
        String(x.channelCode ?? '')
          .toLowerCase()
          .includes(cc),
      )
    const fid = receiptApplied.fileId.trim()
    if (fid) rows = rows.filter((x) => String(x.fileId ?? '') === fid)
    const st = receiptApplied.status.trim()
    if (st) rows = rows.filter((x) => String(x.receiptStatus ?? '') === st)
    return rows
  })
  const pagedReceipts = computed(() =>
    toPageResult(filteredReceipts.value, receiptPage.value, receiptPageSize.value),
  )

  async function loadDeadLetters() {
    loadingDL.value = true
    try {
      dlRows.value = (await queryDeadLetters(tenant.tenantId)) as Record<string, unknown>[]
    } catch {
      dlRows.value = []
    } finally {
      loadingDL.value = false
    }
  }

  async function loadRetries() {
    loadingRetry.value = true
    try {
      retryRows.value = (await queryRetries(tenant.tenantId)) as Record<string, unknown>[]
    } catch {
      retryRows.value = []
    } finally {
      loadingRetry.value = false
    }
  }

  async function loadExecutionLogs() {
    loadingExec.value = true
    try {
      execRows.value = (await queryExecutionLogs(tenant.tenantId)) as Record<string, unknown>[]
    } catch {
      execRows.value = []
    } finally {
      loadingExec.value = false
    }
  }

  async function loadChannelReceipts() {
    loadingReceipts.value = true
    try {
      receiptRows.value = (await queryChannelReceipts(tenant.tenantId)) as Record<string, unknown>[]
    } catch {
      receiptRows.value = []
    } finally {
      loadingReceipts.value = false
    }
  }

  function onTabChange(tab: string | number) {
    const name = String(tab)
    if (name === 'deadLetters' && !dlRows.value.length) void loadDeadLetters()
    if (name === 'retries' && !retryRows.value.length) void loadRetries()
    if (name === 'executionLogs' && !execRows.value.length) void loadExecutionLogs()
    if (name === 'channelReceipts' && !receiptRows.value.length) void loadChannelReceipts()
  }

  function loadAll() {
    dlPage.value = 1
    retryPage.value = 1
    execPage.value = 1
    receiptPage.value = 1
    void loadDeadLetters()
  }

  useTenantReload(loadAll)
</script>

<style scoped></style>
