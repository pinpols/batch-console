import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import type { Role } from '@/types'

export function usePermission() {
  const auth = useAuthStore()
  const app = useAppStore()
  const role = computed(() => auth.role)

  function canAccess(minRole: Role) {
    return auth.canAccess(minRole)
  }

  function hasPermission(permission: string) {
    return auth.hasPermission(permission)
  }

  /**
   * 是否具备"写配置"能力(治理 / 配置发布 / 告警路由 / 任务 / Pipeline 定义等写操作)。
   *
   * Why:后端四类正式角色中 AUDITOR / TENANT_USER 没有配置写权限,日志里大量 403
   * "console access denied: POST /api/console/queues" 来自前端没隐藏 Create 按钮。
   * OPERATOR/VIEWER 是前端能力档，不是 Spring authority；这里只看四类正式角色。
   */
  const canMutateConfig = computed(
    () =>
      (!app.writesFrozen || auth.hasPermission('ROLE_ADMIN')) &&
      (auth.hasPermission('ROLE_ADMIN') || auth.hasPermission('ROLE_TENANT_ADMIN')),
  )

  /** 仅 ADMIN 能做的高危操作(用户管理、租户管理等) */
  const canManageSystem = computed(() => auth.hasPermission('ROLE_ADMIN'))

  return {
    role,
    canAccess,
    hasPermission,
    canMutateConfig,
    canManageSystem,
  }
}
