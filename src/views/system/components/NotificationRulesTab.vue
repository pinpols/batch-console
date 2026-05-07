<template>
  <div>
    <ProTable
      :data="pagedRules"
      :loading="loadingRules"
      :total="filteredRules.length"
      v-model:page="rulePage"
      v-model:page-size="rulePageSize"
      @change="() => {}"
    >
      <template #query>
        <ListPageQueryBar
          :filter-busy="filterBusy"
          :refresh-busy="loadingRules"
          @search="applyRuleFilter"
          @reset="resetRuleFilter"
          @refresh="() => runRefresh(loadRules)"
        >
          <template #prepend>
            <el-button
              type="primary"
              :icon="Plus"
              class="pretty-add-button"
              @click="openRuleCreate"
            >
              新增
            </el-button>
          </template>
          <el-form-item label="关键字">
            <el-input
              class="query-w-240"
              v-model="ruleFilterDraft.keyword"
              clearable
              placeholder="搜索名称/事件类型"
              @keyup.enter="applyRuleFilter"
            />
          </el-form-item>
          <el-form-item label="启用">
            <el-select
              class="query-w-140"
              v-model="ruleFilterDraft.enabled"
              clearable
              placeholder="全部"
            >
              <el-option label="已启用" :value="true" />
              <el-option label="已停用" :value="false" />
            </el-select>
          </el-form-item>
        </ListPageQueryBar>
      </template>
      <el-table-column prop="ruleId" label="ID" width="80" />
      <el-table-column prop="ruleName" label="规则名称" min-width="160" show-overflow-tooltip />
      <el-table-column prop="eventTypes" label="事件类型" min-width="200" show-overflow-tooltip />
      <el-table-column prop="channelId" label="渠道 ID" width="100" />
      <el-table-column prop="enabled" label="启用" width="80">
        <template #default="{ row }">
          <StatusTag :value="String(row.enabled)" category="yn" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <div class="table-actions">
            <el-button size="small" plain type="primary" @click="openRuleEdit(row)">编辑</el-button>
            <el-button size="small" plain type="danger" @click="confirmDeleteRule(row)"
              >删除</el-button
            >
          </div>
        </template>
      </el-table-column>
    </ProTable>

    <el-dialog
      v-model="ruleFormVisible"
      :title="ruleEditingId ? '编辑规则' : '新增规则'"
      width="560px"
    >
      <el-form label-width="100px">
        <el-form-item label="名称">
          <el-input v-model="ruleForm.ruleName" placeholder="规则名称" />
        </el-form-item>
        <el-form-item label="事件类型">
          <el-input
            v-model="ruleForm.eventTypes"
            placeholder="逗号分隔，如 JOB_FAILED,JOB_TIMEOUT"
          />
        </el-form-item>
        <el-form-item label="渠道 ID">
          <el-input-number
            v-model="ruleForm.channelId"
            :min="1"
            placeholder="渠道 ID"
            class="query-w-full"
          />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="ruleForm.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="ruleFormVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingRule" @click="saveRule">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Plus } from '@element-plus/icons-vue'
  import {
    listNotificationRules,
    createNotificationRule,
    updateNotificationRule,
    deleteNotificationRule,
  } from '@/api/notifications'
  import { toPageResult } from '@/api/adapters'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import ProTable from '@/components/table/ProTable.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'

  const tenant = useTenantStore()
  const loadingRules = ref(false)
  const { filterBusy, runSearch, runReset, runRefresh } = useListFilterFeedback(loadingRules)
  const savingRule = ref(false)
  const ruleFormVisible = ref(false)
  const ruleEditingId = ref<number | null>(null)
  const rules = ref<Record<string, unknown>[]>([])
  const rulePage = ref(1)
  const rulePageSize = ref(20)
  const ruleFilterDraft = reactive({ keyword: '', enabled: undefined as boolean | undefined })
  const ruleFilterApplied = reactive({ keyword: '', enabled: undefined as boolean | undefined })
  const ruleForm = reactive({ ruleName: '', eventTypes: '', channelId: 1, enabled: true })

  async function loadRules() {
    loadingRules.value = true
    try {
      const data = await listNotificationRules(tenant.tenantId)
      rules.value = Array.isArray(data) ? (data as Record<string, unknown>[]) : []
    } catch {
      rules.value = []
    } finally {
      loadingRules.value = false
    }
  }

  function openRuleCreate() {
    ruleEditingId.value = null
    ruleForm.ruleName = ''
    ruleForm.eventTypes = ''
    ruleForm.channelId = 1
    ruleForm.enabled = true
    ruleFormVisible.value = true
  }

  function openRuleEdit(row: Record<string, unknown>) {
    ruleEditingId.value = Number(row.ruleId ?? row.id ?? 0) || null
    ruleForm.ruleName = String(row.ruleName ?? '')
    ruleForm.eventTypes = String(row.eventTypes ?? '')
    ruleForm.channelId = Number(row.channelId ?? 1)
    ruleForm.enabled = !!row.enabled
    ruleFormVisible.value = true
  }

  async function saveRule() {
    if (!ruleForm.ruleName.trim()) {
      ElMessage.warning('名称不能为空')
      return
    }
    savingRule.value = true
    try {
      const body = { ...ruleForm }
      if (ruleEditingId.value) {
        await updateNotificationRule(ruleEditingId.value, tenant.tenantId, body)
      } else {
        await createNotificationRule(tenant.tenantId, body)
      }
      ElMessage.success('已保存')
      ruleFormVisible.value = false
      await loadRules()
    } finally {
      savingRule.value = false
    }
  }

  async function confirmDeleteRule(row: Record<string, unknown>) {
    const ruleId = Number(row.ruleId ?? row.id ?? 0)
    try {
      await ElMessageBox.confirm(`删除规则 #${ruleId}（${row.ruleName}）？`, '删除确认', {
        type: 'warning',
      })
      await deleteNotificationRule(ruleId, tenant.tenantId)
      ElMessage.success('已删除')
      await loadRules()
    } catch {
      /* cancel */
    }
  }

  function normalize(s: unknown) {
    return String(s ?? '')
      .trim()
      .toLowerCase()
  }

  const filteredRules = computed(() => {
    const k = normalize(ruleFilterApplied.keyword)
    const en = ruleFilterApplied.enabled
    return rules.value.filter((row) => {
      const okEnabled = en === undefined ? true : !!row.enabled === en
      if (!okEnabled) return false
      if (!k) return true
      const hay = `${row.ruleName ?? ''} ${row.eventTypes ?? ''}`.toLowerCase()
      return hay.includes(k)
    })
  })

  const pagedRules = computed(
    () => toPageResult(filteredRules.value, rulePage.value, rulePageSize.value).records,
  )

  function applyRuleFilter() {
    return runSearch(() => {
      ruleFilterApplied.keyword = ruleFilterDraft.keyword.trim()
      ruleFilterApplied.enabled = ruleFilterDraft.enabled
      rulePage.value = 1
    })
  }

  function resetRuleFilter() {
    return runReset(() => {
      ruleFilterDraft.keyword = ''
      ruleFilterDraft.enabled = undefined
      ruleFilterApplied.keyword = ''
      ruleFilterApplied.enabled = undefined
      rulePage.value = 1
    })
  }

  useTenantReload(() => {
    rulePage.value = 1
    void loadRules()
  })
</script>
