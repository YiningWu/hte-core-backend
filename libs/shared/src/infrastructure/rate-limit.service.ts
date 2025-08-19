import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

interface RateLimitOptions {
  windowSeconds: number;
  maxRequests: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  constructor(private readonly redisService: RedisService) {}

  async checkRateLimit(
    key: string, 
    options: RateLimitOptions
  ): Promise<RateLimitResult> {
    const { windowSeconds, maxRequests } = options;
    const client = this.redisService.getClient();
    
    try {
      const now = Math.floor(Date.now() / 1000);
      const windowStart = now - windowSeconds;

      // 使用 Lua 脚本实现滑动窗口限流
      const luaScript = `
        local key = KEYS[1]
        local window_start = tonumber(ARGV[1])
        local now = tonumber(ARGV[2])
        local max_requests = tonumber(ARGV[3])
        local window_seconds = tonumber(ARGV[4])

        -- 移除过期的记录
        redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)

        -- 获取当前窗口内的请求数
        local current_requests = redis.call('ZCARD', key)

        if current_requests < max_requests then
          -- 添加当前请求
          redis.call('ZADD', key, now, now)
          redis.call('EXPIRE', key, window_seconds * 2)
          return {1, max_requests - current_requests - 1, now + window_seconds}
        else
          return {0, 0, now + window_seconds}
        end
      `;

      const result = await client.eval(
        luaScript, 
        1, 
        key, 
        windowStart.toString(),
        now.toString(),
        maxRequests.toString(),
        windowSeconds.toString()
      ) as [number, number, number];

      return {
        allowed: result[0] === 1,
        remaining: result[1],
        resetTime: result[2]
      };
    } catch (error) {
      this.logger.error(`Rate limit check error for key ${key}:`, error);
      // 在错误情况下默认允许请求
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetTime: Math.floor(Date.now() / 1000) + windowSeconds
      };
    }
  }

  async checkApiRateLimit(
    userId: number, 
    endpoint: string,
    options: RateLimitOptions = { windowSeconds: 60, maxRequests: 100 }
  ): Promise<RateLimitResult> {
    const key = `rate_limit:api:${userId}:${endpoint}`;
    return this.checkRateLimit(key, options);
  }

  async checkGlobalRateLimit(
    clientId: string,
    options: RateLimitOptions = { windowSeconds: 3600, maxRequests: 1000 }
  ): Promise<RateLimitResult> {
    const key = `rate_limit:global:${clientId}`;
    return this.checkRateLimit(key, options);
  }

  async checkBatchOperationRateLimit(
    userId: number,
    operation: string,
    options: RateLimitOptions = { windowSeconds: 3600, maxRequests: 10 }
  ): Promise<RateLimitResult> {
    const key = `rate_limit:batch:${userId}:${operation}`;
    return this.checkRateLimit(key, options);
  }

  // 预设的限流配置
  static readonly RATE_LIMITS = {
    USER_CREATION: { windowSeconds: 300, maxRequests: 10 }, // 5分钟内最多创建10个用户
    PAYROLL_GENERATION: { windowSeconds: 3600, maxRequests: 5 }, // 1小时内最多生成5次批量工资单
    COMPENSATION_UPDATE: { windowSeconds: 60, maxRequests: 20 }, // 1分钟内最多更新20次薪资
    API_DEFAULT: { windowSeconds: 60, maxRequests: 100 }, // 1分钟内最多100次API调用
    BATCH_OPERATION: { windowSeconds: 3600, maxRequests: 3 }, // 1小时内最多3次批量操作
  };
}