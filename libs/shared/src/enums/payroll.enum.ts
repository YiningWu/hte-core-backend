export enum PayrollStatus {
  DRAFT = 'draft',
  CONFIRMED = 'confirmed',
  PAID = 'paid'
}

export enum ChangeAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete'
}

export enum EntityType {
  USER = 'user',
  CAMPUS = 'campus',
  USER_COMPENSATION = 'user_compensation',
  PAYROLL_RUN = 'payroll_run',
  CLASSROOM = 'classroom'
}