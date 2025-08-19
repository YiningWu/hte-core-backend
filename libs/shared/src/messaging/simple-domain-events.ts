// Simplified domain events for development
export const DOMAIN_EVENTS = {
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated', 
  USER_DELETED: 'user.deleted',
  CAMPUS_CREATED: 'campus.created',
  CAMPUS_UPDATED: 'campus.updated',
  CAMPUS_DELETED: 'campus.deleted',
  COMPENSATION_CREATED: 'compensation.created',
  COMPENSATION_UPDATED: 'compensation.updated',
  PAYROLL_GENERATED: 'payroll.generated',
  PAYROLL_CONFIRMED: 'payroll.confirmed'
} as const;

export interface BaseEvent {
  eventType: string;
  aggregateId: number;
  aggregateType: string;
  orgId: number;
  timestamp: Date;
  version: number;
  correlationId?: string;
  causationId?: string;
}

export interface UserCreatedEvent extends BaseEvent {
  eventType: typeof DOMAIN_EVENTS.USER_CREATED;
  aggregateType: 'User';
  payload: {
    userId: number;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    roles: string[];
  };
}

export interface UserUpdatedEvent extends BaseEvent {
  eventType: typeof DOMAIN_EVENTS.USER_UPDATED;
  aggregateType: 'User';
  payload: {
    userId: number;
    changes: Record<string, any>;
    previousValues: Record<string, any>;
  };
}

export interface UserDeletedEvent extends BaseEvent {
  eventType: typeof DOMAIN_EVENTS.USER_DELETED;
  aggregateType: 'User';
  payload: {
    userId: number;
    username: string;
    deletedAt: Date;
  };
}

export interface CampusCreatedEvent extends BaseEvent {
  eventType: typeof DOMAIN_EVENTS.CAMPUS_CREATED;
  aggregateType: 'Campus';
  payload: {
    campusId: number;
    name: string;
    address: string;
  };
}

export interface CampusUpdatedEvent extends BaseEvent {
  eventType: typeof DOMAIN_EVENTS.CAMPUS_UPDATED;
  aggregateType: 'Campus';
  payload: {
    campusId: number;
    changes: Record<string, any>;
  };
}

export interface CampusDeletedEvent extends BaseEvent {
  eventType: typeof DOMAIN_EVENTS.CAMPUS_DELETED;
  aggregateType: 'Campus';
  payload: {
    campusId: number;
    name: string;
  };
}

export interface CompensationCreatedEvent extends BaseEvent {
  eventType: typeof DOMAIN_EVENTS.COMPENSATION_CREATED;
  aggregateType: 'UserCompensation';
  payload: {
    compensationId: number;
    userId: number;
    baseSalary: number;
    effectiveDate: Date;
  };
}

export interface CompensationUpdatedEvent extends BaseEvent {
  eventType: typeof DOMAIN_EVENTS.COMPENSATION_UPDATED;
  aggregateType: 'UserCompensation';
  payload: {
    compensationId: number;
    userId: number;
    changes: Record<string, any>;
  };
}

export interface PayrollGeneratedEvent extends BaseEvent {
  eventType: typeof DOMAIN_EVENTS.PAYROLL_GENERATED;
  aggregateType: 'PayrollRun';
  payload: {
    payrollRunId: number;
    year: number;
    month: number;
    totalEmployees: number;
    totalAmount: number;
  };
}

export interface PayrollConfirmedEvent extends BaseEvent {
  eventType: typeof DOMAIN_EVENTS.PAYROLL_CONFIRMED;
  aggregateType: 'PayrollRun';
  payload: {
    payrollRunId: number;
    confirmedAt: Date;
    confirmedBy: number;
  };
}

export type SimpleDomainEvent = 
  | UserCreatedEvent
  | UserUpdatedEvent  
  | UserDeletedEvent
  | CampusCreatedEvent
  | CampusUpdatedEvent
  | CampusDeletedEvent
  | CompensationCreatedEvent
  | CompensationUpdatedEvent
  | PayrollGeneratedEvent
  | PayrollConfirmedEvent;