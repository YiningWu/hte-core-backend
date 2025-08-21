import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { GlobalExceptionFilter } from '@eduhub/shared';
import { AppModule } from './app.module';
import helmet from '@fastify/helmet';
import compress from '@fastify/compress';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ 
      logger: process.env.NODE_ENV === 'development',
      keepAliveTimeout: 5000
    })
  );

  app.setGlobalPrefix('core');
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  }));

  app.useGlobalFilters(new GlobalExceptionFilter());

  await app.register(helmet);
  await app.register(compress);

  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('User Service API')
    .setDescription('EduHub User Domain Microservice')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'X-Request-Id', in: 'header' })
    .addApiKey({ type: 'apiKey', name: 'X-Org-Id', in: 'header' })
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  app.register(async function (fastify: any) {
    fastify.get('/healthz', async () => {
      return { status: 'ok', service: 'user-service', timestamp: new Date().toISOString() };
    });
    
    fastify.get('/readyz', async () => {
      return { status: 'ready', service: 'user-service', timestamp: new Date().toISOString() };
    });
  });

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  
  console.log(`🚀 User Service is running on: http://localhost:${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
}

bootstrap();