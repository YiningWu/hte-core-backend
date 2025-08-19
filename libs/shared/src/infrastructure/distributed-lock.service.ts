import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

interface LockOptions {
  ttlSeconds?: number;
  retryDelayMs?: number;
  maxRetries?: number;
}

@Injectable()
export class DistributedLockService {
  private readonly logger = new Logger(DistributedLockService.name);
  private readonly DEFAULT_TTL = 60; // 60 seconds
  private readonly DEFAULT_RETRY_DELAY = 100; // 100ms
  private readonly DEFAULT_MAX_RETRIES = 10;

  constructor(private readonly redisService: RedisService) {}

  async acquireLock(
    lockKey: string, 
    lockValue: string = this.generateLockValue(),
    options: LockOptions = {}
  ): Promise<string | null> {
    const {
      ttlSeconds = this.DEFAULT_TTL,
      retryDelayMs = this.DEFAULT_RETRY_DELAY,
      maxRetries = this.DEFAULT_MAX_RETRIES
    } = options;

    const client = this.redisService.getClient();
    let retries = 0;

    while (retries <= maxRetries) {
      try {
        // 使用 SET NX EX 原子操作获取锁
        const result = await client.set(lockKey, lockValue, 'PX', ttlSeconds * 1000, 'NX');
        
        if (result === 'OK') {
          this.logger.debug(`Lock acquired: ${lockKey}`);
          return lockValue;
        }

        if (retries < maxRetries) {
          await this.delay(retryDelayMs);
          retries++;
        } else {
          this.logger.warn(`Failed to acquire lock after ${maxRetries} retries: ${lockKey}`);
          return null;
        }
      } catch (error) {
        this.logger.error(`Error acquiring lock ${lockKey}:`, error);
        return null;
      }
    }

    return null;
  }

  async releaseLock(lockKey: string, lockValue: string): Promise<boolean> {
    try {
      const client = this.redisService.getClient();
      
      // 使用 Lua 脚本确保原子性释放锁
      const luaScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      const result = await client.eval(luaScript, 1, lockKey, lockValue) as number;
      
      if (result === 1) {
        this.logger.debug(`Lock released: ${lockKey}`);
        return true;
      } else {
        this.logger.warn(`Failed to release lock (may have expired): ${lockKey}`);
        return false;
      }
    } catch (error) {
      this.logger.error(`Error releasing lock ${lockKey}:`, error);
      return false;
    }
  }

  async extendLock(lockKey: string, lockValue: string, ttlSeconds: number): Promise<boolean> {
    try {
      const client = this.redisService.getClient();
      
      const luaScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("expire", KEYS[1], ARGV[2])
        else
          return 0
        end
      `;

      const result = await client.eval(luaScript, 1, lockKey, lockValue, ttlSeconds) as number;
      return result === 1;
    } catch (error) {
      this.logger.error(`Error extending lock ${lockKey}:`, error);
      return false;
    }
  }

  async withLock<T>(
    lockKey: string,
    operation: () => Promise<T>,
    options: LockOptions = {}
  ): Promise<T | null> {
    const lockValue = this.generateLockValue();
    const acquired = await this.acquireLock(lockKey, lockValue, options);

    if (!acquired) {
      this.logger.warn(`Could not acquire lock for operation: ${lockKey}`);
      return null;
    }

    try {
      const result = await operation();
      return result;
    } finally {
      await this.releaseLock(lockKey, lockValue);
    }
  }

  // 预定义的锁键生成方法
  getUserLockKey(userId: number): string {
    return `lock:user:${userId}`;
  }

  getCompensationLockKey(userId: number): string {
    return `lock:compensation:user:${userId}`;
  }

  getPayrollLockKey(orgId: number, month: string): string {
    return `lock:payroll:month:${orgId}:${month}`;
  }

  getCampusLockKey(campusId: number): string {
    return `lock:campus:${campusId}`;
  }

  private generateLockValue(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}