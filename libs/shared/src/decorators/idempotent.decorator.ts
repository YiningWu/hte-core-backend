import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENT_KEY = 'idempotent';

export interface IdempotentOptions {
  ttlSeconds?: number;
  keyField?: string; // Default is X-Request-Id
}

export const Idempotent = (options: IdempotentOptions = {}) =>
  SetMetadata(IDEMPOTENT_KEY, {
    ttlSeconds: options.ttlSeconds || 300, // 5 minutes default
    keyField: options.keyField || 'x-request-id'
  });