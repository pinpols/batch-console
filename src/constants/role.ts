import type { Role } from '@/types'

export const roleOrder: Role[] = ['VIEWER', 'OPERATOR', 'ADMIN']

export const roleLabelMap: Record<Role, string> = {
  VIEWER: '查看者',
  OPERATOR: '操作员',
  ADMIN: '管理员',
}

