import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '@eduhub/shared';

@ApiTags('系统健康检查')
@Controller('health')
export class HealthController {
  @Get()
  @Public()
  @ApiOperation({ summary: '服务健康检查' })
  @ApiResponse({ status: 200, description: '服务正常运行' })
  check() {
    return {
      status: 'ok',
      service: 'billing-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0'
    };
  }

  @Get('ready')
  @Public()
  @ApiOperation({ summary: '服务就绪检查' })
  @ApiResponse({ status: 200, description: '服务就绪' })
  ready() {
    return {
      status: 'ready',
      service: 'billing-service',
      timestamp: new Date().toISOString()
    };
  }
}