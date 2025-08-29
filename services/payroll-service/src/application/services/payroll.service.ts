import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, LessThanOrEqual, MoreThanOrEqual, IsNull, Or } from 'typeorm';
import { UserCompensation } from '../../domain/entities/user-compensation.entity';
import { PayrollRun } from '../../domain/entities/payroll-run.entity';
import { AuditLog } from '../../domain/entities/audit-log.entity';
import { CreateCompensationDto } from '../../interfaces/dto/create-compensation.dto';
import { GeneratePayrollDto, GenerateBatchPayrollDto } from '../../interfaces/dto/generate-payroll.dto';
import { PayrollStatus, DistributedLockService, EntityType, ChangeAction } from '@eduhub/shared';
import { startOfMonth, endOfMonth, getDaysInMonth, format } from 'date-fns';

interface PayrollCalculationResult {
  user_id: number;
  month: string;
  days_in_month: number;
  days_covered: number;
  base_amount: number;
  perf_amount: number;
}

@Injectable()
export class PayrollService {
  constructor(
    @InjectRepository(UserCompensation)
    private readonly compensationRepository: Repository<UserCompensation>,
    @InjectRepository(PayrollRun)
    private readonly payrollRunRepository: Repository<PayrollRun>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly dataSource: DataSource,
    private readonly lockService: DistributedLockService
  ) {}

  private async createAuditLog(data: Partial<AuditLog>): Promise<AuditLog> {
    const log = this.auditLogRepository.create(data);
    return this.auditLogRepository.save(log);
  }

  async createCompensation(createCompensationDto: CreateCompensationDto): Promise<UserCompensation> {
    const lockKey = this.lockService.getCompensationLockKey(createCompensationDto.user_id);
    
    const result = await this.lockService.withLock(
      lockKey,
      async () => {
        return await this.executeCompensationCreation(createCompensationDto);
      },
      { ttlSeconds: 30, maxRetries: 3 }
    );

    if (result === null) {
      throw new ConflictException('Another compensation operation is in progress for this user. Please try again later.');
    }

    return result;
  }

  private async executeCompensationCreation(createCompensationDto: CreateCompensationDto): Promise<UserCompensation> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const validFromDate = new Date(createCompensationDto.valid_from);
      
      const overlappingCompensation = await queryRunner.manager.findOne(UserCompensation, {
        where: [
          {
            user_id: createCompensationDto.user_id,
            valid_from: LessThanOrEqual(validFromDate),
            valid_to: Or(MoreThanOrEqual(validFromDate), IsNull())
          }
        ]
      });

      if (overlappingCompensation && overlappingCompensation.valid_to === null) {
        overlappingCompensation.valid_to = validFromDate;
        await queryRunner.manager.save(UserCompensation, overlappingCompensation);
      } else if (overlappingCompensation) {
        throw new ConflictException('Overlapping compensation period found');
      }

      const newCompensation = queryRunner.manager.create(UserCompensation, {
        ...createCompensationDto,
        valid_from: validFromDate,
        created_by: createCompensationDto.operator_id
      });

      const savedCompensation = await queryRunner.manager.save(UserCompensation, newCompensation);

      await this.createAuditLog({
        org_id: createCompensationDto.org_id,
        actor_user_id: createCompensationDto.operator_id,
        entity_type: EntityType.USER_COMPENSATION,
        entity_id: savedCompensation.comp_id,
        action: ChangeAction.CREATE,
        diff_json: { created: createCompensationDto }
      });

      await queryRunner.commitTransaction();
      return savedCompensation;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getEffectiveCompensation(userId: number, date: string): Promise<UserCompensation | null> {
    const effectiveDate = new Date(date);

    const compensation = await this.compensationRepository
      .createQueryBuilder('comp')
      .where('comp.user_id = :userId', { userId })
      .andWhere('comp.valid_from <= :date', { date: effectiveDate })
      .andWhere('(comp.valid_to > :date OR comp.valid_to IS NULL)', { date: effectiveDate })
      .orderBy('comp.valid_from', 'DESC')
      .getOne();

    return compensation;
  }

  async getCompensationHistory(userId: number, fromDate?: string, toDate?: string): Promise<UserCompensation[]> {
    const queryBuilder = this.compensationRepository
      .createQueryBuilder('comp')
      .where('comp.user_id = :userId', { userId });

    if (fromDate) {
      queryBuilder.andWhere('comp.valid_from >= :fromDate', { fromDate: new Date(fromDate) });
    }

    if (toDate) {
      queryBuilder.andWhere('comp.valid_from <= :toDate', { toDate: new Date(toDate) });
    }

    return await queryBuilder
      .orderBy('comp.valid_from', 'DESC')
      .getMany();
  }

