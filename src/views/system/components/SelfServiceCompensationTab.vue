<template>
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
        <el-input v-model="compForm.reason" type="textarea" :rows="3" placeholder="补偿原因" />
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
</template>

<script setup lang="ts">
  import { ref, reactive } from 'vue'
  import { ElMessage } from 'element-plus'
  import { selfServiceCompensationRequest } from '@/api/selfServiceJobs'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useJobCodeSearch } from '@/composables/useJobCodeSearch'

  const tenant = useTenantStore()
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

  const { jobCodeLoading, jobCodeOptions, loadDefaultJobCodes, queryJobCodes, clearOptions } =
    useJobCodeSearch()

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

  useTenantReload(clearOptions)
</script>
