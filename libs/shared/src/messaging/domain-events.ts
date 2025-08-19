// Domain Event Types
export const DOMAIN_EVENTS = {
  // User Domain Events
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  USER_STATUS_CHANGED: 'user.status.changed',
  USER_ROLE_ASSIGNED: 'user.role.assigned',

  // Campus Domain Events
  ORG_CREATED: 'org.created',
  ORG_UPDATED: 'org.updated',
  ORG_DELETED: 'org.deleted',
  CAMPUS_CREATED: 'campus.created',
  CAMPUS_UPDATED: 'campus.updated',
  CAMPUS_DELETED: 'campus.deleted',
  CAMPUS_PRINCIPAL_ASSIGNED: 'campus.principal.assigned',
  CLASSROOM_CREATED: 'classroom.created',
  CLASSROOM_UPDATED: 'classroom.updated',
  CLASSROOM_DELETED: 'classroom.deleted',

  // Payroll Domain Events
  COMPENSATION_CREATED: 'compensation.created',
  COMPENSATION_UPDATED: 'compensation.updated',
  COMPENSATION_DELETED: 'compensation.deleted',
  PAYROLL_GENERATED: 'payroll.generated',
  PAYROLL_CONFIRMED: 'payroll.confirmed',
  PAYROLL_PAID: 'payroll.paid',
  BATCH_PAYROLL_STARTED: 'batch.payroll.started',
  BATCH_PAYROLL_COMPLETED: 'batch.payroll.completed',

  // System Events
  SYSTEM_BACKUP_STARTED: 'system.backup.started',
  SYSTEM_BACKUP_COMPLETED: 'system.backup.completed',
  SYSTEM_MAINTENANCE_MODE: 'system.maintenance.mode'
} as const;

// Event Payload Interfaces
export interface UserCreatedEvent {
  userId: number;
  orgId: number;
  username: string;
  email: string;
  campusId?: number;
  roles: string[];
  createdBy: number;
}

export interface UserUpdatedEvent {
  userId: number;
  orgId: number;
  changes: Record<string, { from: any; to: any }>;
  updatedBy: number;
  reason?: string;
}

export interface UserDeletedEvent {
  userId: number;
  orgId: number;
  deletedBy: number;
  reason?: string;
}

export interface CampusCreatedEvent {
  campusId: number;
  orgId: number;
  name: string;
  code: string;
  type: string;
  principalUserId?: number;
  createdBy: number;
}

export interface CampusUpdatedEvent {
  campusId: number;
  orgId: number;
  changes: Record<string, { from: any; to: any }>;
  updatedBy: number;
}

export interface CampusPrincipalAssignedEvent {
  campusId: number;
  orgId: number;
  previousPrincipalId?: number;
  newPrincipalId: number;
  assignedBy: number;
}

export interface CompensationCreatedEvent {
  compensationId: number;
  userId: number;
  orgId: number;
  baseSalary: number;
  perfSalary: number;
  validFrom: string;
  validTo?: string;
  reason: string;
  createdBy: number;
}

export interface PayrollGeneratedEvent {
  runId: number;
  userId: number;
  orgId: number;
  month: string;
  grossAmount: number;
  netAmount: number;
  status: string;
  generatedBy: number;
}

export interface PayrollConfirmedEvent {
  runId: number;
  userId: number;
  orgId: number;
  month: string;
  confirmedBy: number;
  confirmedAt: string;
}

export interface BatchPayrollStartedEvent {
  batchId: string;
  orgId: number;
  month: string;
  estimatedCount: number;
  startedBy: number;
}

export interface BatchPayrollCompletedEvent {
  batchId: string;
  orgId: number;
  month: string;
  processedCount: number;
  successCount: number;
  failureCount: number;
  completedAt: string;
}