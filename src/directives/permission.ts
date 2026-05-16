import type { Directive } from 'vue'
import { useAuthStore } from '@/stores/auth'
import type { Role } from '@/types'

type PermissionValue =
  | string
  | string[]
  | {
      permissions?: string | string[]
      minRole?: Role
    }

function normalizeList(value?: string | string[]) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function hasPermissions(required?: string | string[]) {
  const auth = useAuthStore()
  const permissions = normalizeList(required)
  if (permissions.length === 0) return true
  return permissions.some((permission) => auth.hasPermission(permission))
}

export const permissionDirective: Directive<HTMLElement, PermissionValue> = {
  mounted(el, binding) {
    const auth = useAuthStore()
    const value = binding.value
    // typeof Array === 'object',先剥离数组形态,再访问 {minRole, permissions} 字段
    const isObjectShape = value != null && typeof value === 'object' && !Array.isArray(value)
    const minRole: Role | undefined = isObjectShape
      ? (value as { minRole?: Role }).minRole
      : undefined
    const permissions: string | string[] | undefined = isObjectShape
      ? (value as { permissions?: string | string[] }).permissions
      : typeof value === 'string' || Array.isArray(value)
        ? (value as string | string[])
        : undefined

    const allowedByRole = minRole ? auth.canAccess(minRole) : true
    const allowedByPermission = hasPermissions(permissions)

    if (!allowedByRole || !allowedByPermission) {
      el.remove()
    }
  },
}
