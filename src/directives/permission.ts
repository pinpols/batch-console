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
    const minRole = typeof value === 'object' ? value.minRole : undefined
    const permissions =
      typeof value === 'object' ? value.permissions : typeof value === 'string' ? value : undefined

    const allowedByRole = minRole ? auth.canAccess(minRole) : true
    const allowedByPermission = hasPermissions(permissions)

    if (!allowedByRole || !allowedByPermission) {
      el.remove()
    }
  },
}
