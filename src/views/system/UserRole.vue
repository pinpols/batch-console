<template>
  <PageContainer>
    <PageHeader title="权限自查" description="当前登录用户的角色、权限与可访问菜单一览。">
      <template #actions>
        <el-button :loading="refreshing" @click="refreshProfile">刷新登录态</el-button>
      </template>
    </PageHeader>

    <div class="metrics">
      <MetricCard label="当前角色" :value="roleLabel(currentRole)" />
      <MetricCard label="权限条目" :value="permissionList.length" />
      <div
        class="metric-hit"
        role="button"
        tabindex="0"
        title="展开导航访问矩阵"
        @click="expandMatrixScroll"
        @keydown.enter.prevent="expandMatrixScroll"
      >
        <MetricCard label="可见菜单项" :value="visibleMenuCount" description="点击展开下方矩阵" />
      </div>
      <MetricCard label="当前租户" :value="tenant.tenantId" />
    </div>

    <SectionCard>
      <template #header>
        <span>当前登录态</span>
      </template>

      <el-alert :title="modeMessage" type="info" :closable="false" show-icon />

      <el-descriptions :column="2" border class="profile-panel">
        <el-descriptions-item label="用户名">
          {{ currentUser?.username || '—' }}
        </el-descriptions-item>
        <el-descriptions-item label="用户 ID">
          {{ currentUser?.userId || '—' }}
        </el-descriptions-item>
        <el-descriptions-item label="角色">
          <el-tag size="small" type="primary">{{ roleLabel(currentRole) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="当前租户">
          {{ tenant.tenantId }}
        </el-descriptions-item>
        <el-descriptions-item label="权限条目数">
          {{ permissionList.length }}
        </el-descriptions-item>
        <el-descriptions-item label="角色阶梯">
          <div class="role-chain">
            <el-tag
              v-for="role in roleOrder"
              :key="role"
              size="small"
              :type="role === currentRole ? 'success' : 'info'"
              effect="plain"
            >
              {{ roleLabelMap[role] }}
            </el-tag>
          </div>
        </el-descriptions-item>
      </el-descriptions>
    </SectionCard>

    <SectionCard>
      <template #header>
        <span>权限清单</span>
      </template>

      <el-empty v-if="permissionList.length === 0" description="当前用户未返回权限声明。" />

      <div v-else class="permission-list">
        <el-tag v-for="permissionName in permissionList" :key="permissionName" effect="plain">
          {{ permissionName }}
        </el-tag>
      </div>
    </SectionCard>

    <div ref="matrixAnchorRef" class="access-matrix-anchor">
      <SectionCard class="access-matrix-card">
        <template #header>
          <div
            class="access-matrix__head"
            :class="{ 'access-matrix__head--collapsed': !matrixExpanded }"
            @mouseenter="onMatrixHeadEnter"
            @click="onMatrixHeadClick"
          >
            <div class="access-matrix__head-left">
              <span>导航访问矩阵</span>
              <el-tag size="small" effect="plain" type="info">{{ accessRows.length }} 项</el-tag>
            </div>
            <div class="access-matrix__head-actions" @click.stop>
              <template v-if="!matrixExpanded">
                <el-button
                  type="primary"
                  :icon="Plus"
                  circle
                  size="small"
                  aria-label="展开矩阵"
                  @click="expandMatrix"
                />
              </template>
              <el-button
                v-else
                type="info"
                link
                size="small"
                :icon="ArrowUp"
                @click="collapseMatrix"
              >
                收起
              </el-button>
            </div>
          </div>
        </template>

        <div
          v-if="!matrixExpanded"
          class="access-matrix__collapsed"
          @mouseenter="expandMatrix"
          @click="expandMatrix"
        >
          <el-icon class="access-matrix__collapsed-icon" :size="20"><Plus /></el-icon>
          <span>悬停本区域或点击展开完整访问矩阵</span>
        </div>

        <el-table
          v-if="matrixExpanded"
          :data="pagedAccessRows.records"
          border
          size="small"
          highlight-current-row
          class="console-table access-matrix__table"
        >
          <el-table-column prop="groupTitle" label="分组" min-width="140" />
          <el-table-column prop="itemTitle" label="页面" min-width="160" />
          <el-table-column label="最低角色" width="120">
            <template #default="{ row }">
              {{ roleLabel(row.requiredRole) }}
            </template>
          </el-table-column>
          <el-table-column label="当前访问" width="120">
            <template #default="{ row }">
              <el-tag size="small" :type="row.allowed ? 'success' : 'info'">
                {{ row.allowed ? '允许' : '不可见' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="path" label="路由" min-width="220" />
        </el-table>
        <TablePagerBar
          v-if="matrixExpanded"
          :page="matrixPage"
          :page-size="matrixPageSize"
          :total="pagedAccessRows.total"
          @update:page="setMatrixPage"
          @update:page-size="onMatrixPageSize"
        />
      </SectionCard>
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, nextTick, ref, watch } from 'vue'
  import { toPageResult } from '@/api/adapters'
  import { ElMessage } from 'element-plus'
  import { ArrowUp, Plus } from '@element-plus/icons-vue'
  import { navigationGroups } from '@/constants/navigation'
  import { roleLabelMap, roleOrder } from '@/constants/role'
  import { useAuthStore } from '@/stores/auth'
  import { usePermissionStore } from '@/stores/permission'
  import { useTenantStore } from '@/stores/tenant'
  import type { Role } from '@/types'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import MetricCard from '@/components/common/MetricCard.vue'
  import TablePagerBar from '@/components/table/TablePagerBar.vue'

  interface AccessRow {
    groupTitle: string
    itemTitle: string
    requiredRole?: Role
    allowed: boolean
    path: string
  }

  const auth = useAuthStore()
  const permission = usePermissionStore()
  const tenant = useTenantStore()
  const refreshing = ref(false)
  const matrixExpanded = ref(false)
  const matrixAnchorRef = ref<HTMLElement | null>(null)
  const matrixPage = ref(1)
  const matrixPageSize = ref(20)

  function expandMatrix() {
    matrixExpanded.value = true
  }

  function collapseMatrix() {
    matrixExpanded.value = false
  }

  function expandMatrixScroll() {
    expandMatrix()
    void nextTick(() => {
      matrixAnchorRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }

  function onMatrixHeadEnter() {
    if (!matrixExpanded.value) expandMatrix()
  }

  function onMatrixHeadClick() {
    if (!matrixExpanded.value) expandMatrix()
  }

  const currentUser = computed(() => auth.userInfo)
  const currentRole = computed<Role | undefined>(() => currentUser.value?.role ?? undefined)
  const permissionList = computed(() => currentUser.value?.permissions ?? [])
  const visibleMenuCount = computed(() =>
    permission.visibleGroups.reduce((total, group) => total + group.children.length, 0),
  )
  const modeMessage = computed(() => '当前为真实鉴权模式，数据来自 /api/console/auth/me。')

  const accessRows = computed<AccessRow[]>(() =>
    navigationGroups.flatMap((group) =>
      group.children.map((item) => {
        const requiredRole = item.minRole ?? group.minRole
        return {
          groupTitle: group.title,
          itemTitle: item.title,
          requiredRole,
          allowed: permission.canAccessRole(requiredRole),
          path: item.path,
        }
      }),
    ),
  )

  const pagedAccessRows = computed(() =>
    toPageResult(accessRows.value, matrixPage.value, matrixPageSize.value),
  )

  function setMatrixPage(p: number) {
    matrixPage.value = p
  }

  function onMatrixPageSize(s: number) {
    matrixPageSize.value = s
    matrixPage.value = 1
  }

  watch([accessRows, matrixPageSize], () => {
    const total = accessRows.value.length
    const max = Math.max(1, Math.ceil(total / matrixPageSize.value) || 1)
    if (matrixPage.value > max) matrixPage.value = max
  })

  function roleLabel(role?: Role) {
    return role ? roleLabelMap[role] : '未设置'
  }

  async function refreshProfile() {
    refreshing.value = true
    try {
      await auth.fetchMe()
      ElMessage.success('登录态已刷新')
    } finally {
      refreshing.value = false
    }
  }
</script>

<style scoped>
  .metrics {
    display: grid;
    gap: var(--space-md);
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }

  .profile-panel {
    margin-top: var(--space-md);
  }

  .role-chain {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
  }

  .permission-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
  }

  .metric-hit {
    min-width: 0;
    border-radius: var(--radius-content);
    cursor: pointer;
    outline: none;
  }

  .metric-hit:focus-visible {
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 45%, transparent);
  }

  .metric-hit :deep(.metric-card) {
    transition:
      border-color var(--motion-duration-sm) var(--motion-ease-standard),
      box-shadow var(--motion-duration-sm) var(--motion-ease-standard);
  }

  .metric-hit:hover :deep(.metric-card) {
    border-color: color-mix(in srgb, var(--color-border) 55%, var(--color-primary) 45%);
  }

  .access-matrix-anchor {
    scroll-margin-top: 12px;
  }

  .access-matrix__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    width: 100%;
    min-width: 0;
    cursor: pointer;
    user-select: none;
  }

  .access-matrix__head--collapsed {
    border-radius: var(--radius-content);
  }

  .access-matrix__head-left {
    display: inline-flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
    min-width: 0;
  }

  .access-matrix__head-actions {
    flex-shrink: 0;
  }

  .access-matrix__collapsed {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 14px 12px;
    margin: 4px 0 0;
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    cursor: pointer;
    border-radius: var(--radius-content);
    transition: background-color 0.15s ease;
  }

  .access-matrix__collapsed:hover {
    background: var(--el-fill-color-light);
    color: var(--color-text-primary);
  }

  .access-matrix__collapsed-icon {
    color: var(--color-primary);
  }

  .access-matrix__table {
    margin-top: 2px;
  }
</style>
