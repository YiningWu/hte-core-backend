import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ulid } from 'ulid';
import { LedgerEntry } from '../../domain/entities/ledger-entry.entity';
import { LedgerEntryTeacherShare } from '../../domain/entities/ledger-entry-teacher-share.entity';
import { LedgerAudit } from '../../domain/entities/ledger-audit.entity';
import { CreateLedgerEntryDto } from '../../interfaces/dto/create-ledger-entry.dto';
import { UpdateLedgerEntryDto } from '../../interfaces/dto/update-ledger-entry.dto';
import { QueryLedgerEntriesDto } from '../../interfaces/dto/query-ledger-entries.dto';
import { EntryType, EntryStatus, EntityType, AuditAction } from '../../domain/enums/billing.enum';
import { LedgerBookService } from './ledger-book.service';
import { LedgerCategoryService } from './ledger-category.service';
import { CacheService } from '@eduhub/shared';

@Injectable()
export class LedgerEntryService {
  constructor(
    @InjectRepository(LedgerEntry)
    private readonly entryRepository: Repository<LedgerEntry>,
    @InjectRepository(LedgerEntryTeacherShare)
    private readonly teacherShareRepository: Repository<LedgerEntryTeacherShare>,
    @InjectRepository(LedgerAudit)
    private readonly auditRepository: Repository<LedgerAudit>,
    private readonly dataSource: DataSource,
    private readonly ledgerBookService: LedgerBookService,
    private readonly categoryService: LedgerCategoryService,
    private readonly cacheService: CacheService
  ) {}

  async create(
    createDto: CreateLedgerEntryDto,
    orgId: number,
    campusId: number,
    operatorId: number,
    requestId?: string
  ): Promise<LedgerEntry> {
    // 幂等性检查
    if (requestId) {
      const cacheKey = `billing:entry:request:${requestId}`;
      const existingResult = await this.cacheService.get(cacheKey);
      if (existingResult && typeof existingResult === 'string') {
        return JSON.parse(existingResult);
      }
    }

    // 检查是否已存在相同ID的账单
    const existingEntry = await this.entryRepository.findOne({
      where: { entryId: createDto.id }
    });
    
    if (existingEntry) {
      throw new ConflictException(`账单ID ${createDto.id} 已存在`);
    }

    return await this.dataSource.transaction(async manager => {
      // 获取或创建默认账本
      let book = await this.ledgerBookService.getDefaultBookForCampus(orgId, campusId);
      if (!book) {
        // 自动创建默认账本
        book = await this.ledgerBookService.create({
          campusId,
          name: `校区${campusId}默认账本`,
          code: `CAMPUS-${campusId}-DEFAULT`
        }, orgId);
      }

      // 验证类目
      const category = await this.categoryService.findByCode(createDto.category, createDto.type, orgId);
      if (!category) {
        throw new BadRequestException(`类目 ${createDto.category} 不存在或已禁用`);
      }

      // 解析时间
      const occurredAt = this.parseDateTime(createDto.time);

      // 解析金额（如果未提供，尝试从原始文本提取）
      let amount = createDto.amount;
      if (!amount && createDto.originalText) {
        amount = this.extractAmountFromText(createDto.originalText) || undefined;
      }

      if (!amount) {
        throw new BadRequestException('金额不能为空，请提供金额或确保原始文本包含金额信息');
      }

      // 验证老师分成
      const teacherShares = createDto.teacher || [];
      if (teacherShares.length > 0) {
        if (createDto.type !== EntryType.INCOME || !category.isTeacherRelated) {
          throw new BadRequestException('只有收入类型且与老师相关的类目才能设置老师分成');
        }

        const totalRatio = teacherShares.reduce((sum, share) => sum + share.ratio, 0);
        if (totalRatio > 1.0) {
          throw new BadRequestException(`老师分成比例总和 ${totalRatio} 不能超过 1.0`);
        }
      }

      // 创建账单条目
      const entry = manager.create(LedgerEntry, {
        entryId: createDto.id,
        bookId: book.bookId,
        orgId,
        campusId,
        type: createDto.type,
        categoryCode: createDto.category,
        categoryName: createDto.categoryName,
        amount,
        occurredAt,
        originalText: createDto.originalText,
        reporterName: createDto.reporter,
        recorderName: createDto.recorder,
        status: createDto.status || EntryStatus.NORMAL,
        createdBy: operatorId,
        requestId
      });

      const savedEntry = await manager.save(LedgerEntry, entry);

      // 创建老师分成记录
      if (teacherShares.length > 0) {
        for (const share of teacherShares) {
          const teacherShare = manager.create(LedgerEntryTeacherShare, {
            entryId: savedEntry.entryId,
            teacherUserId: share.teacherUserId,
            teacherName: share.name,
            ratio: share.ratio,
            money: Math.round(amount * share.ratio * 100) / 100 // 精确到分
          });
          await manager.save(LedgerEntryTeacherShare, teacherShare);
        }
      }

      // 记录审计日志
      await this.createAuditLog(
        manager,
        orgId,
        campusId,
        EntityType.ENTRY,
        savedEntry.entryId,
        AuditAction.CREATE,
        savedEntry,
        operatorId,
        requestId
      );

      // 缓存结果（用于幂等性）
      if (requestId) {
        const cacheKey = `billing:entry:request:${requestId}`;
        await this.cacheService.set(cacheKey, JSON.stringify(savedEntry), 3600); // 1小时TTL
      }

      return savedEntry;
    });
  }

