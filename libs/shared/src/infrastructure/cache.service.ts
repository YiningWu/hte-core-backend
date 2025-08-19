import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly DEFAULT_TTL = 900; // 15 minutes

  constructor(private readonly redisService: RedisService) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redisService.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds: number = this.DEFAULT_TTL): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await this.redisService.set(key, serialized, ttlSeconds);
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redisService.del(key);
    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}:`, error);
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const client = this.redisService.getClient();
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(...keys);
        this.logger.log(`Invalidated ${keys.length} cache entries matching pattern: ${pattern}`);
      }
    } catch (error) {
      this.logger.error(`Cache pattern invalidation error for pattern ${pattern}:`, error);
    }
  }

  // 用户缓存方法
  getUserKey(userId: number): string {
    return `user:${userId}`;
  }

  async cacheUser(user: any, ttlSeconds: number = 1800): Promise<void> {
    const key = this.getUserKey(user.user_id);
    await this.set(key, user, ttlSeconds);
  }

  async getCachedUser(userId: number): Promise<any | null> {
    const key = this.getUserKey(userId);
    return this.get(key);
  }

  async invalidateUser(userId: number): Promise<void> {
    const key = this.getUserKey(userId);
    await this.del(key);
  }

  // 校区缓存方法
  getCampusKey(campusId: number): string {
    return `campus:${campusId}`;
  }

  async cacheCampus(campus: any, ttlSeconds: number = 1800): Promise<void> {
    const key = this.getCampusKey(campus.campus_id);
    await this.set(key, campus, ttlSeconds);
  }

  async getCachedCampus(campusId: number): Promise<any | null> {
    const key = this.getCampusKey(campusId);
    return this.get(key);
  }

  async invalidateCampus(campusId: number): Promise<void> {
    const key = this.getCampusKey(campusId);
    await this.del(key);
  }

  // 薪资缓存方法
  getCompensationKey(userId: number, date: string): string {
    return `compensation:${userId}:${date}`;
  }

  async cacheCompensation(userId: number, date: string, compensation: any, ttlSeconds: number = 3600): Promise<void> {
    const key = this.getCompensationKey(userId, date);
    await this.set(key, compensation, ttlSeconds);
  }

  async getCachedCompensation(userId: number, date: string): Promise<any | null> {
    const key = this.getCompensationKey(userId, date);
    return this.get(key);
  }

  async invalidateUserCompensations(userId: number): Promise<void> {
    await this.invalidatePattern(`compensation:${userId}:*`);
  }

  // 月度计算缓存
  getMonthlyCalculationKey(userId: number, month: string): string {
    return `monthly:${userId}:${month}`;
  }

  async cacheMonthlyCalculation(userId: number, month: string, calculation: any, ttlSeconds: number = 7200): Promise<void> {
    const key = this.getMonthlyCalculationKey(userId, month);
    await this.set(key, calculation, ttlSeconds);
  }

  async getCachedMonthlyCalculation(userId: number, month: string): Promise<any | null> {
    const key = this.getMonthlyCalculationKey(userId, month);
    return this.get(key);
  }
}