import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

// Predefined role constants
export const USER_ROLES = {
  ADMIN: 'admin',
  HR: 'hr',
  FINANCE: 'finance',
  TEACHER: 'teacher',
  STAFF: 'staff',
  PRINCIPAL: 'principal'
} as const;