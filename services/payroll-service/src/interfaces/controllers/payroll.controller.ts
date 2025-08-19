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
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { PayrollService } from '../../application/services/payroll.service';
import { CreateCompensationDto } from '../dto/create-compensation.dto';
import { GeneratePayrollDto, GenerateBatchPayrollDto } from '../dto/generate-payroll.dto';
import { ApiResponse as ApiResponseType, JwtAuthGuard } from '@eduhub/shared';

@ApiTags('Payroll')
@Controller('payroll')
@ApiHeader({ name: 'Authorization', description: 'Bearer token' })
@ApiHeader({ name: 'X-Request-Id', description: 'Request ID for idempotency' })
@ApiHeader({ name: 'X-Org-Id', description: 'Organization ID' })
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Post('compensations')
  @ApiOperation({ summary: 'Create compensation standard with automatic interval closure' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Compensation created successfully' })
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

    return {
      data: {
        comp_id: compensation.comp_id,
        created_at: compensation.created_at
      }
    };
  }

  @Get('compensations/effective')
  @ApiOperation({ summary: 'Get effective compensation for specific date' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Effective compensation found' })
  async getEffectiveCompensation(
    @Query('user_id') userId: string,
    @Query('date') date: string
  ): Promise<ApiResponseType<any>> {
    const compensation = await this.payrollService.getEffectiveCompensation(parseInt(userId), date);

    if (!compensation) {
      return {
        data: null
      };
    }

    return {
      data: {
        user_id: compensation.user_id,
        date,
        base_salary: compensation.base_salary,
        perf_salary: compensation.perf_salary,
        source_comp_id: compensation.comp_id
      }
    };
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

    return {
      data: {
        items: compensations
      }
    };
  }

  @Get('runs/preview')
  @ApiOperation({ summary: 'Preview monthly payroll calculation' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Payroll calculation preview' })
  async previewPayroll(
    @Query('user_id') userId: string,
    @Query('month') month: string
  ): Promise<ApiResponseType<any>> {
    const calculation = await this.payrollService.calculateMonthlyPayroll(parseInt(userId), month);

    return { data: calculation };
  }

  @Post('runs/generate')
  @ApiOperation({ summary: 'Generate payroll run for single user' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Payroll run generated' })
  async generatePayroll(
    @Body(ValidationPipe) generatePayrollDto: GeneratePayrollDto,
    @Headers('X-Org-Id') orgId: string
  ): Promise<ApiResponseType<{ run_id: number; status: string }>> {
    if (!orgId) {
      orgId = '1'; // Default org_id for testing
    }
    const payrollRun = await this.payrollService.generatePayrollRun({
      ...generatePayrollDto,
      org_id: parseInt(orgId)
    });

    return {
      data: {
        run_id: payrollRun.run_id,
        status: payrollRun.status
      }
    };
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

    return { data: result };
  }

  @Patch('runs/:id')
  @ApiOperation({ summary: 'Update payroll run status (confirm/pay)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Payroll run status updated' })
  async updatePayrollStatus(
    @Param('id', ParseIntPipe) runId: number,
    @Body() body: { action: 'confirm' | 'pay' }
  ): Promise<ApiResponseType<{ run_id: number; status: string }>> {
    const payrollRun = await this.payrollService.updatePayrollRunStatus(runId, body.action);

    return {
      data: {
        run_id: payrollRun.run_id,
        status: payrollRun.status
      }
    };
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

    return {
      data: {
        items: runs
      }
    };
  }
}