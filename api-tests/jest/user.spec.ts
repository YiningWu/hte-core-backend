import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { UserController } from '../../services/user-service/src/interfaces/controllers/user.controller';
import { UserService } from '../../services/user-service/src/application/services/user.service';
import { IdempotentInterceptor, CacheService } from '@eduhub/shared';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

describe('User API', () => {
  let app: NestFastifyApplication;
  let service: { create: jest.Mock; findById: jest.Mock };

  beforeAll(async () => {
    service = {
      create: jest.fn().mockResolvedValue({
        user_id: 123,
        created_at: new Date('2024-01-01T12:00:00.000Z')
      }),
      findById: jest.fn().mockResolvedValue({
        user_id: 123,
        org_id: 1,
        campus_id: 1,
        username: 'teacher001',
        employment_status: 'ACTIVE',
        hire_date: '2024-01-01',
        email: 'teacher@example.com',
        phone: '+86 138-0000-1234',
        maskSensitiveData() { return this; }
      })
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: UserService, useValue: service },
        { provide: CacheService, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() } },
        Reflector,
        IdempotentInterceptor
      ]
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('core');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /core/users/:id returns user info', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/core/users/123',
      headers: { 'X-Org-Id': '1' }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      success: true,
      message: '用户信息获取成功',
      data: {
        user_id: 123,
        org_id: 1,
        campus_id: 1,
        username: 'teacher001',
        employment_status: 'ACTIVE',
        hire_date: '2024-01-01',
        email: 'teacher@example.com',
        phone: '+86 138-0000-1234'
      }
    });
  });
});
