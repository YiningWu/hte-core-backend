import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '@eduhub/shared';
import { PayrollController } from './interfaces/controllers/payroll.controller';
import { PayrollService } from './application/services/payroll.service';
import { UserCompensation } from './domain/entities/user-compensation.entity';
import { PayrollRun } from './domain/entities/payroll-run.entity';
import { AuditLog } from './domain/entities/audit-log.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env'
    }),
    SharedModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get('DB_PORT', 3306),
        username: configService.get('DB_USERNAME', 'root'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('PAYROLL_SERVICE_DB') || configService.get('DB_DATABASE', 'payroll_service'),
        entities: [UserCompensation, PayrollRun, AuditLog],
        synchronize: configService.get('NODE_ENV') === 'development',
        logging: configService.get('NODE_ENV') === 'development',
        timezone: 'Asia/Taipei',
        charset: 'utf8mb4',
        extra: {
          connectionLimit: 10,
        }
      }),
      inject: [ConfigService]
    }),
    TypeOrmModule.forFeature([UserCompensation, PayrollRun, AuditLog])
  ],
  controllers: [PayrollController],
  providers: [PayrollService],
})
export class AppModule {}