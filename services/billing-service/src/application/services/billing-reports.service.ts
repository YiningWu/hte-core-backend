import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LedgerEntry } from '../../domain/entities/ledger-entry.entity';
import { LedgerEntryTeacherShare } from '../../domain/entities/ledger-entry-teacher-share.entity';
import { QueryReportsSummaryDto, QueryTeacherSharesDto, QueryByCategoryDto } from '../../interfaces/dto/query-reports.dto';
import { EntryType, EntryStatus } from '../../domain/enums/billing.enum';
import { CacheService } from '@eduhub/shared';

export interface SummaryReportItem {
  date: string;
  income: number;
  expense: number;
  net: number;
}

export interface TeacherShareReportItem {
  teacherName: string;
  entries: number;
  amountTotal: number;
  shareTotal: number;
}

export interface CategoryReportItem {
  categoryCode: string;
  categoryName: string;
  count: number;
  amount: number;
  sign: number; // +1 for income, -1 for expense
}

@Injectable()
export class BillingReportsService {
  constructor(
    @InjectRepository(LedgerEntry)
    private readonly entryRepository: Repository<LedgerEntry>,
    @InjectRepository(LedgerEntryTeacherShare)
    private readonly teacherShareRepository: Repository<LedgerEntryTeacherShare>,
    private readonly cacheService: CacheService
  ) {}

  async getSummaryReport(
    orgId: number,
    queryDto: QueryReportsSummaryDto,
    userCampusIds?: number[]
  ): Promise<{
    currency: string;
    period: { from: string; to: string };
    groupBy: string;
    items: SummaryReportItem[];
    totals: { income: number; expense: number; net: number };
  }> {
    const { from, to, campusId, groupBy = 'day' } = queryDto;

    // 构建缓存键
    const cacheKey = `billing:report:summary:${orgId}:${from}:${to}:${campusId}:${groupBy}:${userCampusIds?.join(',')}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached && typeof cached === 'string') {
      return JSON.parse(cached);
    }

    const queryBuilder = this.entryRepository.createQueryBuilder('entry');
    queryBuilder.where('entry.orgId = :orgId', { orgId });
    queryBuilder.andWhere('entry.status = :status', { status: EntryStatus.NORMAL });

    // 权限控制
    if (userCampusIds && userCampusIds.length > 0) {
      queryBuilder.andWhere('entry.campusId IN (:...campusIds)', { campusIds: userCampusIds });
    }

    if (campusId) {
      queryBuilder.andWhere('entry.campusId = :campusId', { campusId });
    }

    if (from) {
      queryBuilder.andWhere('entry.occurredAt >= :from', { from: `${from} 00:00:00` });
    }

    if (to) {
      queryBuilder.andWhere('entry.occurredAt <= :to', { to: `${to} 23:59:59` });
    }

    // 分组查询
    const dateFormat = groupBy === 'month' 
      ? "DATE_FORMAT(entry.occurredAt, '%Y-%m-01')" 
      : "DATE_FORMAT(entry.occurredAt, '%Y-%m-%d')";

    queryBuilder
      .select([
        `${dateFormat} as date`,
        'entry.type',
        'SUM(entry.amount) as total'
      ])
      .groupBy(`${dateFormat}, entry.type`)
      .orderBy('date', 'ASC');

    const rawResults = await queryBuilder.getRawMany();

    // 处理结果数据
    const dataMap = new Map<string, { income: number; expense: number }>();
    let totalIncome = 0;
    let totalExpense = 0;

    rawResults.forEach(row => {
      const date = row.date;
      const amount = parseFloat(row.total) || 0;
      
      if (!dataMap.has(date)) {
        dataMap.set(date, { income: 0, expense: 0 });
      }
      
      const dayData = dataMap.get(date)!;
      
      if (row.entry_type === EntryType.INCOME) {
        dayData.income += amount;
        totalIncome += amount;
      } else {
        dayData.expense += amount;
        totalExpense += amount;
      }
    });

    // 构建最终结果
    const items: SummaryReportItem[] = [];
    dataMap.forEach((data, date) => {
      items.push({
        date,
        income: Math.round(data.income * 100) / 100,
        expense: Math.round(data.expense * 100) / 100,
        net: Math.round((data.income - data.expense) * 100) / 100
      });
    });

    const result = {
      currency: 'CNY',
      period: { from: from || '', to: to || '' },
      groupBy,
      items: items.sort((a, b) => a.date.localeCompare(b.date)),
      totals: {
        income: Math.round(totalIncome * 100) / 100,
        expense: Math.round(totalExpense * 100) / 100,
        net: Math.round((totalIncome - totalExpense) * 100) / 100
      }
    };

    // 缓存结果 30 分钟
    await this.cacheService.set(cacheKey, JSON.stringify(result), 1800);

    return result;
  }

  async getTeacherSharesReport(
    orgId: number,
    queryDto: QueryTeacherSharesDto,
    userCampusIds?: number[]
  ): Promise<{
    month: string;
    items: TeacherShareReportItem[];
    totals: { amountTotal: number; shareTotal: number };
  }> {
    const { month, campusId, teacher } = queryDto;

    const cacheKey = `billing:report:teacher:${orgId}:${month}:${campusId}:${teacher}:${userCampusIds?.join(',')}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached && typeof cached === 'string') {
      return JSON.parse(cached);
    }

