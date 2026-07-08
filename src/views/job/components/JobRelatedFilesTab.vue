<template>
  <div class="job-related-files">
    <div class="related-toolbar">
      <span class="related-toolbar__hint">{{ t('jobRelatedFiles.hint') }}</span>
      <el-button :icon="Refresh" size="small" :loading="loading" @click="reload">
        {{ t('common.refresh') }}
      </el-button>
    </div>

    <el-table v-loading="loading" :data="rows" size="small" empty-text=" " class="related-table">
      <el-table-column prop="fileName" :label="t('jobRelatedFiles.colFileName')" min-width="240">
        <template #default="{ row }">
          <router-link :to="`/files/list?fileId=${row.id}`" class="cell-link">
            {{ row.fileName }}
          </router-link>
        </template>
      </el-table-column>
      <el-table-column prop="fileStatus" :label="t('jobRelatedFiles.colStatus')" width="120">
        <template #default="{ row }">
          <el-tag size="small" :type="statusTagType(row.fileStatus)">
            {{ row.fileStatus || '—' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="bizType" :label="t('jobRelatedFiles.colBizType')" width="120" />
      <el-table-column prop="bizDate" :label="t('jobRelatedFiles.colBizDate')" width="120" />
      <el-table-column prop="createdAt" :label="t('jobRelatedFiles.colCreatedAt')" width="180" />
    </el-table>

    <div v-if="total > pageSize" class="related-pagination">
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="prev, pager, next, total"
        small
        @current-change="load"
      />
    </div>

    <p v-if="!loading && rows.length === 0" class="related-empty">
      {{ t('jobRelatedFiles.empty') }}
    </p>
  </div>
</template>

<script setup lang="ts">
  /**
   * 关联文件 Tab — Day 6 落地。
   *
   * 适用场景:job_type ∈ {IMPORT, EXPORT}(文件类作业)。
   * 数据源:GET /api/console/queries/files?tenantId&jobCode&pageNo&pageSize
   * 展示:fileName / fileStatus / bizType / bizDate / createdAt;点 fileName 跳 /files/list?fileId=...
   *
   * 设计:
   *   - 懒加载(父 el-tab-pane lazy=true,只在 tab 打开时挂载本组件)
   *   - 分页 5 / page,内部 drawer 不强求满屏,只看最近
   *   - 父切换 jobCode 时通过 watch(props) 自动 reload
   */
  import { ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { RefreshCw as Refresh } from 'lucide-vue-next'
  import { get } from '@/api/client'
  import type { PageResponse } from '@/types'
  import type { ConsoleFileRecordResponse } from '@/types/console-api'

  const props = defineProps<{
    tenantId: string
    jobCode: string
  }>()

  const { t } = useI18n({ useScope: 'global' })

  const loading = ref(false)
  const rows = ref<ConsoleFileRecordResponse[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = 5

  async function load() {
    if (!props.tenantId || !props.jobCode) return
    loading.value = true
    try {
      const res = await get<PageResponse<ConsoleFileRecordResponse>>('/api/console/queries/files', {
        tenantId: props.tenantId,
        jobCode: props.jobCode,
        pageNo: page.value,
        pageSize,
      })
      rows.value = res.items ?? []
      total.value = res.total ?? 0
    } catch {
      rows.value = []
      total.value = 0
    } finally {
      loading.value = false
    }
  }

  function reload() {
    page.value = 1
    void load()
  }

  // 父切换 jobCode 时重新拉
  watch(
    () => [props.tenantId, props.jobCode],
    () => reload(),
    { immediate: true },
  )

  function statusTagType(
    s: string | undefined,
  ): 'success' | 'warning' | 'danger' | 'info' | 'primary' {
    if (!s) return 'info'
    const up = s.toUpperCase()
    if (['COMPLETED', 'SUCCEEDED', 'DELIVERED', 'STORED'].includes(up)) return 'success'
    if (['FAILED', 'ERROR', 'GIVE_UP'].includes(up)) return 'danger'
    if (['RUNNING', 'PROCESSING', 'DISPATCHING'].includes(up)) return 'primary'
    if (['PENDING', 'WAITING'].includes(up)) return 'warning'
    return 'info'
  }
</script>

<style scoped>
  .job-related-files {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .related-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .related-toolbar__hint {
    font-size: 12px;
    color: var(--color-text-tertiary);
  }

  .related-table :deep(.cell-link) {
    color: var(--color-primary);
    text-decoration: none;
  }
  .related-table :deep(.cell-link:hover) {
    text-decoration: underline;
  }

  .related-pagination {
    display: flex;
    justify-content: flex-end;
  }

  .related-empty {
    text-align: center;
    color: var(--color-text-tertiary);
    font-size: 13px;
    margin: 16px 0;
  }
</style>
