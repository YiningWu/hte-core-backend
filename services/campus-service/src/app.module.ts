import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '@eduhub/shared';
import { CampusController } from './interfaces/controllers/campus.controller';
import { OrgController } from './interfaces/controllers/org.controller';
import { TaxProfileController } from './interfaces/controllers/tax-profile.controller';
import { CampusService } from './application/services/campus.service';
import { OrgService } from './application/services/org.service';
import { TaxProfileService } from './application/services/tax-profile.service';
import { Campus } from './domain/entities/campus.entity';
import { Classroom } from './domain/entities/classroom.entity';
import { Org } from './domain/entities/org.entity';
import { TaxProfile } from './domain/entities/tax-profile.entity';
import { CampusBillingProfile } from './domain/entities/campus-billing-profile.entity';
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
        database: configService.get('CAMPUS_SERVICE_DB') || configService.get('DB_DATABASE', 'campus_service'),
        entities: [Campus, Classroom, Org, TaxProfile, CampusBillingProfile, AuditLog],
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
    TypeOrmModule.forFeature([Campus, Classroom, Org, TaxProfile, CampusBillingProfile, AuditLog])
  ],
  controllers: [CampusController, OrgController, TaxProfileController],
  providers: [CampusService, OrgService, TaxProfileService],
})
export class AppModule {}