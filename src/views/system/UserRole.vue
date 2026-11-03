<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button
          :icon="Refresh"
          :loading="refreshing || refreshAction.loading.value"
          @click="refreshAction.run(refreshProfile)"
        >
          {{ t('userRole.btnRefreshLogin') }}
        </el-button>
      </template>
    </PageHeader>

    <div class="access-overview">
      <SectionCard class="access-overview__card">
        <template #header>
          <span>{{ t('userRole.sectionLoginStatus') }}</span>
        </template>

        <el-descriptions :column="isMobile ? 1 : 2" :label-width="104" border class="profile-panel">
          <el-descriptions-item :label="t('userRole.fieldUsername')">
            {{ currentUser?.username || '—' }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('userRole.fieldUserId')">
            {{ currentUser?.userId || '—' }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('userRole.fieldRole')">
            <el-tag size="small" type="primary">{{ formalRoleLabel }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item :label="t('userRole.fieldTenant')">
            {{ tenant.tenantId }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('userRole.fieldRoleChain')">
            <div class="role-chain">
              <el-tag
                v-for="role in roleOrder"
                :key="role"
                size="small"
                :type="role === currentRole ? 'success' : 'info'"
                effect="plain"
              >
                {{ roleLabel(role) }}
              </el-tag>
            </div>
          </el-descriptions-item>
        </el-descriptions>
      </SectionCard>

      <SectionCard class="access-overview__card">
        <template #header>
          <div class="permission-header">
            <span>{{ t('userRole.sectionPermissionList') }}</span>
            <el-tag size="small" effect="plain" type="info">{{ permissionList.length }}</el-tag>
          </div>
        </template>

        <EmptyState
          v-if="permissionList.length === 0"
          :description="t('userRole.emptyPermissions')"
        />

        <div v-else class="permission-list">
          <el-tag v-for="permissionName in permissionList" :key="permissionName" effect="plain">
            {{ permissionName }}
          </el-tag>
        </div>
      </SectionCard>
    </div>

    <div class="access-tree-anchor">
      <SectionCard class="access-tree-card">
        <template #header>
          <div class="access-tree__header">
            <div class="access-tree__title">
              <span>{{ t('userRole.sectionAccessTree') }}</span>
              <el-tag size="small" effect="plain" type="info">
                {{ t('userRole.matrixCount', { n: accessNodeCount }) }}
              </el-tag>
            </div>
            <el-input
              v-model="accessFilter"
              clearable
              size="small"
              class="access-tree__filter"
              :placeholder="t('userRole.filterAccessTree')"
              :aria-label="t('userRole.filterAccessTree')"
            />
          </div>
        </template>

        <el-tree
          ref="accessTreeRef"
          :data="accessTree"
          :props="accessTreeProps"
          :filter-node-method="filterAccessTreeNode"
          node-key="id"
          :expand-on-click-node="false"
          class="access-tree"
        >
          <template #default="{ data }">
            <div v-if="data.kind === 'group'" class="access-tree__group">
              <span class="access-tree__group-label">{{ data.label }}</span>
              <span class="access-tree__group-count">
                {{
                  t('userRole.groupAccessCount', {
                    allowed: data.allowedCount,
                    total: data.children.length,
                  })
                }}
              </span>
            </div>
            <div v-else class="access-tree__item">
              <div class="access-tree__item-main">
                <span class="access-tree__item-label">{{ data.label }}</span>
                <code class="access-tree__path">{{ data.path }}</code>
              </div>
              <div class="access-tree__item-meta">
                <el-tag v-if="data.requiredRole" size="small" effect="plain" type="info">
                  {{ roleLabel(data.requiredRole) }}
                </el-tag>
                <el-tag v-if="data.hidden" size="small" effect="plain" type="warning">
                  {{ t('userRole.hiddenMenu') }}
                </el-tag>
                <span v-if="data.requiredAuthorities" class="access-tree__authorities">
                  {{
                    t('userRole.authorityHint', {
                      authorities: data.requiredAuthorities.join(', '),
                    })
                  }}
                </span>
                <el-tag size="small" :type="data.allowed ? 'success' : 'danger'">
                  {{ data.allowed ? t('userRole.accessAllowed') : t('userRole.accessDenied') }}
                </el-tag>
              </div>
            </div>
          </template>
        </el-tree>
      </SectionCard>
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { RefreshCw as Refresh } from '@lucide/vue'
  import { useRefreshAction } from '@/composables/useRefreshAction'
  import { useResponsive } from '@/composables/useResponsive'
  import { navigationGroups, navigationItemTitleKey } from '@/constants/navigation'
  import {
    authorityRoleLabelKeyMap,
    resolveAuthorityRole,
    roleLabelKeyMap,
    roleOrder,
  } from '@/constants/role'
  import { useAuthStore } from '@/stores/auth'
  import { usePermissionStore } from '@/stores/permission'
  import { useTenantStore } from '@/stores/tenant'
  import type { Role } from '@/types'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'

  interface AccessTreeBaseNode {
    id: string
    label: string
  }

  interface AccessTreeItemNode extends AccessTreeBaseNode {
    kind: 'item'
    path: string
    requiredRole?: Role
    requiredAuthorities?: string[]
    allowed: boolean
    hidden: boolean
  }

  interface AccessTreeGroupNode extends AccessTreeBaseNode {
    kind: 'group'
    children: AccessTreeItemNode[]
    allowedCount: number
  }

  type AccessTreeNode = AccessTreeItemNode | AccessTreeGroupNode

  const { t, te } = useI18n({ useScope: 'global' })
  const refreshAction = useRefreshAction()
  const { isMobile } = useResponsive()

  const auth = useAuthStore()
  const permission = usePermissionStore()
  const tenant = useTenantStore()
  const refreshing = ref(false)
  const accessFilter = ref('')
  const accessTreeRef = ref<{ filter: (value: string) => void } | null>(null)
  const accessTreeProps = { label: 'label', children: 'children' }

  const currentUser = computed(() => auth.userInfo)
  const currentRole = computed<Role | undefined>(() => currentUser.value?.role ?? undefined)
  const permissionList = computed(() => currentUser.value?.permissions ?? [])
  const formalRoleLabel = computed(() => {
    const role = resolveAuthorityRole(permissionList.value)
    return role ? `${t(authorityRoleLabelKeyMap[role])} (${role})` : t('userRole.roleUnset')
  })
  const visibleAccessPaths = computed(() => {
    const paths = permission.visibleGroups.flatMap((group) =>
      group.children.map((item) => item.path),
    )
    return new Set(paths)
  })

  const accessNodeCount = computed(() =>
    navigationGroups.reduce((total, group) => total + group.children.length, 0),
  )

  const accessTree = computed<AccessTreeNode[]>(() =>
    navigationGroups.map((group) => {
      const children = group.children.map((item) => {
        const titleKey = navigationItemTitleKey(item)
        return {
          kind: 'item' as const,
          id: item.path,
          label: te(titleKey) ? t(titleKey) : item.title,
          path: item.path,
          requiredRole: item.minRole ?? group.minRole,
          requiredAuthorities: item.authorities,
          allowed: visibleAccessPaths.value.has(item.path),
          hidden: item.hidden === true,
        }
      })
      return {
        kind: 'group' as const,
        id: group.key,
        label: t(`nav.group.${group.key}`),
        allowedCount: children.filter((child) => child.allowed).length,
        children,
      }
    }),
  )

  function filterAccessTreeNode(value: string, data: unknown) {
    if (!value) return true
    if (typeof data !== 'object' || data === null || !('label' in data)) return false
    const node = data as { label: unknown; kind?: unknown; path?: unknown }
    if (typeof node.label !== 'string') return false
    const query = value.toLocaleLowerCase()
    if (node.label.toLocaleLowerCase().includes(query)) return true
    return (
      node.kind === 'item' &&
      typeof node.path === 'string' &&
      node.path.toLocaleLowerCase().includes(query)
    )
  }

  watch(accessFilter, (value) => accessTreeRef.value?.filter(value))

  function roleLabel(role?: Role) {
    return role ? t(roleLabelKeyMap[role]) : t('userRole.roleUnset')
  }

  async function refreshProfile() {
    refreshing.value = true
    try {
      await auth.fetchMe()
      ElMessage.success(t('userRole.loginRefreshedToast'))
    } finally {
      refreshing.value = false
    }
  }
</script>

<style scoped>
  .access-overview {
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
    align-items: start;
    gap: var(--space-md);
    min-width: 0;
  }

  .access-overview__card {
    min-width: 0;
  }

  .permission-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
  }

  .profile-panel :deep(.el-descriptions__table) {
    table-layout: fixed;
  }

  .profile-panel :deep(.el-descriptions__cell) {
    overflow-wrap: anywhere;
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

  .permission-list :deep(.el-tag) {
    max-width: 100%;
    overflow-wrap: anywhere;
    white-space: normal;
    height: auto;
    min-height: var(--control-height-sm);
  }

  .permission-list :deep(.el-tag__content) {
    min-width: 0;
    line-height: 1.35;
    overflow-wrap: anywhere;
    white-space: normal;
  }

  .access-tree-anchor {
    scroll-margin-top: 12px;
  }

  .access-tree__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    min-width: 0;
  }

  .access-tree__title,
  .access-tree__item-meta {
    display: inline-flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
    min-width: 0;
  }

  .access-tree__filter {
    width: min(100%, 320px);
  }

  .access-tree__group,
  .access-tree__item,
  .access-tree__item-main {
    display: flex;
    align-items: center;
    min-width: 0;
  }

  .access-tree__group {
    gap: var(--space-sm);
  }

  .access-tree__group-label,
  .access-tree__item-label {
    color: var(--color-text-primary);
    overflow-wrap: anywhere;
  }

  .access-tree__group-count,
  .access-tree__path,
  .access-tree__authorities {
    color: var(--color-text-secondary);
    font-size: var(--font-size-xs);
  }

  .access-tree__item {
    justify-content: space-between;
    gap: var(--space-md);
    width: 100%;
    padding: var(--space-xs) 0;
  }

  .access-tree__item-main {
    gap: var(--space-md);
    flex-wrap: wrap;
  }

  .access-tree__path {
    overflow-wrap: anywhere;
  }

  .access-tree__item-meta {
    justify-content: flex-end;
    flex: 0 0 auto;
  }

  .access-tree :deep(.el-tree-node__content) {
    min-height: 32px;
    height: auto;
  }

  @media (max-width: 1100px) {
    .access-overview {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @media (max-width: 720px) {
    .access-tree__header,
    .access-tree__item {
      align-items: flex-start;
      flex-direction: column;
    }

    .access-tree__filter {
      width: 100%;
    }

    .access-tree__item-meta {
      justify-content: flex-start;
    }
  }
</style>
