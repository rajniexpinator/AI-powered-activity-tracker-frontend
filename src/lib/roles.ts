import type { User } from '@/types/auth'

export type UserRole = User['role']

export const ASSIGNABLE_ROLES_BY_ACTOR: Record<UserRole, UserRole[]> = {
  super_admin: ['super_admin', 'admin', 'employee'],
  admin: ['admin', 'employee'],
  employee: [],
}

export function isSuperAdmin(role?: string | null): boolean {
  return role === 'super_admin'
}

export function isAdminRole(role?: string | null): boolean {
  return role === 'admin' || role === 'super_admin'
}

export function isEmployeeRole(role?: string | null): boolean {
  return role === 'employee'
}

export function formatRoleLabel(role: UserRole): string {
  switch (role) {
    case 'super_admin':
      return 'Super Admin'
    case 'admin':
      return 'Admin'
    case 'employee':
      return 'Employee'
    default:
      return role
  }
}

export function assignableRolesFor(actor?: Pick<User, 'role'> | null): UserRole[] {
  if (!actor?.role) return []
  return ASSIGNABLE_ROLES_BY_ACTOR[actor.role] ?? []
}

/** Regular admins cannot modify or delete Super Admin accounts. */
export function canAdminManageUser(
  actor?: Pick<User, 'role'> | null,
  target?: Pick<User, 'role'> | null
): boolean {
  if (!target) return false
  if (isSuperAdmin(target.role) && !isSuperAdmin(actor?.role)) {
    return false
  }
  return true
}
