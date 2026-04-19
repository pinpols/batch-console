<template>
  <MPullRefresh :on-refresh="load">
    <div class="m-page">
      <div class="m-page__header">
        <div>
          <div class="m-page__title">Catch-up 审批</div>
          <div class="m-page__subtitle">待审批 {{ pendingCount }} 条</div>
        </div>
        <button class="m-page__refresh" :disabled="loading" @click="load">
          <el-icon><Refresh /></el-icon>
          {{ loading ? '加载中' : '刷新' }}
        </button>
      </div>

      <MSkeleton v-if="loading && rows.length === 0" :count="3" />
      <div v-else-if="rows.length === 0" class="m-empty">暂无补跑审批</div>

      <div v-for="row in rows" :key="row.id" class="m-card">
        <div class="m-card__row">
          <div class="m-card__title">{{ row.jobCode }} · {{ row.bizDate }}</div>
          <span :class="['m-chip', statusChipClass(row.requestStatus)]">{{
            row.requestStatus
          }}</span>
        </div>
        <div class="m-card__sub">request: {{ row.requestId }}</div>
        <div class="m-card__meta">
          <div><span class="m-card__meta-key">创建</span>{{ fmt(row.createdAt) }}</div>
          <div><span class="m-card__meta-key">trace</span>{{ row.traceId }}</div>
        </div>
        <div v-if="isPending(row.requestStatus)" class="m-card__actions">
          <button class="m-btn m-btn--plain-danger" @click="decide(row, false)">拒绝</button>
          <button class="m-btn m-btn--primary" @click="decide(row, true)">批准</button>
        </div>
      </div>
    </div>
  </MPullRefresh>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref, watch } from 'vue'
  import { Refresh } from '@element-plus/icons-vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { useTenantStore } from '@/stores/tenant'
  import MPullRefresh from '@/layout-mobile/MPullRefresh.vue'
  import MSkeleton from '@/layout-mobile/MSkeleton.vue'
  import { fetchAllPageItems } from '@/api/adapters'
  import { jobApi } from '@/api/job'
  import type { ConsolePendingCatchUpResponse } from '@/types/console-api'

  const tenant = useTenantStore()
  const loading = ref(false)
  const rows = ref<ConsolePendingCatchUpResponse[]>([])

  const pendingCount = computed(() => rows.value.filter((r) => isPending(r.requestStatus)).length)

  function fmt(ts?: string | null) {
    if (!ts) return '—'
    try {
      return new Date(ts).toLocaleString('zh-CN', { hour12: false })
    } catch {
      return ts
    }
  }

  function isPending(s?: string) {
    return s === 'PENDING' || s === 'PENDING_APPROVAL'
  }

  function statusChipClass(s?: string) {
    switch (s) {
      case 'APPROVED':
      case 'EXECUTED':
        return 'm-chip--success'
      case 'REJECTED':
        return 'm-chip--danger'
      case 'PENDING':
      case 'PENDING_APPROVAL':
        return 'm-chip--warning'
      default:
        return 'm-chip--info'
    }
  }

  async function load() {
    loading.value = true
    try {
      rows.value = await fetchAllPageItems<ConsolePendingCatchUpResponse>(
        '/api/console/queries/catch-up-approvals',
        { tenantId: tenant.tenantId },
      )
    } catch {
      ElMessage.error('加载失败')
    } finally {
      loading.value = false
    }
  }

  async function decide(row: ConsolePendingCatchUpResponse, approved: boolean) {
    const verb = approved ? '批准' : '拒绝'
    try {
      await ElMessageBox.confirm(`${verb}补跑 ${row.jobCode} @ ${row.bizDate}？`, `确认${verb}`, {
        type: approved ? 'info' : 'warning',
      })
      await jobApi.catchUpApprove({
        tenantId: tenant.tenantId,
        requestId: row.requestId,
        approved,
      })
      ElMessage.success(`已${verb}`)
      await load()
    } catch {
      /* cancelled */
    }
  }

  onMounted(load)
  watch(() => tenant.tenantId, load)
</script>
