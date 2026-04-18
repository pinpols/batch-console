<template>
  <PageContainer>
    <PageHeader title="自助 Job 操作" description="自助申请 Job 重跑、补偿。" />

    <SectionCard>
      <el-tabs v-model="activeTab" v-hover-tab-activate="true" class="pill-tabs">
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
  import { selfServiceRerunRequest, selfServiceCompensationRequest } from '@/api/selfServiceJobs'
  import { useTenantStore } from '@/stores/tenant'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'

  const tenant = useTenantStore()
  const activeTab = ref('rerun')
  const rerunLoading = ref(false)
  const compLoading = ref(false)

  const rerunForm = reactive({ jobCode: '', bizDate: '', targetInstanceNo: '', reason: '' })
  const compForm = reactive({
    jobCode: '',
    bizDate: '',
    compensationType: '',
    targetInstanceNo: '',
    reason: '',
  })

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
</script>
