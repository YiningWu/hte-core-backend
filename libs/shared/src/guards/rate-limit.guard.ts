import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitService } from '../infrastructure/rate-limit.service';
import { RATE_LIMIT_KEY, RateLimitOptions } from '../decorators/rate-limit.decorator';
import { AuthenticatedUser } from '../auth/jwt.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly rateLimitService: RateLimitService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rateLimitOptions = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!rateLimitOptions) {
      return true; // No rate limiting applied
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const user: AuthenticatedUser = request.user;
    
    // Use user ID if authenticated, otherwise use IP
    const identifier = user ? user.user_id.toString() : request.ip;
    const endpoint = `${request.method}:${request.route?.path || request.url}`;

    const result = await this.rateLimitService.checkRateLimit(
      `rate_limit:${identifier}:${endpoint}`,
      rateLimitOptions
    );

    // Set rate limit headers
    response.setHeader('X-RateLimit-Limit', rateLimitOptions.maxRequests);
    response.setHeader('X-RateLimit-Remaining', result.remaining);
    response.setHeader('X-RateLimit-Reset', new Date(result.resetTime * 1000).toISOString());

    if (!result.allowed) {
      throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }
}