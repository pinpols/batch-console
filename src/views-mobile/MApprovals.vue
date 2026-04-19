<template>
  <MPullRefresh :on-refresh="load">
    <div class="m-page">
      <div class="m-page__header">
        <div>
          <div class="m-page__title">审批中心</div>
          <div class="m-page__subtitle">待处理 {{ pendingCount }} 条</div>
        </div>
        <button class="m-page__refresh" :disabled="loading" @click="load">
          <el-icon><Refresh /></el-icon>
          {{ loading ? '加载中' : '刷新' }}
        </button>
      </div>

      <MSkeleton v-if="loading && rows.length === 0" :count="3" />
      <div v-else-if="rows.length === 0" class="m-empty">暂无审批记录</div>

      <div v-for="row in rows" :key="row.approvalNo" class="m-card">
        <div class="m-card__row">
          <div class="m-card__title">{{ row.approvalType }} · {{ row.actionType }}</div>
          <span :class="['m-chip', statusChipClass(row.approvalStatus)]">{{
            row.approvalStatus
          }}</span>
        </div>
        <div class="m-card__sub">单号：{{ row.approvalNo }}</div>
        <div class="m-card__meta">
          <div>
            <span class="m-card__meta-key">目标</span>{{ row.targetType }}/{{ row.targetId || '—' }}
          </div>
          <div><span class="m-card__meta-key">请求者</span>{{ row.requesterId || '—' }}</div>
          <div><span class="m-card__meta-key">创建</span>{{ fmt(row.createdAt) }}</div>
          <div v-if="row.rejectionReason">
            <span class="m-card__meta-key">拒绝原因</span>{{ row.rejectionReason }}
          </div>
        </div>
        <div v-if="isPending(row)" class="m-card__actions">
          <button class="m-btn m-btn--plain-danger" @click="reject(row)">拒绝</button>
          <button class="m-btn m-btn--primary" @click="approve(row)">批准</button>
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
  import { queryApprovals, approveOne, rejectOne } from '@/api/approvals'
  import type { ConsoleApprovalCommandResponse } from '@/types/console-api'

  const tenant = useTenantStore()
  const loading = ref(false)
  const rows = ref<ConsoleApprovalCommandResponse[]>([])

  const pendingCount = computed(
    () => rows.value.filter((r) => r.approvalStatus === 'PENDING').length,
  )

  function fmt(ts?: string | null) {
    if (!ts) return '—'
    try {
      return new Date(ts).toLocaleString('zh-CN', { hour12: false })
    } catch {
      return ts
    }
  }

  function isPending(row: ConsoleApprovalCommandResponse) {
    return row.approvalStatus === 'PENDING'
  }

  function statusChipClass(status?: string | null) {
    switch (status) {
      case 'PENDING':
        return 'm-chip--warning'
      case 'APPROVED':
      case 'EXECUTED':
        return 'm-chip--success'
      case 'REJECTED':
        return 'm-chip--danger'
      default:
        return 'm-chip--info'
    }
  }

  async function load() {
    loading.value = true
    try {
      rows.value = await queryApprovals(tenant.tenantId)
    } catch {
      ElMessage.error('加载失败')
    } finally {
      loading.value = false
    }
  }

  async function approve(row: ConsoleApprovalCommandResponse) {
    try {
      await ElMessageBox.confirm(`批准 ${row.approvalNo}？`, '确认批准', { type: 'info' })
      await approveOne(row.approvalNo, { tenantId: tenant.tenantId })
      ElMessage.success('已批准')
      await load()
    } catch {
      /* cancelled */
    }
  }

  async function reject(row: ConsoleApprovalCommandResponse) {
    try {
      await ElMessageBox.confirm(`拒绝 ${row.approvalNo}？`, '确认拒绝', { type: 'warning' })
      await rejectOne(row.approvalNo, { tenantId: tenant.tenantId })
      ElMessage.success('已拒绝')
      await load()
    } catch {
      /* cancelled */
    }
  }

  onMounted(load)
  watch(() => tenant.tenantId, load)
</script>
