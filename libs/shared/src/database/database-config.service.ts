import { Injectable } from '@nestjs/common';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export interface DatabaseConnectionConfig {
  master: TypeOrmModuleOptions;
  slave?: TypeOrmModuleOptions;
}

@Injectable()
export class DatabaseConfigService implements TypeOrmOptionsFactory {
  constructor(private configService: ConfigService) {}

  createTypeOrmOptions(connectionName?: string): TypeOrmModuleOptions {
    const isDevelopment = this.configService.get('NODE_ENV') === 'development';
    const enableSlaveReads = this.configService.get('ENABLE_SLAVE_READS', 'false') === 'true';

    const masterConfig: TypeOrmModuleOptions = {
      type: 'mysql',
      host: this.configService.get('DB_MASTER_HOST') || this.configService.get('DB_HOST') || 'localhost',
      port: parseInt(this.configService.get('DB_MASTER_PORT') || this.configService.get('DB_PORT') || '3306', 10),
      username: this.configService.get('DB_MASTER_USERNAME') || this.configService.get('DB_USERNAME') || 'root',
      password: this.configService.get('DB_MASTER_PASSWORD') || this.configService.get('DB_PASSWORD') || '',
      database: this.configService.get('DB_DATABASE') as string,
      synchronize: isDevelopment,
      logging: isDevelopment ? ['query', 'error'] : ['error'],
      timezone: 'Asia/Taipei',
      charset: 'utf8mb4',
      extra: {
        connectionLimit: parseInt(this.configService.get('DB_CONNECTION_LIMIT', '10'), 10),
        acquireTimeout: 60000,
        timeout: 60000,
        reconnect: true
      },
      cache: {
        type: 'redis',
        options: {
          host: this.configService.get('REDIS_HOST', 'localhost'),
          port: parseInt(this.configService.get('REDIS_PORT', '6379'), 10),
          password: this.configService.get('REDIS_PASSWORD'),
          db: parseInt(this.configService.get('REDIS_CACHE_DB', '1'), 10)
        },
        duration: 30000 // 30 seconds
      }
    };

    // Replication is temporarily disabled for development
    // If slave reads are enabled and slave config is provided
    // if (enableSlaveReads && this.configService.get('DB_SLAVE_HOST')) {
    //   const slaveConfig = {
    //     ...masterConfig,
    //     host: this.configService.get('DB_SLAVE_HOST'),
    //     port: parseInt(this.configService.get('DB_SLAVE_PORT') || this.configService.get('DB_PORT') || '3306', 10),
    //     username: this.configService.get('DB_SLAVE_USERNAME') || this.configService.get('DB_USERNAME') || 'root',
    //     password: this.configService.get('DB_SLAVE_PASSWORD') || this.configService.get('DB_PASSWORD') || '',
    //     // Slave should not sync schema
    //     synchronize: false
    //   };

    //   // Configure replication
    //   return {
    //     ...masterConfig,
    //     replication: {
    //       master: {
    //         host: masterConfig.host as string,
    //         port: masterConfig.port as number,
    //         username: masterConfig.username as string,
    //         password: masterConfig.password as string,
    //         database: masterConfig.database as string
    //       },
    //       slaves: [{
    //         host: slaveConfig.host as string,
    //         port: slaveConfig.port as number,
    //         username: slaveConfig.username as string,
    //         password: slaveConfig.password as string,
    //         database: slaveConfig.database as string
    //       }]
    //     }
    //   };
    // }

    return masterConfig;
  }

  /**
   * Get configuration for specific service database
   */
  getServiceDatabaseConfig(serviceName: string): TypeOrmModuleOptions {
    const baseConfig = this.createTypeOrmOptions();
    
    return {
      ...baseConfig,
      database: this.configService.get(`${serviceName.toUpperCase()}_SERVICE_DB`) || 
                this.configService.get('DB_DATABASE') as string
    } as TypeOrmModuleOptions;
  }

  /**
   * Create read-only connection options for reporting queries
   */
  createReadOnlyOptions(): TypeOrmModuleOptions {
    const baseConfig = this.createTypeOrmOptions();
    
    // Replication disabled for development
    // Use slave if available, otherwise master
    // if (baseConfig.replication) {
    //   return {
    //     ...baseConfig,
    //     // Force read from slave
    //     replication: {
    //       ...baseConfig.replication,
    //       removeNodeErrorCount: 1,
    //       restoreNodeTimeout: 5000,
    //       selector: 'RR' // Round Robin
    //     }
    //   };
    // }

    return {
      ...baseConfig,
      // Add read-only connection settings
      extra: {
        ...baseConfig.extra,
        flags: '-FOUND_ROWS'
      }
    };
  }
}