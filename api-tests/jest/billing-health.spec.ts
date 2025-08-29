import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { FastifyInstance } from 'fastify';
import { HealthController } from '../../services/billing-service/src/interfaces/controllers/health.controller';

describe('Billing Service HealthController', () => {
  let app: INestApplication;
  let server: FastifyInstance;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    app = module.createNestApplication(new FastifyAdapter());
    app.setGlobalPrefix('core');
    await app.init();
    server = app.getHttpAdapter().getInstance();
    await server.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /core/health returns service ok', async () => {
    const res = await server.inject({ method: 'GET', url: '/core/health' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toEqual(
      expect.objectContaining({
        status: 'ok',
        service: 'billing-service',
      })
    );
  });

  it('GET /core/health/ready returns service ready', async () => {
    const res = await server.inject({ method: 'GET', url: '/core/health/ready' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toEqual(
      expect.objectContaining({
        status: 'ready',
        service: 'billing-service',
      })
    );
  });
});
