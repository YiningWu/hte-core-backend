import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { SharedModule, AuthController } from '@eduhub/shared';

// Controllers
import { HealthController } from './interfaces/controllers/health.controller';
import { LedgerBooksController } from './interfaces/controllers/ledger-books.controller';
import { LedgerCategoriesController } from './interfaces/controllers/ledger-categories.controller';
import { LedgerEntriesController } from './interfaces/controllers/ledger-entries.controller';
import { BillingReportsController } from './interfaces/controllers/billing-reports.controller';

// Services
import { LedgerBookService } from './application/services/ledger-book.service';
import { LedgerCategoryService } from './application/services/ledger-category.service';
import { LedgerEntryService } from './application/services/ledger-entry.service';
import { BillingReportsService } from './application/services/billing-reports.service';

// Entities
import { LedgerBook } from './domain/entities/ledger-book.entity';
import { LedgerCategory } from './domain/entities/ledger-category.entity';
import { LedgerEntry } from './domain/entities/ledger-entry.entity';
import { LedgerEntryTeacherShare } from './domain/entities/ledger-entry-teacher-share.entity';
import { LedgerAttachment } from './domain/entities/ledger-attachment.entity';
import { LedgerAudit } from './domain/entities/ledger-audit.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env'
    }),
    SharedModule,
    CacheModule.register({
      ttl: 1800, // 30分钟默认缓存
      max: 1000, // 最大缓存条目数
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get('DB_PORT', 3306),
        username: configService.get('DB_USERNAME', 'root'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('BILLING_SERVICE_DB') || configService.get('DB_DATABASE', 'billing_service'),
        entities: [
          LedgerBook,
          LedgerCategory,
          LedgerEntry,
          LedgerEntryTeacherShare,
          LedgerAttachment,
          LedgerAudit
        ],
        synchronize: configService.get('NODE_ENV') === 'development',
        logging: configService.get('NODE_ENV') === 'development' ? ['error', 'warn'] : false,
        timezone: 'Asia/Taipei',
        charset: 'utf8mb4',
        extra: {
          connectionLimit: 20,
          acquireTimeout: 60000,
          timeout: 60000,
        },
        // 生产环境下的连接池配置
        ...(configService.get('NODE_ENV') === 'production' && {
          poolSize: 20,
          retryAttempts: 3,
          retryDelay: 3000,
        })
      }),
      inject: [ConfigService]
    }),
    TypeOrmModule.forFeature([
      LedgerBook,
      LedgerCategory,
      LedgerEntry,
      LedgerEntryTeacherShare,
      LedgerAttachment,
      LedgerAudit
    ])
  ],
  controllers: [
    HealthController,
    AuthController,
    LedgerBooksController,
    LedgerCategoriesController,
    LedgerEntriesController,
    BillingReportsController
  ],
  providers: [
    LedgerBookService,
    LedgerCategoryService,
    LedgerEntryService,
    BillingReportsService
  ],
  exports: [
    LedgerBookService,
    LedgerCategoryService,
    LedgerEntryService,
    BillingReportsService
  ]
})
export class AppModule {}