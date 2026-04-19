<template>
  <div class="m-page">
    <div class="m-page__header">
      <div>
        <div class="m-page__title">Job Instance</div>
        <div class="m-page__subtitle">共 {{ total }} 条 · 第 {{ page }} 页</div>
      </div>
      <button class="m-page__refresh" :disabled="loading" @click="load">
        <el-icon><Refresh /></el-icon>
        {{ loading ? '加载中' : '刷新' }}
      </button>
    </div>

    <div class="m-page__header" style="gap: 8px">
      <el-select
        v-model="query.instanceStatus"
        placeholder="所有状态"
        clearable
        size="small"
        style="flex: 1"
        @change="onFilterChange"
      >
        <el-option v-for="s in statuses" :key="s" :label="s" :value="s" />
      </el-select>
      <el-input
        v-model="query.jobCode"
        placeholder="jobCode 模糊"
        clearable
        size="small"
        style="flex: 1"
        @change="onFilterChange"
      />
    </div>

    <div v-if="loading && rows.length === 0" class="m-loading">加载中…</div>
    <div v-else-if="rows.length === 0" class="m-empty">暂无实例</div>

    <div v-for="row in rows" :key="row.id" class="m-card">
      <div class="m-card__row">
        <div class="m-card__title">{{ row.jobCode }}</div>
        <span :class="['m-chip', statusChipClass(row.instanceStatus)]">{{
          row.instanceStatus
        }}</span>
      </div>
      <div class="m-card__sub">{{ row.instanceNo }}</div>
      <div class="m-card__meta">
        <div><span class="m-card__meta-key">业务日</span>{{ row.bizDate }}</div>
        <div><span class="m-card__meta-key">触发</span>{{ row.triggerType }}</div>
        <div><span class="m-card__meta-key">优先级</span>{{ row.priority }}</div>
        <div><span class="m-card__meta-key">开始</span>{{ fmt(row.startedAt) }}</div>
        <div v-if="row.finishedAt">
          <span class="m-card__meta-key">结束</span>{{ fmt(row.finishedAt) }}
        </div>
      </div>
      <div
        v-if="row.instanceStatus === 'RUNNING' || row.instanceStatus === 'FAILED'"
        class="m-card__actions"
      >
        <button
          v-if="row.instanceStatus === 'FAILED'"
          class="m-btn m-btn--primary"
          @click="retry(row)"
        >
          重试
        </button>
        <button
          v-if="row.instanceStatus === 'RUNNING'"
          class="m-btn m-btn--danger"
          @click="terminate(row)"
        >
          终止
        </button>
      </div>
    </div>

    <div v-if="total > query.pageSize" class="m-page__header" style="justify-content: center">
      <el-pagination
        small
        background
        layout="prev, pager, next"
        :total="total"
        :current-page="page"
        :page-size="query.pageSize"
        @current-change="onPageChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, reactive, ref, watch } from 'vue'
  import { Refresh } from '@element-plus/icons-vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { useTenantStore } from '@/stores/tenant'
  import { instanceApi } from '@/api/instance'
  import type { ConsoleJobInstanceResponse } from '@/types/console-api'

  const tenant = useTenantStore()
  const loading = ref(false)
  const rows = ref<ConsoleJobInstanceResponse[]>([])
  const total = ref(0)
  const page = ref(1)

  const statuses = ['CREATED', 'WAITING', 'RUNNING', 'COMPLETED', 'SUCCESS', 'FAILED', 'CANCELLED']

  const query = reactive({
    tenantId: tenant.tenantId,
    jobCode: '',
    instanceStatus: '',
    startDate: '',
    endDate: '',
    page: 1,
    pageSize: 20,
  })

  function fmt(ts?: string | null) {
    if (!ts) return '—'
    try {
      return new Date(ts).toLocaleString('zh-CN', { hour12: false })
    } catch {
      return ts
    }
  }

  function statusChipClass(s?: string) {
    switch (s) {
      case 'SUCCESS':
      case 'COMPLETED':
        return 'm-chip--success'
      case 'RUNNING':
        return 'm-chip--info'
      case 'FAILED':
      case 'CANCELLED':
        return 'm-chip--danger'
      case 'WAITING':
      case 'CREATED':
        return 'm-chip--warning'
      default:
        return ''
    }
  }

  async function load() {
    loading.value = true
    try {
      query.tenantId = tenant.tenantId
      query.page = page.value
      const res = await instanceApi.list(query)
      rows.value = res.records
      total.value = res.total
    } catch {
      ElMessage.error('加载失败')
    } finally {
      loading.value = false
    }
  }

  function onFilterChange() {
    page.value = 1
    load()
  }

  function onPageChange(p: number) {
    page.value = p
    load()
  }

  async function retry(row: ConsoleJobInstanceResponse) {
    try {
      await ElMessageBox.confirm(`重试 ${row.instanceNo}？`, '确认重试', { type: 'warning' })
      await instanceApi.retry(row.instanceNo, tenant.tenantId, row.jobCode, row.bizDate)
      ElMessage.success('已提交重试')
      await load()
    } catch {
      /* cancelled */
    }
  }

  async function terminate(row: ConsoleJobInstanceResponse) {
    try {
      await ElMessageBox.confirm(`终止运行中的 ${row.instanceNo}？`, '确认终止', {
        type: 'warning',
      })
      await instanceApi.terminate(row.id, tenant.tenantId)
      ElMessage.success('已终止')
      await load()
    } catch {
      /* cancelled */
    }
  }

  onMounted(load)
  watch(() => tenant.tenantId, load)
</script>
