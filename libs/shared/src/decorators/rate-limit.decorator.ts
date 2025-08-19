import { SetMetadata } from '@nestjs/common';

export interface RateLimitOptions {
  windowSeconds: number;
  maxRequests: number;
}

export const RATE_LIMIT_KEY = 'rateLimit';
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);