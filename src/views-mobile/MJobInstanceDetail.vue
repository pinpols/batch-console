<template>
  <div class="m-page">
    <div class="m-page__header">
      <div>
        <button class="m-page__refresh" @click="$router.back()">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </button>
      </div>
      <button class="m-page__refresh" :disabled="loading" @click="load">
        <el-icon><Refresh /></el-icon>
        {{ loading ? '加载中' : '刷新' }}
      </button>
    </div>

    <div v-if="loading && !row" class="m-loading">加载中…</div>
    <div v-else-if="!row" class="m-empty">未找到该实例</div>

    <template v-else>
      <div class="m-card">
        <div class="m-card__row">
          <div class="m-card__title">{{ row.jobCode }}</div>
          <span :class="['m-chip', statusChipClass(row.instanceStatus)]">{{
            row.instanceStatus
          }}</span>
        </div>
        <div class="m-card__sub">{{ row.instanceNo }}</div>
        <div class="m-card__meta">
          <div><span class="m-card__meta-key">ID</span>{{ row.id }}</div>
          <div><span class="m-card__meta-key">业务日</span>{{ row.bizDate }}</div>
          <div><span class="m-card__meta-key">触发</span>{{ row.triggerType }}</div>
          <div><span class="m-card__meta-key">优先级</span>{{ row.priority }}</div>
          <div><span class="m-card__meta-key">队列</span>{{ row.queueCode || '—' }}</div>
          <div><span class="m-card__meta-key">Worker</span>{{ row.workerGroup || '—' }}</div>
          <div><span class="m-card__meta-key">开始</span>{{ fmt(row.startedAt) }}</div>
          <div><span class="m-card__meta-key">结束</span>{{ fmt(row.finishedAt) }}</div>
          <div><span class="m-card__meta-key">traceId</span>{{ row.traceId }}</div>
        </div>
        <div
          v-if="row.instanceStatus === 'RUNNING' || row.instanceStatus === 'FAILED'"
          class="m-card__actions"
        >
          <button
            v-if="row.instanceStatus === 'FAILED'"
            class="m-btn m-btn--primary"
            @click="retry"
          >
            重试
          </button>
          <button
            v-if="row.instanceStatus === 'RUNNING'"
            class="m-btn m-btn--danger"
            @click="terminate"
          >
            终止
          </button>
        </div>
      </div>

      <div class="m-card">
        <div class="m-card__title" style="margin-bottom: 6px">paramsSnapshot</div>
        <pre class="m-pre">{{ pretty(row.paramsSnapshot) || '—' }}</pre>
      </div>

      <div class="m-card">
        <div class="m-card__title" style="margin-bottom: 6px">resultSummary</div>
        <pre class="m-pre">{{ pretty(row.resultSummary) || '—' }}</pre>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { ArrowLeft, Refresh } from '@element-plus/icons-vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { useTenantStore } from '@/stores/tenant'
  import { instanceApi } from '@/api/instance'
  import type { ConsoleJobInstanceResponse } from '@/types/console-api'

  const route = useRoute()
  const router = useRouter()
  const tenant = useTenantStore()
  const loading = ref(false)
  const row = ref<ConsoleJobInstanceResponse | null>(null)

  const instanceId = () => Number(route.params.id)

  function fmt(ts?: string | null) {
    if (!ts) return '—'
    try {
      return new Date(ts).toLocaleString('zh-CN', { hour12: false })
    } catch {
      return ts
    }
  }

  function pretty(raw?: string | null): string {
    if (!raw) return ''
    try {
      return JSON.stringify(JSON.parse(raw), null, 2)
    } catch {
      return raw
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
    const id = instanceId()
    if (!id) return
    loading.value = true
    try {
      row.value = await instanceApi.detail(id, tenant.tenantId)
    } catch {
      row.value = null
      ElMessage.error('加载失败')
    } finally {
      loading.value = false
    }
  }

  async function retry() {
    if (!row.value) return
    try {
      await ElMessageBox.confirm(`重试 ${row.value.instanceNo}？`, '确认重试', { type: 'warning' })
      await instanceApi.retry(
        row.value.instanceNo,
        tenant.tenantId,
        row.value.jobCode,
        row.value.bizDate,
      )
      ElMessage.success('已提交重试')
      router.back()
    } catch {
      /* cancelled */
    }
  }

  async function terminate() {
    if (!row.value) return
    try {
      await ElMessageBox.confirm(`终止 ${row.value.instanceNo}？`, '确认终止', { type: 'warning' })
      await instanceApi.terminate(row.value.id, tenant.tenantId)
      ElMessage.success('已终止')
      await load()
    } catch {
      /* cancelled */
    }
  }

  onMounted(load)
  watch(() => route.params.id, load)
  watch(() => tenant.tenantId, load)
</script>

<style scoped>
  .m-pre {
    max-height: 400px;
    overflow: auto;
    padding: 10px;
    background: var(--el-fill-color-lighter);
    border-radius: 8px;
    font:
      11px/1.5 'SF Mono',
      Menlo,
      monospace;
    color: var(--color-text-secondary);
    white-space: pre-wrap;
    word-break: break-all;
  }
</style>
