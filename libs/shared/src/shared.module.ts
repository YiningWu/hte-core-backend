import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import Redis from 'ioredis';

// Infrastructure Services
import { RedisService } from './infrastructure/redis.service';
import { CacheService } from './infrastructure/cache.service';
import { DistributedLockService } from './infrastructure/distributed-lock.service';
import { RateLimitService } from './infrastructure/rate-limit.service';

// Authentication & Security
import { JwtService } from './auth/jwt.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { EncryptionService } from './encryption/encryption.service';

// Communication & Messaging
import { ServiceClient } from './communication/service-client';
import { EventEmitterService } from './communication/event-emitter.service';
import { MessageBrokerService } from './messaging/simple-message-broker.service';

// Database & Config
import { DatabaseConfigService } from './database/database-config.service';

// Storage & Tracing
// Temporarily disabled for development - uncomment when AWS SDK is available
// import { StorageService } from './storage/storage.service';
// import { StorageController } from './storage/storage.controller';
// Temporarily disabled for development
// import { TracingService } from './tracing/tracing.service';
// import { TracingInterceptor } from './interceptors/tracing.interceptor';

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [
    // StorageController // Temporarily disabled for development
  ],
  providers: [
    // Redis Connection
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService) => {
        return new Redis({
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
          db: configService.get('REDIS_DB', 0),
          maxRetriesPerRequest: 3,
          lazyConnect: true,
        });
      },
      inject: [ConfigService],
    },
    
    // Infrastructure Services
    RedisService,
    CacheService,
    DistributedLockService,
    RateLimitService,
    
    // Security Services
    JwtService,
    EncryptionService,
    
    // Communication Services
    ServiceClient,
    EventEmitterService,
    MessageBrokerService,
    
    // Database & Config
    DatabaseConfigService,
    
    // Storage & Tracing
    // StorageService, // Temporarily disabled for development
    // TracingService, // Temporarily disabled for development
    // TracingInterceptor, // Temporarily disabled for development
    
    // Global Guards
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
  exports: [
    // Infrastructure Services
    RedisService,
    CacheService,
    DistributedLockService,
    RateLimitService,
    
    // Security Services
    JwtService,
    JwtAuthGuard,
    RolesGuard,
    RateLimitGuard,
    EncryptionService,
    
    // Communication Services
    ServiceClient,
    EventEmitterService,
    MessageBrokerService,
    
    // Database & Config
    DatabaseConfigService,
    
    // Storage & Tracing
    // StorageService, // Temporarily disabled for development
    // TracingService, // Temporarily disabled for development
    // TracingInterceptor, // Temporarily disabled for development
    
    // Redis Client for direct access
    'REDIS_CLIENT',
  ],
})
export class SharedModule {}