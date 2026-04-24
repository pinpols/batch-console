<template>
  <PageContainer>
    <PageHeader
      title="自助服务"
      description="查看租户配额与用量，申请配额变更、Job 重跑与补偿。"
      :show-description="true"
    />

    <SectionCard>
      <el-tabs v-model="activeTab" v-hover-tab-activate="true" class="pill-tabs">
        <!-- 配额与用量 -->
        <el-tab-pane label="配额与用量" name="quota">
          <div class="data-panel">
            <div class="section-toolbar">
              <h3 class="section-title u-mb-0">当前配额</h3>
              <span class="u-flex-1" />
              <el-button :loading="loadingQuota" @click="loadQuota">刷新</el-button>
            </div>
            <pre v-if="quota" class="json-preview">{{ JSON.stringify(quota, null, 2) }}</pre>
            <el-empty v-else description="暂无配额数据" />
          </div>

          <div class="data-panel">
            <div class="section-toolbar">
              <h3 class="section-title u-mb-0">当前用量</h3>
              <span class="u-flex-1" />
              <el-button :loading="loadingUsage" @click="loadUsage">刷新</el-button>
            </div>
            <pre v-if="usage" class="json-preview">{{ JSON.stringify(usage, null, 2) }}</pre>
            <el-empty v-else description="暂无用量数据" />
          </div>
        </el-tab-pane>

        <!-- 配额变更申请 -->
        <el-tab-pane label="配额变更" name="quotaChange">
          <div class="form-panel">
            <el-form label-width="100px" class="form-section">
              <el-form-item label="配额键">
                <el-select
                  v-model="quotaForm.quotaKey"
                  filterable
                  placeholder="请选择配额键"
                  class="query-w-full"
                  :loading="quotaKeysLoading"
                >
                  <el-option v-for="k in quotaKeys" :key="k" :label="k" :value="k" />
                </el-select>
              </el-form-item>
              <el-form-item label="期望值">
                <el-input v-model="quotaForm.requestedValue" placeholder="请输入期望值" />
              </el-form-item>
              <el-form-item label="原因">
                <el-input
                  v-model="quotaForm.reason"
                  type="textarea"
                  :rows="3"
                  placeholder="变更原因"
                />
              </el-form-item>
              <el-form-item class="form-actions">
                <el-button
                  type="primary"
                  class="pretty-primary-button"
                  :loading="submittingQuota"
                  v-track-click="'配额变更申请'"
                  @click="submitQuotaChange"
                  >提交配额变更</el-button
                >
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>

        <!-- 重跑申请 -->
        <el-tab-pane label="重跑申请" name="rerun">
          <div class="form-panel">
            <el-form label-width="100px" class="form-section">
              <el-form-item label="Job Code">
                <el-select
                  v-model="rerunForm.jobCode"
                  filterable
                  remote
                  reserve-keyword
                  placeholder="请输入关键字搜索"
                  :remote-method="queryJobCodes"
                  :loading="jobCodeLoading"
                  @focus="loadDefaultJobCodes"
                  class="query-w-full"
                >
                  <el-option v-for="opt in jobCodeOptions" :key="opt" :label="opt" :value="opt" />
                </el-select>
              </el-form-item>
              <el-form-item label="业务日">
                <el-date-picker
                  v-model="rerunForm.bizDate"
                  type="date"
                  value-format="YYYY-MM-DD"
                  placeholder="选择日期"
                  class="query-w-full"
                />
              </el-form-item>
              <el-form-item label="目标实例号">
                <el-input v-model="rerunForm.targetInstanceNo" placeholder="可选" />
              </el-form-item>
              <el-form-item label="原因">
                <el-input
                  v-model="rerunForm.reason"
                  type="textarea"
                  :rows="3"
                  placeholder="重跑原因"
                />
              </el-form-item>
              <el-form-item class="form-actions">
                <el-button
                  type="primary"
                  class="pretty-primary-button"
                  :loading="rerunLoading"
                  v-track-click="'自助重跑申请'"
                  @click="submitRerun"
                  >提交重跑申请</el-button
                >
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>

        <!-- 补偿申请 -->
        <el-tab-pane label="补偿申请" name="compensation">
          <div class="form-panel">
            <el-form label-width="100px" class="form-section">
              <el-form-item label="Job Code">
                <el-select
                  v-model="compForm.jobCode"
                  filterable
                  remote
                  reserve-keyword
                  placeholder="请输入关键字搜索"
                  :remote-method="queryJobCodes"
                  :loading="jobCodeLoading"
                  @focus="loadDefaultJobCodes"
                  class="query-w-full"
                >
                  <el-option v-for="opt in jobCodeOptions" :key="opt" :label="opt" :value="opt" />
                </el-select>
              </el-form-item>
              <el-form-item label="业务日">
                <el-date-picker
                  v-model="compForm.bizDate"
                  type="date"
                  value-format="YYYY-MM-DD"
                  placeholder="选择日期"
                  class="query-w-full"
                />
              </el-form-item>
              <el-form-item label="补偿类型">
                <el-select
                  v-model="compForm.compensationType"
                  filterable
                  allow-create
                  default-first-option
                  clearable
                  placeholder="请选择（或输入自定义）"
                  class="query-w-full"
                >
                  <el-option
                    v-for="t in compensationTypeOptions"
                    :key="t.value"
                    :label="t.label"
                    :value="t.value"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="目标实例号">
                <el-input v-model="compForm.targetInstanceNo" placeholder="可选" />
              </el-form-item>
              <el-form-item label="原因">
                <el-input
                  v-model="compForm.reason"
                  type="textarea"
                  :rows="3"
                  placeholder="补偿原因"
                />
              </el-form-item>
              <el-form-item class="form-actions">
                <el-button
                  type="primary"
                  class="pretty-primary-button"
                  :loading="compLoading"
                  v-track-click="'自助补偿申请'"
                  @click="submitCompensation"
                  >提交补偿申请</el-button
                >
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>
      </el-tabs>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, reactive, watch } from 'vue'
  import { ElMessage } from 'element-plus'
  import { getTenantQuota, getTenantUsage, requestQuotaChange } from '@/api/tenantSelfService'
  import { selfServiceRerunRequest, selfServiceCompensationRequest } from '@/api/selfServiceJobs'
  import { jobApi } from '@/api/job'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'

  const tenant = useTenantStore()
  const activeTab = ref('quota')

  // ── 配额与用量 ──
  const loadingQuota = ref(false)
  const loadingUsage = ref(false)
  const quota = ref<unknown>(null)
  const usage = ref<unknown>(null)

  async function loadQuota() {
    loadingQuota.value = true
    try {
      quota.value = await getTenantQuota(tenant.tenantId)
    } catch {
      quota.value = null
    } finally {
      loadingQuota.value = false
    }
  }

  async function loadUsage() {
    loadingUsage.value = true
    try {
      usage.value = await getTenantUsage(tenant.tenantId)
    } catch {
      usage.value = null
    } finally {
      loadingUsage.value = false
    }
  }

  // ── 配额变更 ──
  const submittingQuota = ref(false)
  const quotaForm = reactive({ quotaKey: '', requestedValue: '', reason: '' })
  const quotaKeysLoading = ref(false)
  const quotaKeys = ref<string[]>([])

  function extractQuotaKeys(payload: unknown): string[] {
    const items = (payload as { items?: unknown })?.items
    if (!Array.isArray(items)) return []
    const keys = items
      .map((it) => {
        if (!it || typeof it !== 'object') return ''
        const anyIt = it as Record<string, unknown>
        return String((anyIt.policyCode ?? anyIt.field ?? anyIt.quotaKey ?? '') || '').trim()
      })
      .filter(Boolean)
    return Array.from(new Set(keys))
  }

  async function loadQuotaKeys() {
    if (quotaKeysLoading.value) return
    quotaKeysLoading.value = true
    try {
      const q = await getTenantQuota(tenant.tenantId)
      quotaKeys.value = extractQuotaKeys(q)
    } catch {
      quotaKeys.value = []
    } finally {
      quotaKeysLoading.value = false
    }
  }

  async function submitQuotaChange() {
    if (!quotaForm.quotaKey.trim()) {
      ElMessage.warning('配额键不能为空')
      return
    }
    const requestedValue = Number.parseInt(quotaForm.requestedValue.trim(), 10)
    if (!Number.isFinite(requestedValue) || requestedValue <= 0) {
      ElMessage.warning('期望值需为正整数')
      return
    }
    if (!quotaForm.reason.trim()) {
      ElMessage.warning('原因不能为空')
      return
    }
    submittingQuota.value = true
    try {
      await requestQuotaChange(tenant.tenantId, {
        field: quotaForm.quotaKey,
        requestedValue,
        reason: quotaForm.reason,
      })
      ElMessage.success('申请已提交')
      quotaForm.quotaKey = ''
      quotaForm.requestedValue = ''
      quotaForm.reason = ''
    } finally {
      submittingQuota.value = false
    }
  }

  // ── 重跑申请 ──
  const rerunLoading = ref(false)
  const rerunForm = reactive({ jobCode: '', bizDate: '', targetInstanceNo: '', reason: '' })

  const jobCodeLoading = ref(false)
  const jobCodeOptions = ref<string[]>([])

  async function loadDefaultJobCodes() {
    if (jobCodeLoading.value) return
    // 如果已经有候选项，就不重复拉取
    if (jobCodeOptions.value.length > 0) return
    jobCodeLoading.value = true
    try {
      const res = await jobApi.listDefinitionsPaged({
        tenantId: tenant.tenantId,
        pageNo: 1,
        pageSize: 30,
        enabled: true,
      })
      jobCodeOptions.value = Array.from(
        new Set(
          (res.records ?? [])
            .map((r) => r.jobCode)
            .filter((v): v is string => typeof v === 'string' && v),
        ),
      )
    } catch {
      jobCodeOptions.value = []
    } finally {
      jobCodeLoading.value = false
    }
  }

  async function queryJobCodes(keyword: string) {
    const q = keyword.trim()
    if (!q) {
      // 保留默认候选项；不清空，避免“点开没东西”的错觉
      return
    }
    jobCodeLoading.value = true
    try {
      const res = await jobApi.listDefinitionsPaged({
        tenantId: tenant.tenantId,
        pageNo: 1,
        pageSize: 30,
        jobCode: q,
        enabled: true,
      })
      jobCodeOptions.value = Array.from(
        new Set(
          (res.records ?? [])
            .map((r) => r.jobCode)
            .filter((v): v is string => typeof v === 'string' && v),
        ),
      )
    } catch {
      jobCodeOptions.value = []
    } finally {
      jobCodeLoading.value = false
    }
  }

  async function submitRerun() {
    if (!rerunForm.jobCode.trim()) {
      ElMessage.warning('Job Code 不能为空')
      return
    }
    if (!rerunForm.bizDate) {
      ElMessage.warning('业务日不能为空')
      return
    }
    rerunLoading.value = true
    try {
      await selfServiceRerunRequest({
        tenantId: tenant.tenantId,
        jobCode: rerunForm.jobCode,
        bizDate: rerunForm.bizDate,
        ...(rerunForm.targetInstanceNo ? { targetInstanceNo: rerunForm.targetInstanceNo } : {}),
        ...(rerunForm.reason ? { reason: rerunForm.reason } : {}),
      })
      ElMessage.success('重跑申请已提交')
      rerunForm.jobCode = ''
      rerunForm.bizDate = ''
      rerunForm.targetInstanceNo = ''
      rerunForm.reason = ''
    } finally {
      rerunLoading.value = false
    }
  }

  // ── 补偿申请 ──
  const compLoading = ref(false)
  const compForm = reactive({
    jobCode: '',
    bizDate: '',
    compensationType: '',
    targetInstanceNo: '',
    reason: '',
  })

  const compensationTypeOptions = [
    { value: 'JOB', label: 'JOB（重跑作业）' },
    { value: 'STEP', label: 'STEP（重跑步骤）' },
    { value: 'PARTITION', label: 'PARTITION（重试分区）' },
    { value: 'FILE', label: 'FILE（重处理文件）' },
    { value: 'BATCH', label: 'BATCH（重跑批次）' },
    { value: 'DLQ', label: 'DLQ（死信回放）' },
  ] as const

  async function submitCompensation() {
    if (!compForm.jobCode.trim()) {
      ElMessage.warning('Job Code 不能为空')
      return
    }
    if (!compForm.bizDate) {
      ElMessage.warning('业务日不能为空')
      return
    }
    compLoading.value = true
    try {
      await selfServiceCompensationRequest({
        tenantId: tenant.tenantId,
        jobCode: compForm.jobCode,
        bizDate: compForm.bizDate,
        ...(compForm.compensationType ? { compensationType: compForm.compensationType } : {}),
        ...(compForm.targetInstanceNo ? { targetInstanceNo: compForm.targetInstanceNo } : {}),
        ...(compForm.reason ? { reason: compForm.reason } : {}),
      })
      ElMessage.success('补偿申请已提交')
      compForm.jobCode = ''
      compForm.bizDate = ''
      compForm.compensationType = ''
      compForm.targetInstanceNo = ''
      compForm.reason = ''
    } finally {
      compLoading.value = false
    }
  }

  function loadAll() {
    void loadQuota()
    void loadUsage()
    quotaKeys.value = []
    void loadQuotaKeys()
  }

  useTenantReload(loadAll)

  watch(
    activeTab,
    (t) => {
      if (t === 'quotaChange' && quotaKeys.value.length === 0) {
        void loadQuotaKeys()
      }
      if (t === 'rerun' || t === 'compensation') {
        // lazy: options loaded via remote search, but clear stale list when switching tab
        jobCodeOptions.value = []
      }
    },
    { immediate: true },
  )
</script>

<style scoped>
  .pretty-primary-button {
    border: none;
    border-radius: 12px;
    padding: 0 20px;
    min-height: 42px;
    font-weight: 650;
    letter-spacing: 0.06em;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--color-primary) 78%, #ffffff 22%) 0%,
      color-mix(in srgb, #0f5ed9 72%, #ffffff 28%) 100%
    );
    box-shadow: 0 6px 16px rgb(59 130 246 / 16%);
    transition:
      transform 0.18s ease,
      box-shadow 0.18s ease,
      filter 0.18s ease;
  }

  .pretty-primary-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 24px rgb(59 130 246 / 18%);
    filter: saturate(1.05);
  }

  .pretty-primary-button:active {
    transform: translateY(0);
  }

  /* actions: center the submit button */
  .form-actions :deep(.el-form-item__content) {
    justify-content: center;
  }
</style>
