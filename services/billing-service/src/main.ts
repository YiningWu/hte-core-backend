import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { GlobalExceptionFilter } from '@eduhub/shared';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('BillingService');
  
  // 使用Fastify作为HTTP引擎
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true })
  );

  const configService = app.get(ConfigService);

  // 启用CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // 全局路径前缀
  app.setGlobalPrefix('core');

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    })
  );

  // 全局异常过滤器
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Fastify插件
  await app.register(require('@fastify/helmet'), {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  });

  await app.register(require('@fastify/compress'), {
    encodings: ['gzip', 'deflate'],
  });

  // Swagger文档配置
  if (configService.get('NODE_ENV') === 'development') {
    const config = new DocumentBuilder()
      .setTitle('账单服务 API')
      .setDescription('EduHub 账单管理服务接口文档')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('账本管理', '账本相关操作')
      .addTag('类目管理', '收支类目管理')
      .addTag('账单管理', '账单条目管理')
      .addTag('账单报表', '统计报表相关')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });

    logger.log(`Swagger文档地址: http://localhost:${configService.get('PORT', 3004)}/api/docs`);
  }

  const port = configService.get('PORT', 3004);
  
  await app.listen(port, '0.0.0.0');
  
  logger.log(`🚀 账单服务已启动，监听端口 ${port}`);
  logger.log(`🔗 服务地址: http://localhost:${port}`);
  logger.log(`📊 健康检查: http://localhost:${port}/core/health`);
  
  // 优雅关闭
  process.on('SIGTERM', async () => {
    logger.log('收到 SIGTERM 信号，开始优雅关闭...');
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.log('收到 SIGINT 信号，开始优雅关闭...');
    await app.close();
    process.exit(0);
  });
}

bootstrap().catch((error) => {
  Logger.error('账单服务启动失败', error);
  process.exit(1);
});