import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { PayrollController } from '../../services/payroll-service/src/interfaces/controllers/payroll.controller';
import { PayrollService } from '../../services/payroll-service/src/application/services/payroll.service';

describe('Payroll API', () => {
  let app: NestFastifyApplication;
  let service: { createCompensation: jest.Mock; getEffectiveCompensation: jest.Mock };

  beforeAll(async () => {
    service = {
      createCompensation: jest.fn().mockResolvedValue({
        comp_id: 456,
        created_at: new Date('2024-01-01T12:00:00.000Z')
      }),
      getEffectiveCompensation: jest.fn().mockResolvedValue({
        user_id: 123,
        comp_id: 456,
        base_salary: 8000,
        perf_salary: 2000
      })
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [PayrollController],
      providers: [{ provide: PayrollService, useValue: service }]
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('core');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /core/payroll/compensations creates compensation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/core/payroll/compensations',
      headers: { 'X-Org-Id': '1' },
      payload: {
        org_id: 1,
        user_id: 123,
        base_salary: 8000,
        perf_salary: 2000,
        valid_from: '2024-01-01',
        reason: 'Annual salary adjustment',
        operator_id: 1
      }
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({
      success: true,
      message: '薪资标准创建成功',
      data: {
        comp_id: 456,
        created_at: '2024-01-01T12:00:00.000Z'
      }
    });
  });

  it('GET /core/payroll/compensations/effective returns compensation', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/core/payroll/compensations/effective?user_id=123&date=2024-01-15'
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      success: true,
      message: '有效薪资标准获取成功',
      data: {
        user_id: 123,
        date: '2024-01-15',
        base_salary: 8000,
        perf_salary: 2000,
        source_comp_id: 456
      }
    });
  });
});
