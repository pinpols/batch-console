<template>
  <PageContainer>
    <PageHeader
      :title="title"
      description="批次日窗口运行状态与 Catch-up 触发。"
      back-to="/scheduler/batch-days"
    >
      <template #actions>
        <el-button type="primary" :loading="loading" @click="load">刷新</el-button>
        <el-button type="success" :disabled="!calendarCode" @click="openCatchup"
          >发起 Catch-up</el-button
        >
      </template>
    </PageHeader>

    <SectionCard v-if="window">
      <template #header>窗口状态</template>
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="业务日">{{ window.bizDate }}</el-descriptions-item>
        <el-descriptions-item label="日状态">{{ window.dayStatus }}</el-descriptions-item>
        <el-descriptions-item label="当前时间">{{ window.currentSystemTime }}</el-descriptions-item>
        <el-descriptions-item label="截止时间">{{ window.cutoffAt ?? '—' }}</el-descriptions-item>
        <el-descriptions-item label="SLA 截止">{{
          window.slaDeadlineAt ?? '—'
        }}</el-descriptions-item>
        <el-descriptions-item label="距截止(秒)">{{
          window.timeUntilCutoffSeconds ?? '—'
        }}</el-descriptions-item>
        <el-descriptions-item label="迟到窗口关闭">{{
          window.lateArrivalWindowClosesAt ?? '—'
        }}</el-descriptions-item>
      </el-descriptions>
    </SectionCard>

    <SectionCard v-if="window">
      <template #header>按 Job 汇总</template>
      <ListPageQueryBar
        :filter-busy="filterBusy"
        :refresh-busy="loading"
        @search="() => runSearch(() => {})"
        @reset="() => runReset(() => (jobKeyword = ''))"
        @refresh="() => runRefresh(load)"
      >
        <el-form-item label="Job">
          <el-input class="query-w-240" v-model="jobKeyword" clearable placeholder="搜索 jobCode" />
        </el-form-item>
      </ListPageQueryBar>
      <el-table :data="filteredJobs" stripe border empty-text="暂无数据" class="console-table">
        <el-table-column prop="jobCode" label="Job" min-width="160" />
        <el-table-column prop="totalJobCount" label="总数" width="72" />
        <el-table-column prop="successJobCount" label="成功" width="72" />
        <el-table-column prop="failedJobCount" label="失败" width="72" />
        <el-table-column prop="inFlightJobCount" label="进行中" width="88" />
        <el-table-column prop="catchupCount" label="Catch-up" width="88" />
      </el-table>
    </SectionCard>

    <SectionCard v-else-if="!loading">
      <EmptyState description="无数据或日历编码未传。请从列表进入并携带 calendarCode。" />
    </SectionCard>

    <el-dialog
      v-model="catchupVisible"
      title="批次日 Catch-up"
      width="520px"
      @closed="resetCatchup"
    >
      <el-form label-width="100px">
        <el-form-item label="日历编码">
          <el-input v-model="catchupForm.calendarCode" disabled />
        </el-form-item>
        <el-form-item label="Job 代码">
          <el-input
            v-model="catchupJobCodesText"
            type="textarea"
            :rows="2"
            placeholder="可选，逗号分隔；留空表示按策略全量"
          />
        </el-form-item>
        <el-form-item label="原因">
          <el-input
            v-model="catchupForm.reason"
            type="textarea"
            :rows="2"
            placeholder="审计用说明"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="catchupVisible = false">取消</el-button>
        <el-button type="primary" :loading="catchupLoading" @click="submitCatchup">提交</el-button>
      </template>
    </el-dialog>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import { launchBatchDayCatchUp, queryBatchDayWindow } from '@/api/batchDays'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import type { ConsoleBatchDayWindowResponse } from '@/types/console-api'

  const route = useRoute()

  const tenant = useTenantStore()

  const bizDate = computed(() => (route.params.bizDate as string) || '')
  const calendarCode = computed(() => (route.query.calendarCode as string) || '')

  const title = computed(() => (bizDate.value ? `批次日窗口 · ${bizDate.value}` : '批次日窗口'))

  const loading = ref(false)
  const { filterBusy, runSearch, runReset, runRefresh } = useListFilterFeedback(loading)
  const window = ref<ConsoleBatchDayWindowResponse | null>(null)
  const jobKeyword = ref('')

  const filteredJobs = computed(() => {
    const list = window.value?.jobs ?? []
    const k = jobKeyword.value.trim().toLowerCase()
    if (!k) return list
    return list.filter((x) =>
      String(x.jobCode ?? '')
        .toLowerCase()
        .includes(k),
    )
  })

  const catchupVisible = ref(false)
  const catchupLoading = ref(false)
  const catchupJobCodesText = ref('')
  const catchupForm = ref({
    calendarCode: '',
    reason: '',
  })

  async function load() {
    const bd = bizDate.value
    const cal = calendarCode.value.trim()
    if (!bd || !cal) {
      window.value = null
      return
    }
    loading.value = true
    try {
      window.value = await queryBatchDayWindow(tenant.tenantId, cal, bd)
    } catch {
      window.value = null
    } finally {
      loading.value = false
    }
  }

  function openCatchup() {
    if (!calendarCode.value.trim()) {
      ElMessage.warning('缺少 query.calendarCode，请从列表页进入')
      return
    }
    catchupForm.value = {
      calendarCode: calendarCode.value.trim(),
      reason: '',
    }
    catchupJobCodesText.value = ''
    catchupVisible.value = true
  }

  function resetCatchup() {
    catchupJobCodesText.value = ''
    catchupForm.value.reason = ''
  }

  async function submitCatchup() {
    const bd = bizDate.value
    if (!bd) return
    const raw = catchupJobCodesText.value.trim()
    const jobCodes = raw
      ? raw
          .split(/[,，\s]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined

    catchupLoading.value = true
    try {
      const res = await launchBatchDayCatchUp(bd, {
        tenantId: tenant.tenantId,
        calendarCode: catchupForm.value.calendarCode,
        jobCodes,
        reason: catchupForm.value.reason || undefined,
      })
      const n = res.items?.length ?? 0
      ElMessage.success(`已提交 Catch-up，返回 ${n} 条项`)
      catchupVisible.value = false
      await load()
    } finally {
      catchupLoading.value = false
    }
  }

  useTenantReload(load)

  watch([bizDate, calendarCode], () => {
    void load()
  })
</script>
