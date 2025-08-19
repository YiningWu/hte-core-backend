import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule, AuthController } from '@eduhub/shared';
import { UserController } from './interfaces/controllers/user.controller';
import { UserService } from './application/services/user.service';
import { User } from './domain/entities/user.entity';
import { Role } from './domain/entities/role.entity';
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
        database: configService.get('USER_SERVICE_DB') || configService.get('DB_DATABASE', 'user_service'),
        entities: [User, Role, AuditLog],
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
    TypeOrmModule.forFeature([User, Role, AuditLog])
  ],
  controllers: [UserController, AuthController],
  providers: [UserService],
})
export class AppModule {}