<template>
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
        <el-input v-model="rerunForm.reason" type="textarea" :rows="3" placeholder="重跑原因" />
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
</template>

<script setup lang="ts">
  import { ref, reactive } from 'vue'
  import { ElMessage } from 'element-plus'
  import { selfServiceRerunRequest } from '@/api/selfServiceJobs'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useJobCodeSearch } from '@/composables/useJobCodeSearch'

  const tenant = useTenantStore()
  const rerunLoading = ref(false)
  const rerunForm = reactive({ jobCode: '', bizDate: '', targetInstanceNo: '', reason: '' })

  const { jobCodeLoading, jobCodeOptions, loadDefaultJobCodes, queryJobCodes, clearOptions } =
    useJobCodeSearch()

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

  useTenantReload(clearOptions)
</script>
