import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { CampusController } from '../../services/campus-service/src/interfaces/controllers/campus.controller';
import { CampusService } from '../../services/campus-service/src/application/services/campus.service';

describe('Campus API', () => {
  let app: NestFastifyApplication;
  let service: { findCampusById: jest.Mock };

  beforeAll(async () => {
    service = {
      findCampusById: jest.fn().mockResolvedValue({
        campus_id: 1,
        org_id: 1,
        name: 'Beijing Main Campus'
      })
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [CampusController],
      providers: [{ provide: CampusService, useValue: service }]
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('core');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /core/campuses/:id returns campus info', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/core/campuses/1',
      headers: { 'X-Org-Id': '1' }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      success: true,
      message: '校园信息获取成功',
      data: {
        campus_id: 1,
        org_id: 1,
        name: 'Beijing Main Campus'
      }
    });
  });
});