    // 查询老师分成数据
    const queryBuilder = this.teacherShareRepository.createQueryBuilder('share')
      .innerJoin('share.entry', 'entry')
      .where('entry.orgId = :orgId', { orgId })
      .andWhere('entry.status = :status', { status: EntryStatus.NORMAL })
      .andWhere('entry.type = :type', { type: EntryType.INCOME });

    if (userCampusIds && userCampusIds.length > 0) {
      queryBuilder.andWhere('entry.campusId IN (:...campusIds)', { campusIds: userCampusIds });
    }

    if (campusId) {
      queryBuilder.andWhere('entry.campusId = :campusId', { campusId });
    }

    if (month) {
      const monthStart = `${month.substring(0, 7)}-01`;
      const monthEnd = `${month.substring(0, 7)}-31`;
      queryBuilder.andWhere('entry.occurredAt >= :monthStart', { monthStart: `${monthStart} 00:00:00` });
      queryBuilder.andWhere('entry.occurredAt <= :monthEnd', { monthEnd: `${monthEnd} 23:59:59` });
    }

    if (teacher) {
      queryBuilder.andWhere('share.teacherName LIKE :teacher', { teacher: `%${teacher}%` });
    }

    queryBuilder
      .select([
        'share.teacherName as teacherName',
        'COUNT(DISTINCT entry.entryId) as entries',
        'SUM(entry.amount) as amountTotal',
        'SUM(share.money) as shareTotal'
      ])
      .groupBy('share.teacherName')
      .orderBy('shareTotal', 'DESC');

    const rawResults = await queryBuilder.getRawMany();

    const items: TeacherShareReportItem[] = rawResults.map(row => ({
      teacherName: row.teacherName,
      entries: parseInt(row.entries) || 0,
      amountTotal: Math.round((parseFloat(row.amountTotal) || 0) * 100) / 100,
      shareTotal: Math.round((parseFloat(row.shareTotal) || 0) * 100) / 100
    }));

    const totals = {
      amountTotal: Math.round(items.reduce((sum, item) => sum + item.amountTotal, 0) * 100) / 100,
      shareTotal: Math.round(items.reduce((sum, item) => sum + item.shareTotal, 0) * 100) / 100
    };

    const result = {
      month: month || '',
      items,
      totals
    };

    // 缓存结果 30 分钟
    await this.cacheService.set(cacheKey, JSON.stringify(result), 1800);

    return result;
  }

  async getCategoryReport(
    orgId: number,
    queryDto: QueryByCategoryDto,
    userCampusIds?: number[]
  ): Promise<{ items: CategoryReportItem[] }> {
    const { from, to, type, campusId } = queryDto;

    const cacheKey = `billing:report:category:${orgId}:${from}:${to}:${type}:${campusId}:${userCampusIds?.join(',')}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached && typeof cached === 'string') {
      return JSON.parse(cached);
    }

    const queryBuilder = this.entryRepository.createQueryBuilder('entry');
    queryBuilder.where('entry.orgId = :orgId', { orgId });
    queryBuilder.andWhere('entry.status = :status', { status: EntryStatus.NORMAL });

    if (userCampusIds && userCampusIds.length > 0) {
      queryBuilder.andWhere('entry.campusId IN (:...campusIds)', { campusIds: userCampusIds });
    }

    if (campusId) {
      queryBuilder.andWhere('entry.campusId = :campusId', { campusId });
    }

    if (from) {
      queryBuilder.andWhere('entry.occurredAt >= :from', { from: `${from} 00:00:00` });
    }

    if (to) {
      queryBuilder.andWhere('entry.occurredAt <= :to', { to: `${to} 23:59:59` });
    }

    if (type) {
      queryBuilder.andWhere('entry.type = :type', { type });
    }

    queryBuilder
      .select([
        'entry.categoryCode as categoryCode',
        'entry.categoryName as categoryName',
        'entry.type as type',
        'COUNT(*) as count',
        'SUM(entry.amount) as amount'
      ])
      .groupBy('entry.categoryCode, entry.categoryName, entry.type')
      .orderBy('amount', 'DESC');

    const rawResults = await queryBuilder.getRawMany();

    const items: CategoryReportItem[] = rawResults.map(row => ({
      categoryCode: row.categoryCode,
      categoryName: row.categoryName,
      count: parseInt(row.count) || 0,
      amount: Math.round((parseFloat(row.amount) || 0) * 100) / 100,
      sign: row.type === EntryType.INCOME ? 1 : -1
    }));

    const result = { items };

    // 缓存结果 30 分钟
    await this.cacheService.set(cacheKey, JSON.stringify(result), 1800);

    return result;
  }

  // 清除相关缓存
  async clearReportCache(orgId: number): Promise<void> {
    const patterns = [
      `billing:report:summary:${orgId}:*`,
      `billing:report:teacher:${orgId}:*`,
      `billing:report:category:${orgId}:*`
    ];

    for (const pattern of patterns) {
      // 这里需要根据实际的缓存实现来清除
      // await this.cacheService.deletePattern(pattern);
    }
  }
}