  async findById(entryId: string, orgId: number): Promise<LedgerEntry> {
    const entry = await this.entryRepository.findOne({
      where: { entryId, orgId },
      relations: ['teacherShares', 'attachments']
    });

    if (!entry) {
      throw new NotFoundException('账单不存在或无权限访问');
    }

    return entry;
  }

  async findAll(
    orgId: number,
    queryDto: QueryLedgerEntriesDto,
    userCampusIds?: number[]
  ): Promise<{ items: LedgerEntry[]; nextCursor?: string; total: number }> {
    const {
      from,
      to,
      type,
      category,
      teacher,
      reporter,
      recorder,
      campusId,
      status = EntryStatus.NORMAL,
      pageSize = 20,
      cursor,
      q
    } = queryDto;

    const queryBuilder = this.entryRepository.createQueryBuilder('entry')
      .leftJoinAndSelect('entry.teacherShares', 'shares');

    queryBuilder.where('entry.orgId = :orgId', { orgId });

    // 权限控制：限制可见的校区
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

    if (category) {
      queryBuilder.andWhere('entry.categoryCode = :category', { category });
    }

    if (teacher) {
      queryBuilder.andWhere('shares.teacherName LIKE :teacher', { teacher: `%${teacher}%` });
    }

    if (reporter) {
      queryBuilder.andWhere('entry.reporterName LIKE :reporter', { reporter: `%${reporter}%` });
    }

    if (recorder) {
      queryBuilder.andWhere('entry.recorderName LIKE :recorder', { recorder: `%${recorder}%` });
    }

    if (status) {
      queryBuilder.andWhere('entry.status = :status', { status });
    }

    if (q) {
      queryBuilder.andWhere(
        '(entry.originalText LIKE :q OR entry.categoryName LIKE :q OR entry.reporterName LIKE :q)',
        { q: `%${q}%` }
      );
    }

    // 游标分页
    if (cursor) {
      const decodedCursor = Buffer.from(cursor, 'base64').toString();
      const cursorData = JSON.parse(decodedCursor);
      queryBuilder.andWhere('entry.entryId < :cursorId', { cursorId: cursorData.entryId });
    }

    queryBuilder
      .orderBy('entry.occurredAt', 'DESC')
      .addOrderBy('entry.entryId', 'DESC')
      .limit(pageSize);

    const items = await queryBuilder.getMany();

    // 计算总数（简化版本）
    const totalQuery = this.entryRepository.createQueryBuilder('entry');
    totalQuery.where('entry.orgId = :orgId', { orgId });
    if (userCampusIds && userCampusIds.length > 0) {
      totalQuery.andWhere('entry.campusId IN (:...campusIds)', { campusIds: userCampusIds });
    }
    if (campusId) totalQuery.andWhere('entry.campusId = :campusId', { campusId });
    if (from) totalQuery.andWhere('entry.occurredAt >= :from', { from: `${from} 00:00:00` });
    if (to) totalQuery.andWhere('entry.occurredAt <= :to', { to: `${to} 23:59:59` });
    if (type) totalQuery.andWhere('entry.type = :type', { type });
    if (status) totalQuery.andWhere('entry.status = :status', { status });

    const total = await totalQuery.getCount();

    let nextCursor: string | undefined;
    if (items.length === pageSize && items.length > 0) {
      const lastItem = items[items.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ entryId: lastItem.entryId })).toString('base64');
    }

    return { items, nextCursor, total };
  }

  async update(
    entryId: string,
    updateDto: UpdateLedgerEntryDto,
    orgId: number,
    operatorId: number
  ): Promise<LedgerEntry> {
    const entry = await this.findById(entryId, orgId);

    if (entry.status === EntryStatus.VOIDED) {
      throw new BadRequestException('已作废的账单不能修改');
    }

    return await this.dataSource.transaction(async manager => {
      const oldEntry = { ...entry };

      // 更新基本信息
      if (updateDto.categoryName) entry.categoryName = updateDto.categoryName;
      if (updateDto.amount !== undefined) entry.amount = updateDto.amount;
      if (updateDto.originalText !== undefined) entry.originalText = updateDto.originalText;
      if (updateDto.status) entry.status = updateDto.status;

      if (updateDto.time) {
        entry.occurredAt = this.parseDateTime(updateDto.time);
      }

      // 处理老师分成更新
      if (updateDto.teacher !== undefined) {
        // 删除现有分成记录
        await manager.delete(LedgerEntryTeacherShare, { entryId });

        // 创建新的分成记录
        if (updateDto.teacher.length > 0) {
          const totalRatio = updateDto.teacher.reduce((sum, share) => sum + share.ratio, 0);
          if (totalRatio > 1.0) {
            throw new BadRequestException(`老师分成比例总和 ${totalRatio} 不能超过 1.0`);
          }

          for (const share of updateDto.teacher) {
            const teacherShare = manager.create(LedgerEntryTeacherShare, {
              entryId: entry.entryId,
              teacherUserId: share.teacherUserId,
              teacherName: share.name,
              ratio: share.ratio,
              money: Math.round(entry.amount * share.ratio * 100) / 100
            });
            await manager.save(LedgerEntryTeacherShare, teacherShare);
          }
        }
      }

      const savedEntry = await manager.save(LedgerEntry, entry);

      // 记录审计日志
      await this.createAuditLog(
        manager,
        orgId,
        entry.campusId,
        EntityType.ENTRY,
        entryId,
        AuditAction.UPDATE,
        { old: oldEntry, new: savedEntry },
        operatorId,
        undefined,
        updateDto.changeReason
      );

      const updatedEntry = await manager.findOne(LedgerEntry, {
        where: { entryId },
        relations: ['teacherShares', 'attachments']
      });
      
      if (!updatedEntry) {
        throw new NotFoundException('更新后的账单不存在');
      }
      
      return updatedEntry;
    });
  }

  async void(entryId: string, orgId: number, operatorId: number, reason?: string): Promise<LedgerEntry> {
    const entry = await this.findById(entryId, orgId);

    if (entry.status === EntryStatus.VOIDED) {
      throw new BadRequestException('账单已经是作废状态');
    }

    return await this.dataSource.transaction(async manager => {
      const oldStatus = entry.status;
      entry.status = EntryStatus.VOIDED;
      
      const savedEntry = await manager.save(LedgerEntry, entry);

      // 记录审计日志
      await this.createAuditLog(
        manager,
        orgId,
        entry.campusId,
        EntityType.ENTRY,
        entryId,
        AuditAction.VOID,
        { old: { status: oldStatus }, new: { status: EntryStatus.VOIDED } },
        operatorId,
        undefined,
        reason
      );

      return savedEntry;
    });
  }

  // 批量创建账单
  async createBatch(
    entries: CreateLedgerEntryDto[],
    orgId: number,
    campusId: number,
    operatorId: number
  ): Promise<{ success: LedgerEntry[]; failures: { entry: CreateLedgerEntryDto; error: string }[] }> {
    const success: LedgerEntry[] = [];
    const failures: { entry: CreateLedgerEntryDto; error: string }[] = [];

    for (const entryDto of entries) {
      try {
        const entry = await this.create(entryDto, orgId, campusId, operatorId);
        success.push(entry);
      } catch (error) {
        failures.push({
          entry: entryDto,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return { success, failures };
  }

  // 工具方法：解析时间
  private parseDateTime(timeStr: string): Date {
    // 支持格式: "2025.06.16 15:12", "2025-06-16 15:12:00"
    let formattedTime = timeStr.replace(/\./g, '-');
    
    // 如果没有秒数，添加 :00
    if (!/\d{2}:\d{2}:\d{2}$/.test(formattedTime)) {
      formattedTime += ':00';
    }

    const date = new Date(formattedTime);
    if (isNaN(date.getTime())) {
      throw new BadRequestException(`时间格式错误: ${timeStr}`);
    }

    return date;
  }

  // 工具方法：从文本提取金额
  private extractAmountFromText(text: string): number | null {
    // 简单的金额提取正则，匹配类似 "3000元", "3000.50", "$3000" 等
    const amountRegex = /(?:￥|¥|\$)?(\d+(?:\.\d{1,2})?)\s*(?:元|块|¥)?/;
    const match = text.match(amountRegex);
    
    if (match && match[1]) {
      return parseFloat(match[1]);
    }
    
    return null;
  }

  // 工具方法：创建审计日志
  private async createAuditLog(
    manager: any,
    orgId: number,
    campusId: number,
    entityType: EntityType,
    entityId: string,
    action: AuditAction,
    diffData: any,
    actorUserId: number,
    requestId?: string,
    reason?: string
  ): Promise<void> {
    const auditLog = manager.create(LedgerAudit, {
      orgId,
      campusId,
      entityType,
      entityId,
      action,
      diffJson: diffData,
      actorUserId,
      requestId,
      reason
    });

    await manager.save(LedgerAudit, auditLog);
  }
}