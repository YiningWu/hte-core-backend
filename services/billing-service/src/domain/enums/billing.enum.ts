export enum EntryType {
  INCOME = 'income',
  EXPENSE = 'expense'
}

export enum EntryStatus {
  NORMAL = 'normal',
  VOIDED = 'voided',
  DRAFT = 'draft'
}

export enum LedgerBookStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived'
}

export enum Currency {
  CNY = 'CNY',
  USD = 'USD',
  TWD = 'TWD'
}

export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  VOID = 'void',
  DELETE = 'delete'
}

export enum EntityType {
  BOOK = 'book',
  ENTRY = 'entry',
  CATEGORY = 'category'
}