  async calculateMonthlyPayroll(userId: number, month: string): Promise<PayrollCalculationResult> {
    const monthDate = new Date(month);
    const periodStart = startOfMonth(monthDate);
    const periodEnd = endOfMonth(monthDate);
    const daysInMonth = getDaysInMonth(monthDate);

    const compensations = await this.compensationRepository
      .createQueryBuilder('comp')
      .where('comp.user_id = :userId', { userId })
      .andWhere(
        '(comp.valid_from <= :periodEnd AND (comp.valid_to > :periodStart OR comp.valid_to IS NULL))',
        { periodStart, periodEnd }
      )
      .orderBy('comp.valid_from', 'ASC')
      .getMany();

    if (compensations.length === 0) {
      throw new NotFoundException('No compensation found for the specified period');
    }

    let totalBaseSalary = 0;
    let totalPerfSalary = 0;
    let totalDaysCovered = 0;

    for (const comp of compensations) {
      const daysInRange = comp.getDaysInRange(periodStart, periodEnd);
      if (daysInRange > 0) {
        const dailyBase = Number(comp.base_salary) / daysInMonth;
        const dailyPerf = Number(comp.perf_salary) / daysInMonth;

        totalBaseSalary += dailyBase * daysInRange;
        totalPerfSalary += dailyPerf * daysInRange;
        totalDaysCovered += daysInRange;
      }
    }

    return {
      user_id: userId,
      month: format(monthDate, 'yyyy-MM-dd'),
      days_in_month: daysInMonth,
      days_covered: totalDaysCovered,
      base_amount: Math.round(totalBaseSalary * 100) / 100,
      perf_amount: Math.round(totalPerfSalary * 100) / 100
    };
  }

  async generatePayrollRun(generatePayrollDto: GeneratePayrollDto, actorUserId: number): Promise<PayrollRun> {
    const { user_id, month, allowances = 0, deductions = 0, org_id } = generatePayrollDto;
    const monthDate = new Date(month);

    const existingRun = await this.payrollRunRepository.findOne({
      where: { 
        user_id, 
        payroll_month: monthDate 
      }
    });

    if (existingRun) {
      throw new ConflictException('Payroll run already exists for this month');
    }

    const calculation = await this.calculateMonthlyPayroll(user_id, month);

    const payrollRun = this.payrollRunRepository.create({
      org_id,
      user_id,
      payroll_month: monthDate,
      period_start: startOfMonth(monthDate),
      period_end: endOfMonth(monthDate),
      days_in_month: calculation.days_in_month,
      days_covered: calculation.days_covered,
      base_amount: calculation.base_amount,
      perf_amount: calculation.perf_amount,
      allowances,
      deductions,
      gross_amount: 0,
      tax_amount: 0,
      net_amount: 0,
      status: PayrollStatus.DRAFT,
      snapshot_json: {
        calculation_date: new Date().toISOString(),
        compensations_used: await this.getCompensationHistory(user_id),
        calculation_details: calculation
      }
    });

    payrollRun.updateAmounts();

    const savedRun = await this.payrollRunRepository.save(payrollRun);

    await this.createAuditLog({
      org_id,
      actor_user_id: actorUserId,
      entity_type: EntityType.PAYROLL_RUN,
      entity_id: savedRun.run_id,
      action: ChangeAction.CREATE,
      diff_json: { created: generatePayrollDto }
    });

    return savedRun;
  }

  async generateBatchPayrollRuns(generateBatchDto: GenerateBatchPayrollDto): Promise<{ batch_id: string; submitted: boolean; estimated: number }> {
    const batchId = `run-${generateBatchDto.month}-org${generateBatchDto.org_id}`;
    const lockKey = this.lockService.getPayrollLockKey(generateBatchDto.org_id, generateBatchDto.month);
    
    const result = await this.lockService.withLock(
      lockKey,
      async () => {
        // TODO: Implement actual batch processing logic
        // This would typically involve:
        // 1. Finding all active users in the organization
        // 2. Generating payroll runs for each user
        // 3. Using a job queue for processing
        
        return {
          batch_id: batchId,
          submitted: true,
          estimated: 100
        };
      },
      { ttlSeconds: 60, maxRetries: 2 }
    );

    if (result === null) {
      throw new ConflictException('A batch payroll operation is already in progress for this organization and month.');
    }

    return result;
  }

  async updatePayrollRunStatus(runId: number, action: 'confirm' | 'pay', actorUserId: number): Promise<PayrollRun> {
    const payrollRun = await this.payrollRunRepository.findOne({
      where: { run_id: runId }
    });

    if (!payrollRun) {
      throw new NotFoundException('Payroll run not found');
    }

    const previousStatus = payrollRun.status;

    if (action === 'confirm' && payrollRun.status === PayrollStatus.DRAFT) {
      payrollRun.status = PayrollStatus.CONFIRMED;
    } else if (action === 'pay' && payrollRun.status === PayrollStatus.CONFIRMED) {
      payrollRun.status = PayrollStatus.PAID;
    } else {
      throw new BadRequestException(`Invalid status transition: ${payrollRun.status} -> ${action}`);
    }

    const savedRun = await this.payrollRunRepository.save(payrollRun);

    await this.createAuditLog({
      org_id: payrollRun.org_id,
      actor_user_id: actorUserId,
      entity_type: EntityType.PAYROLL_RUN,
      entity_id: runId,
      action: ChangeAction.UPDATE,
      diff_json: { previous_status: previousStatus, updated_status: payrollRun.status }
    });

    return savedRun;
  }

  async getPayrollRuns(orgId: number, userId?: number, month?: string): Promise<PayrollRun[]> {
    const queryBuilder = this.payrollRunRepository
      .createQueryBuilder('run')
      .where('run.org_id = :orgId', { orgId });

    if (userId) {
      queryBuilder.andWhere('run.user_id = :userId', { userId });
    }

    if (month) {
      const monthDate = new Date(month);
      queryBuilder.andWhere('run.payroll_month = :month', { month: monthDate });
    }

    return await queryBuilder
      .orderBy('run.payroll_month', 'DESC')
      .addOrderBy('run.created_at', 'DESC')
      .getMany();
  }
}