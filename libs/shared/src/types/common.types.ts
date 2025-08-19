export interface PaginationQuery {
  page_size?: number;
  cursor?: string;
}

export interface PaginationResponse<T> {
  items: T[];
  next_cursor?: string;
  total?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T | null;
}

export interface AuditLog {
  id: number;
  org_id: number;
  actor_user_id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  diff_json?: any;
  created_at: Date;
  request_id?: string;
}

export interface ChangeLog {
  id: number;
  org_id: number;
  entity_type: string;
  entity_id: number;
  field_name: string;
  old_value?: string;
  new_value?: string;
  changed_by: number;
  changed_at: Date;
  change_reason?: string;
  ip_address?: string;
  device_info?: string;
  request_id?: string;
  trace_id?: string;
}