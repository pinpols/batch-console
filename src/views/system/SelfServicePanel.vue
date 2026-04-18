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
              <h3 class="section-title" style="margin-bottom: 0">当前配额</h3>
              <span style="flex: 1" />
              <el-button :loading="loadingQuota" @click="loadQuota">刷新</el-button>
            </div>
            <pre v-if="quota" class="json-preview">{{ JSON.stringify(quota, null, 2) }}</pre>
            <el-empty v-else description="暂无配额数据" />
          </div>

          <div class="data-panel">
            <div class="section-toolbar">
              <h3 class="section-title" style="margin-bottom: 0">当前用量</h3>
              <span style="flex: 1" />
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
                <el-input v-model="quotaForm.quotaKey" placeholder="如 maxConcurrentJobs" />
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
              <el-form-item>
                <el-button
                  type="primary"
                  :loading="submittingQuota"
                  v-track-click="'配额变更申请'"
                  @click="submitQuotaChange"
                  >提交申请</el-button
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
                <el-input v-model="rerunForm.jobCode" placeholder="Job Code" />
              </el-form-item>
              <el-form-item label="业务日">
                <el-date-picker
                  v-model="rerunForm.bizDate"
                  type="date"
                  value-format="YYYY-MM-DD"
                  placeholder="选择日期"
                  style="width: 100%"
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
              <el-form-item>
                <el-button
                  type="primary"
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
                <el-input v-model="compForm.jobCode" placeholder="Job Code" />
              </el-form-item>
              <el-form-item label="业务日">
                <el-date-picker
                  v-model="compForm.bizDate"
                  type="date"
                  value-format="YYYY-MM-DD"
                  placeholder="选择日期"
                  style="width: 100%"
                />
              </el-form-item>
              <el-form-item label="补偿类型">
                <el-input v-model="compForm.compensationType" placeholder="可选" />
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
              <el-form-item>
                <el-button
                  type="primary"
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
  import { ref, reactive } from 'vue'
  import { ElMessage } from 'element-plus'
  import { getTenantQuota, getTenantUsage, requestQuotaChange } from '@/api/tenantSelfService'
  import { selfServiceRerunRequest, selfServiceCompensationRequest } from '@/api/selfServiceJobs'
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

  async function submitQuotaChange() {
    if (!quotaForm.quotaKey.trim()) {
      ElMessage.warning('配额键不能为空')
      return
    }
    if (!quotaForm.requestedValue.trim()) {
      ElMessage.warning('期望值不能为空')
      return
    }
    if (!quotaForm.reason.trim()) {
      ElMessage.warning('原因不能为空')
      return
    }
    submittingQuota.value = true
    try {
      await requestQuotaChange(tenant.tenantId, {
        quotaKey: quotaForm.quotaKey,
        requestedValue: quotaForm.requestedValue,
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
  }

  useTenantReload(loadAll)
</script>

<style scoped></style>
