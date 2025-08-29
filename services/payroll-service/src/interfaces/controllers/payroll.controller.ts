import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Headers,
  HttpStatus,
  ParseIntPipe,
  ValidationPipe,
  UseGuards
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { PayrollService } from '../../application/services/payroll.service';
import { CreateCompensationDto } from '../dto/create-compensation.dto';
import { GeneratePayrollDto, GenerateBatchPayrollDto } from '../dto/generate-payroll.dto';
import { ApiResponse as ApiResponseType, JwtAuthGuard, ResponseHelper } from '@eduhub/shared';

@ApiTags('Payroll')
@Controller('payroll')
@ApiHeader({ name: 'Authorization', description: 'Bearer token' })
@ApiHeader({ name: 'X-Request-Id', description: 'Request ID for idempotency' })
@ApiHeader({ name: 'X-Org-Id', description: 'Organization ID' })
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Post('compensations')
  @ApiOperation({ 
    summary: 'Create compensation standard with automatic interval closure',
    description: 'Creates a new compensation record for a user. Automatically closes previous compensation intervals.'
  })
  @ApiBody({ 
    type: CreateCompensationDto,
    description: 'Compensation creation data',
    examples: {
      example1: {
        summary: 'Teacher compensation',
        value: {
          org_id: 1,
          user_id: 123,
          base_salary: 8000.00,
          perf_salary: 2000.00,
          valid_from: '2024-01-01',
          reason: 'Annual salary adjustment',
          operator_id: 1
        }
      }
    }
  })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Compensation created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '薪资标准创建成功' },
        data: {
          type: 'object',
          properties: {
            comp_id: { type: 'number', example: 456 },
            created_at: { type: 'string', format: 'date-time', example: '2024-01-01T12:00:00.000Z' }
          }
        }
      }
    }
  })
  @ApiHeader({ name: 'X-Org-Id', description: 'Organization ID (required)', required: true, schema: { type: 'string', example: '1' } })
  async createCompensation(
    @Body(ValidationPipe) createCompensationDto: CreateCompensationDto,
    @Headers('X-Org-Id') orgId: string
  ): Promise<ApiResponseType<{ comp_id: number; created_at: Date }>> {
    if (!orgId) {
      orgId = '1'; // Default org_id for testing
    }
    const compensation = await this.payrollService.createCompensation({
      ...createCompensationDto,
      org_id: parseInt(orgId)
    });

    return ResponseHelper.created({
      comp_id: compensation.comp_id,
      created_at: compensation.created_at
    }, '薪资标准创建成功');
  }

  @Get('compensations/effective')
  @ApiOperation({ 
    summary: 'Get effective compensation for specific date',
    description: 'Retrieves the compensation that was effective for a user on a specific date.'
  })
  @ApiQuery({ name: 'user_id', type: 'string', description: 'User ID', example: '123' })
  @ApiQuery({ name: 'date', type: 'string', description: 'Date (YYYY-MM-DD)', example: '2024-01-15' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Effective compensation found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '有效薪资标准获取成功' },
        data: {
          type: 'object',
          properties: {
            user_id: { type: 'number', example: 123 },
            date: { type: 'string', example: '2024-01-15' },
            base_salary: { type: 'number', example: 8000.00 },
            perf_salary: { type: 'number', example: 2000.00 },
            source_comp_id: { type: 'number', example: 456 }
          },
          nullable: true
        }
      }
    }
  })
  async getEffectiveCompensation(
    @Query('user_id') userId: string,
    @Query('date') date: string
  ): Promise<ApiResponseType<any>> {
    const compensation = await this.payrollService.getEffectiveCompensation(parseInt(userId), date);

    if (!compensation) {
      return ResponseHelper.found(null, '未找到有效薪资标准');
    }

    return ResponseHelper.found({
      user_id: compensation.user_id,
      date,
      base_salary: compensation.base_salary,
      perf_salary: compensation.perf_salary,
      source_comp_id: compensation.comp_id
    }, '有效薪资标准获取成功');
  }

  @Get('compensations')
  @ApiOperation({ summary: 'Get compensation history' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Compensation history retrieved' })
  async getCompensationHistory(
    @Query('user_id') userId: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ): Promise<ApiResponseType<any>> {
    const compensations = await this.payrollService.getCompensationHistory(parseInt(userId), from, to);

    return ResponseHelper.found({
      items: compensations
    }, '薪资历史获取成功');
  }

  @Get('runs/preview')
  @ApiOperation({ 
    summary: 'Preview monthly payroll calculation',
    description: 'Calculates and previews the monthly payroll for a user without creating a payroll run.'
  })
  @ApiQuery({ name: 'user_id', type: 'string', description: 'User ID', example: '123' })
  @ApiQuery({ name: 'month', type: 'string', description: 'Month (YYYY-MM)', example: '2024-01' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Payroll calculation preview',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '薪资计算预览成功' },
        data: {
          type: 'object',
          properties: {
            user_id: { type: 'number', example: 123 },
            month: { type: 'string', example: '2024-01' },
            base_salary: { type: 'number', example: 8000.00 },
            perf_salary: { type: 'number', example: 2000.00 },
            gross_salary: { type: 'number', example: 10000.00 },
            tax_deduction: { type: 'number', example: 1000.00 },
            social_security: { type: 'number', example: 800.00 },
            net_salary: { type: 'number', example: 8200.00 }
          }
        }
      }
    }
  })
  async previewPayroll(
    @Query('user_id') userId: string,
    @Query('month') month: string
  ): Promise<ApiResponseType<any>> {
    const calculation = await this.payrollService.calculateMonthlyPayroll(parseInt(userId), month);

    return ResponseHelper.found(calculation, '薪资计算预览成功');
  }

  @Post('runs/generate')
  @ApiOperation({ summary: 'Generate payroll run for single user' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Payroll run generated' })
  async generatePayroll(
    @Body(ValidationPipe) generatePayrollDto: GeneratePayrollDto,
    @Headers('X-Org-Id') orgId: string,
    @Headers('X-User-Id') userId: string
  ): Promise<ApiResponseType<{ run_id: number; status: string }>> {
    if (!orgId) {
      orgId = '1'; // Default org_id for testing
    }
    if (!userId) {
      userId = '1';
    }
    const payrollRun = await this.payrollService.generatePayrollRun({
      ...generatePayrollDto,
      org_id: parseInt(orgId)
    }, parseInt(userId));

    return ResponseHelper.created({
      run_id: payrollRun.run_id,
      status: payrollRun.status
    }, '薪资单生成成功');
  }

  @Post('runs/generate-batch')
  @ApiOperation({ summary: 'Generate batch payroll runs' })
  @ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Batch payroll generation submitted' })
  async generateBatchPayroll(
    @Body(ValidationPipe) generateBatchDto: GenerateBatchPayrollDto,
    @Headers('X-Org-Id') orgId: string
  ): Promise<ApiResponseType<any>> {
    if (!orgId) {
      orgId = '1'; // Default org_id for testing
    }
    const result = await this.payrollService.generateBatchPayrollRuns({
      ...generateBatchDto,
      org_id: parseInt(orgId)
    });

    return ResponseHelper.success(result, '批量薪资单生成提交成功');
  }

  @Patch('runs/:id')
  @ApiOperation({ summary: 'Update payroll run status (confirm/pay)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Payroll run status updated' })
  async updatePayrollStatus(
    @Param('id', ParseIntPipe) runId: number,
    @Body() body: { action: 'confirm' | 'pay' },
    @Headers('X-User-Id') userId: string
  ): Promise<ApiResponseType<{ run_id: number; status: string }>> {
    if (!userId) {
      userId = '1';
    }
    const payrollRun = await this.payrollService.updatePayrollRunStatus(runId, body.action, parseInt(userId));

    return ResponseHelper.updated({
      run_id: payrollRun.run_id,
      status: payrollRun.status
    }, '薪资单状态更新成功');
  }

  @Get('runs')
  @ApiOperation({ summary: 'Get payroll runs with optional filters' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Payroll runs retrieved' })
  async getPayrollRuns(
    @Headers('X-Org-Id') orgId: string,
    @Query('user_id') userId?: string,
    @Query('month') month?: string
  ): Promise<ApiResponseType<any>> {
    if (!orgId) {
      orgId = '1'; // Default org_id for testing
    }
    const runs = await this.payrollService.getPayrollRuns(parseInt(orgId), userId ? parseInt(userId) : undefined, month);

    return ResponseHelper.found({
      items: runs
    }, '薪资单列表获取成功');
  }
}